import { chromium } from 'playwright'
import { createDb, startServer, IDS } from './shim.mjs'
import fs from 'node:fs'

const OUT = new URL('./.out', import.meta.url).pathname
const SHOTS = OUT + '/shots'
fs.mkdirSync(SHOTS, { recursive: true })
const PORT = 4180, BASE = `http://localhost:${PORT}`
const REF = 'localhost' // supabase-js storage key: sb-<hostname first label>-auth-token

const db = await createDb()
const { server } = await startServer(db, { port: PORT, dist: OUT + '/e2e-dist' })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })

let pass = 0, fail = 0
const problems = []
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log('  FAIL', label); problems.push(label) } }
const sql = async (q, p = []) => (await db.query(q, p)).rows

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
function sessionFor(id, email) {
  const exp = Math.floor(Date.now() / 1000) + 86400
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, role: 'authenticated', exp })}.sig`
  return { access_token: jwt, token_type: 'bearer', expires_in: 86400, expires_at: exp, refresh_token: 'r', user: { id, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
}

async function open(who, { w = 390, h = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const s = sessionFor(IDS[who], who + '@x.com')
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify(s)])
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort())
  await ctx.route(/images\.pexels\.com/, r => r.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=', 'base64') }))
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/WebSocket|realtime|favicon|ERR_FAILED|Failed to load resource.*(404|406)/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)) })
  page.on('dialog', d => d.accept())
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  return { ctx, page, errors }
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
const clean = (label, errors) => { ok(errors.length === 0, `${label}: no runtime errors${errors.length ? ' -> ' + errors.slice(0, 3).join(' | ') : ''}`); errors.length = 0 }
const tab = (page, name) => page.locator('nav a', { hasText: new RegExp('^\\s*' + name, 'i') }).first().click().then(() => page.waitForLoadState('networkidle'))
const today = new Date().toLocaleDateString('en-CA')

// ================= COACH (desktop) =================
console.log('Coach flows')
{
  const { ctx, page, errors } = await open('coach', { w: 1280, h: 860 })
  await page.getByText('Dashboard').first().waitFor()
  await page.waitForTimeout(500)
  ok(await page.getByText(/Good (morning|afternoon|evening), Pedro/).count() === 1, 'dashboard greets the coach')
  await shot(page, 'coach-dashboard'); clean('dashboard', errors)

  // clients list + add client through the edge function emulation
  await tab(page, 'Clients')
  ok(await page.getByText('Ana Silva').first().waitFor({ timeout: 10000 }).then(() => true, () => false), 'clients list shows Ana')
  await page.getByRole('button', { name: /Add client/ }).first().click()
  await page.getByPlaceholder('Full name').fill('Cara Test')
  await page.getByPlaceholder('Email').fill('cara@x.com')
  await page.getByPlaceholder(/Temporary password/).fill('secret1')
  await page.locator('.sheet button', { hasText: 'Add client' }).click()
  await page.getByText('Client added').waitFor()
  ok((await sql(`select role from public.profiles p join auth.users u on u.id = p.id where u.email = 'cara@x.com'`))[0]?.role === 'client', 'add client creates a client profile')
  await page.getByRole('button', { name: 'Done' }).click()
  await shot(page, 'coach-clients'); clean('clients', errors)

  // open Ana
  await page.getByText('Ana Silva').first().click()
  await page.getByRole('tab', { name: 'Training' }).click()

  // assign a programme
  await page.getByRole('button', { name: /Assign programme/ }).click()
  await page.locator('.sheet .item', { hasText: 'Beginner full body' }).click()
  await page.locator('.sheet button', { hasText: 'Assign programme' }).click()
  await page.getByText(/Scheduled \d+ workouts/).waitFor()
  const n = (await sql(`select count(*)::int n from client_workouts where client_id = '${IDS.ana}'`))[0].n
  ok(n > 0 && n <= 12, `programme expands into dated sessions (${n})`)
  await page.waitForTimeout(1300)

  // assign a single workout for TODAY so the client has something to do
  await page.getByRole('button', { name: /Assign workout/ }).click()
  await page.locator('.sheet .item', { hasText: 'Push' }).first().click()
  await page.locator('.sheet button', { hasText: 'Schedule' }).click()
  await page.getByText(/Scheduled 1 session/).waitFor()
  ok((await sql(`select count(*)::int n from client_workouts cw join workouts w on w.id = cw.workout_id where cw.client_id = '${IDS.ana}' and w.name = 'Push' and cw.date = '${today}'`))[0].n === 1, 'single workout scheduled for today')
  await page.waitForTimeout(1100)
  await shot(page, 'coach-client-training'); clean('client training tab', errors)

  // nutrition: targets, suggest split, generate week
  await page.getByRole('tab', { name: 'Nutrition' }).click()
  await page.getByLabel('Calories').fill('2200')
  await page.getByRole('button', { name: /Suggest split/ }).click()
  await page.getByRole('button', { name: 'Save targets' }).click()
  await page.getByText('Targets saved').waitFor()
  const t = (await sql(`select * from nutrition_targets where client_id = '${IDS.ana}'`))[0]
  ok(t && t.kcal === 2200 && t.protein === 150 && t.fat === 60, `targets saved with suggested split (${t?.protein}/${t?.carbs}/${t?.fat})`)
  await page.getByRole('button', { name: /Generate week/ }).click()
  await page.getByText(/Generated a 7-day plan/).waitFor()
  const items = await sql(`select mpi.day, mpi.meal_type, mpi.servings, r.kcal from meal_plan_items mpi join recipes r on r.id = mpi.recipe_id where client_id = '${IDS.ana}'`)
  ok(items.length === 28, `generated plan has 28 meals (${items.length})`)
  const perDay = [1, 2, 3, 4, 5, 6, 7].map(d => items.filter(i => i.day === d).reduce((a, i) => a + i.kcal * Number(i.servings), 0))
  ok(perDay.every(k => k > 1700 && k < 2800), `daily kcal near the 2200 target: ${perDay.map(Math.round).join(', ')}`)
  await shot(page, 'coach-nutrition'); clean('coach nutrition', errors)

  // habits + metric via existing components
  await page.getByRole('tab', { name: 'Habits' }).click()
  await page.getByPlaceholder(/New habit/).fill('Drink 3L water')
  await page.getByRole('button', { name: 'Add habit' }).click()
  await page.getByText('Drink 3L water').first().waitFor()
  ok((await sql(`select count(*)::int n from habits where client_id = '${IDS.ana}'`))[0].n === 1, 'habit added for client')
  await page.getByRole('tab', { name: 'Progress' }).click()
  await page.getByRole('tab', { name: 'Strength' }).click()
  await page.getByPlaceholder(/New metric/).fill('Vertical jump')
  await page.getByPlaceholder(/Unit/).fill('cm')
  await page.getByRole('button', { name: 'Add metric' }).click()
  await page.getByText('Vertical jump').first().waitFor()
  ok((await sql(`select count(*)::int n from metrics where client_id = '${IDS.ana}'`))[0].n === 1, 'metric added for client')
  clean('habits and metrics', errors)

  // library: build a workout
  await tab(page, 'Library')
  await page.getByRole('button', { name: /New/ }).first().click()
  await page.getByLabel('Name').first().fill('Coach leg day')
  await page.getByRole('button', { name: /Add exercise/ }).click()
  await page.getByPlaceholder(/Search 100/).fill('squat')
  await page.locator('.sheet .item', { hasText: 'Back squat' }).click()
  await page.getByRole('button', { name: /Add exercise/ }).click()
  await page.getByPlaceholder(/Search 100/).fill('Leg press')
  await page.locator('.sheet .item', { hasText: 'Leg press' }).click()
  await page.getByRole('button', { name: 'Save workout' }).click()
  await page.getByText('Saved').first().waitFor()
  const wk = (await sql(`select w.id, count(i.id)::int n from workouts w join workout_items i on i.workout_id = w.id where w.name = 'Coach leg day' group by w.id`))[0]
  ok(wk?.n === 2, 'workout builder saved two exercises')
  await shot(page, 'coach-workout-builder'); clean('workout builder', errors)

  // programme builder
  await tab(page, 'Library')
  await page.getByRole('tab', { name: 'Programmes' }).click()
  await page.getByRole('button', { name: /New/ }).first().click()
  await page.getByRole('button', { name: /Add/ }).first().click()
  await page.locator('.sheet .item', { hasText: 'Coach leg day' }).click()
  await page.waitForTimeout(400)
  ok((await sql(`select count(*)::int n from program_days pd join programs p on p.id = pd.program_id where p.name = 'New programme'`))[0].n === 1, 'programme builder added a day')
  await shot(page, 'coach-program-builder'); clean('program builder', errors)

  // community + resources + recipes
  await page.goto(BASE + '/community', { waitUntil: 'networkidle' })
  await page.getByPlaceholder(/Share an update/).fill('Welcome to PTPN, everyone!')
  await page.getByRole('button', { name: 'Post' }).click()
  await page.getByText('Welcome to PTPN, everyone!').waitFor()
  await page.getByRole('tab', { name: 'Challenges' }).click()
  await page.getByRole('button', { name: /New challenge/ }).click()
  await page.getByPlaceholder(/Name, e.g./).fill('October steps')
  await page.getByPlaceholder('steps, km, reps').fill('steps')
  await page.locator('.sheet button', { hasText: 'Create challenge' }).click()
  await page.getByText('October steps').first().waitFor()
  ok((await sql(`select count(*)::int n from challenges`))[0].n === 1, 'challenge created')
  await shot(page, 'coach-community'); clean('community', errors)
  await page.goto(BASE + '/resources', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Add/ }).first().click()
  await page.getByPlaceholder('Title').fill('Protein guide')
  await page.getByPlaceholder(/Link/).fill('example.com/protein')
  await page.locator('.sheet button', { hasText: 'Save' }).click()
  await page.getByText('Protein guide').waitFor()
  ok((await sql(`select url from resources`))[0]?.url === 'https://example.com/protein', 'resource saved with https prefix')
  await page.getByRole('button', { name: /Add/ }).first().click()
  await page.getByPlaceholder('Title').fill('Hip mobility reel')
  await page.getByPlaceholder(/Link/).fill('https://www.instagram.com/reel/ABC123xyz/?igsh=1')
  await page.locator('.sheet button', { hasText: 'Save' }).click()
  await page.getByText('Hip mobility reel').waitFor()
  ok(await page.locator('iframe.video-frame').count() === 0, 'instagram embed not loaded until tapped')
  await page.getByText('Watch on Instagram').click()
  ok((await page.locator('iframe.video-frame').getAttribute('src')) === 'https://www.instagram.com/reel/ABC123xyz/embed/', 'instagram reel embeds on tap')
  await sql(`delete from resources where title = 'Hip mobility reel'`)
  await page.goto(BASE + '/recipes', { waitUntil: 'networkidle' })
  ok(await page.locator('.recipe-card').count() === 105, 'coach sees all 105 recipes')
  await shot(page, 'coach-recipes'); clean('resources and recipes', errors)

  // exercise library includes the MyGym list
  await page.goto(BASE + '/library', { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Exercises' }).click()
  await page.getByPlaceholder(/Search 225 exercises/).fill('turkish')
  ok(await page.getByText('Turkish get-up').count() === 1, 'library has the MyGym exercises (225 in total)')
  await page.getByPlaceholder(/Search 225 exercises/).fill('')

  // meal plan library: browse, shopping list, apply to a client
  await page.goto(BASE + '/meal-plans', { waitUntil: 'networkidle' })
  ok(await page.locator('.recipe-card').count() === 10, 'coach sees 10 meal plans')
  ok(await page.locator('.recipe-art .photo').count() === 10, 'meal plan banners use photos')
  await page.locator('.recipe-card', { hasText: 'Bowls and Cosy Soup Week' }).click()
  await page.getByText('Quinoa nourish bowl').first().waitFor()
  await shot(page, 'coach-mealplan')
  await page.locator('.sheet').getByRole('button', { name: /Shopping list/ }).click()
  await page.locator('.sheet ul.ingredients li').first().waitFor()
  ok(await page.locator('.sheet ul.ingredients li').count() > 20, 'shopping list has items')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('heading', { name: 'Seasonings and extras' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.locator('.sheet').screenshot({ path: SHOTS + '/shopping-list-seasonings.png' })
  const shopText = await page.locator('.sheet').innerText()
  console.log(shopText.split('Seasonings and extras')[1]?.split('\n').slice(0, 14).join(' | '))
  ok(/Seasonings and extras/.test(shopText) && /\d+ cloves? garlic/.test(shopText), 'seasonings are totalled in the shopping list')
  await page.locator('.sheet select').selectOption({ index: 1 })
  await page.getByRole('button', { name: /Apply to weekly plan/ }).click()
  await page.getByText(/^Applied to/).waitFor()
  ok((await sql(`select count(*)::int n from meal_plan_items where client_id = '${IDS.ana}'`))[0].n === 28, 'template applied: 28 planned meals')
  await page.keyboard.press('Escape')
  clean('meal plans', errors)

  // chat: coach writes to Ana
  await page.goto(BASE + '/inbox', { waitUntil: 'networkidle' })
  await page.getByText('Ana Silva').first().click()
  await page.getByPlaceholder('Write a message').fill('Hi Ana, your plan is ready. Push day today!')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByText('Hi Ana, your plan is ready').waitFor()
  ok((await sql(`select count(*)::int n from messages where client_id = '${IDS.ana}' and sender_id = '${IDS.coach}'`))[0].n === 1, 'coach message stored')
  clean('coach chat', errors)
  await ctx.close()
}

// ================= CLIENT (phone) =================
console.log('Client flows')
{
  const { ctx, page, errors } = await open('ana')
  await page.getByText(/Good (morning|afternoon|evening), Ana/).waitFor()
  await page.waitForTimeout(500)
  ok(await page.getByText("Today's workout").count() >= 1, "home shows today's workout")
  ok(await page.getByText('Hi Ana, your plan is ready').count() === 1, 'home previews the coach message')
  ok(await page.locator('nav button.menu-btn .dot').count() >= 1, 'unread badge shows on the More button')
  await shot(page, 'client-home'); clean('client home', errors)

  // workout player
  await page.locator('.card', { hasText: 'Push' }).getByRole('link', { name: /Start workout/ }).first().click()
  await page.getByText('Barbell bench press').waitFor()
  await page.waitForLoadState('networkidle')
  ok(await page.getByText(/no max yet/).count() >= 1, 'player flags %1RM lifts without a recorded max')
  const weight = page.getByLabel('Set 1 weight').first()
  await weight.fill('60')
  await page.getByLabel('Set 1 reps').first().fill('8')
  await page.getByRole('button', { name: 'Complete set 1' }).first().click()
  ok(await page.getByRole('timer').count() === 1, 'rest timer appears after completing a set')
  await shot(page, 'client-player')
  await page.locator('.timer-pill').getByRole('button', { name: 'Skip' }).click()
  await page.waitForTimeout(1200)
  const saved = (await sql(`select cw.log from client_workouts cw join workouts w on w.id = cw.workout_id where cw.client_id = '${IDS.ana}' and cw.date = '${today}' and w.name = 'Push'`))[0]?.log
  const firstSets = Object.values(saved?.items ?? {})[0]
  ok(firstSets?.[0]?.done === true && firstSets?.[0]?.kg === '60', 'set log autosaved to the database')
  await page.getByRole('button', { name: /Finish workout/ }).click()
  await page.getByRole('button', { name: '4 stars' }).click()
  await page.getByPlaceholder(/Notes for your coach/).fill('Felt strong')
  await page.getByRole('button', { name: 'Save and finish' }).click()
  await page.waitForURL(u => !u.pathname.startsWith('/workout'))
  const done = (await sql(`select cw.status, cw.rating, cw.client_note from client_workouts cw join workouts w on w.id = cw.workout_id where cw.client_id = '${IDS.ana}' and cw.date = '${today}' and w.name = 'Push'`))[0]
  ok(done?.status === 'done' && done.rating === 4 && done.client_note === 'Felt strong', 'finishing records status, rating and note')
  clean('workout player', errors)

  // train tab shows history
  await tab(page, 'Train')
  await page.getByRole('tab', { name: 'History' }).click()
  ok(await page.getByText('Push').count() >= 1, 'history lists the finished workout')
  await page.getByRole('tab', { name: 'Schedule' }).click()
  await shot(page, 'client-train'); clean('train', errors)

  // nutrition: quick add, food search, planned recipe
  await tab(page, 'Nutrition')
  await page.locator('.card', { hasText: 'Breakfast' }).getByRole('button', { name: /Add/ }).first().click()
  await page.getByRole('tab', { name: 'Quick add' }).click()
  await page.getByPlaceholder('What did you eat?').fill('Coffee and croissant')
  await page.locator('.sheet input[type=number]').nth(0).fill('300')
  await page.locator('.sheet input[type=number]').nth(1).fill('6')
  await page.locator('.sheet button', { hasText: 'Add entry' }).click()
  await page.getByText('Coffee and croissant').waitFor()
  await page.locator('.card', { hasText: 'Lunch' }).getByRole('button', { name: /Add/ }).first().click()
  await page.getByPlaceholder('Search foods').fill('chicken breast')
  await page.locator('.sheet .item', { hasText: 'Chicken breast, cooked' }).click()
  await page.locator('.sheet input[type=number]').fill('200')
  await page.locator('.sheet button', { hasText: /Add to lunch/ }).click()
  await page.getByText('Chicken breast, cooked').first().waitFor()
  const chicken = (await sql(`select kcal, protein from food_logs where client_id = '${IDS.ana}' and name = 'Chicken breast, cooked'`))[0]
  ok(chicken && Number(chicken.kcal) === 330 && Math.abs(Number(chicken.protein) - 62) < 0.01, `200 g chicken logs 330 kcal / 62 g protein (${chicken?.kcal}/${chicken?.protein})`)
  ok(await page.getByText('Planned').count() >= 1, 'planned meals from the coach appear')
  await page.getByRole('button', { name: 'Log' }).first().click()
  await page.waitForTimeout(600)
  ok((await sql(`select count(*)::int n from food_logs where client_id = '${IDS.ana}' and recipe_id is not null`))[0].n === 1, 'logging a planned recipe stores it')
  const sumK = (await sql(`select sum(kcal)::int s from food_logs where client_id = '${IDS.ana}'`))[0].s
  ok(await page.locator('.ring-label b').first().innerText() === String(sumK), `ring total matches the diary (${sumK})`)
  await shot(page, 'client-nutrition'); clean('nutrition', errors)

  // client finds meal plans from the Nutrition page
  ok(await page.getByRole('link', { name: /Recipe book/ }).count() === 1, 'Nutrition page links to the recipe book')
  await page.locator('.plan-rail').scrollIntoViewIfNeeded()
  await page.locator('.plan-card').first().waitFor()
  await page.screenshot({ path: SHOTS + '/client-nutrition-bottom.png' })
  await page.locator('.plan-card').first().click()
  await page.locator('.sheet').getByRole('button', { name: /Shopping list/ }).click()
  await page.getByRole('heading', { name: 'Seasonings and extras' }).waitFor()
  ok(await page.getByRole('button', { name: /Apply to weekly plan/ }).count() === 0, 'client sees the shopping list but not the coach apply button')
  await page.keyboard.press('Escape')

  // random meal idea: preview, try another, add
  const before = (await sql(`select count(*)::int n from food_logs where client_id = '${IDS.ana}'`))[0].n
  await page.locator('.card', { hasText: 'Snacks' }).getByRole('button', { name: /Random/ }).click()
  await page.locator('.sheet ul.ingredients li').first().waitFor()
  ok(await page.locator('.sheet ol.steps li').count() >= 1, 'random idea shows ingredients and method')
  await page.locator('.sheet').getByRole('button', { name: /Try another/ }).click()
  await page.locator('.sheet ul.ingredients li').first().waitFor()
  await page.locator('.sheet').getByRole('button', { name: /Add to snacks/ }).click()
  await page.waitForTimeout(600)
  ok((await sql(`select count(*)::int n from food_logs where client_id = '${IDS.ana}'`))[0].n === before + 1, 'random idea added to the diary')
  clean('random meal', errors)

  // next days: planned meals visible, read-only
  await page.getByRole('button', { name: 'Next day' }).click()
  await page.getByText('Tomorrow').first().waitFor()
  ok(await page.getByText('Upcoming').count() >= 3, 'tomorrow shows the planned meals')
  ok(await page.getByRole('button', { name: 'Log', exact: true }).count() === 0, 'no logging on future days')
  await page.getByText('tap for recipe').first().click()
  await page.locator('.sheet ul.ingredients li').first().waitFor()
  await shot(page, 'client-nutrition-tomorrow')
  await page.keyboard.press('Escape')
  clean('future day', errors)
  await page.getByRole('button', { name: 'Previous day' }).click()

  // recipes -> log
  await page.goto(BASE + '/recipes', { waitUntil: 'networkidle' })
  await page.locator('.recipe-card', { hasText: 'Protein overnight oats' }).click()
  await page.getByRole('button', { name: /Log to today/ }).click()
  await page.getByText('Logged to today').waitFor()
  await shot(page, 'client-recipes'); clean('recipes', errors)
  await page.keyboard.press('Escape')

  // progress: body, strength, photos
  await tab(page, 'Progress')
  await page.getByPlaceholder('Weight kg').fill('82.5')
  await page.getByRole('button', { name: 'Add' }).first().click()
  await page.getByText('82.5').first().waitFor()
  await page.getByRole('tab', { name: 'Strength' }).click()
  await page.getByPlaceholder('Exercise, e.g. Back squat').fill('Barbell bench press')
  await page.getByPlaceholder('kg').fill('100')
  await page.locator('.card', { hasText: 'Max lifts' }).getByRole('button', { name: 'Add' }).click()
  await page.getByText('Barbell bench press').first().waitFor()
  await page.waitForTimeout(500)
  ok(await page.getByText('Personal records').count() === 1 && await page.getByText(/60 kg × 8/).count() >= 1, 'personal record from the logged set (60 kg × 8)')
  const metricCard = page.locator('.card', { hasText: 'Vertical jump' })
  await metricCard.getByPlaceholder('cm').fill('42')
  await metricCard.getByRole('button', { name: 'Log' }).click()
  await page.getByText('42').first().waitFor()
  await shot(page, 'client-progress-strength')
  await page.getByRole('tab', { name: 'Photos' }).click()
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[type=file]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: png })
  await page.waitForFunction(() => document.querySelectorAll('.photo').length > 0, null, { timeout: 8000 }).catch(() => {})
  ok((await sql(`select count(*)::int n from progress_photos where client_id = '${IDS.ana}'`))[0].n === 1, 'photo uploaded and recorded')
  ok((await sql(`select count(*)::int n from storage.objects where name like '${IDS.ana}/%'`))[0].n === 1, 'photo file stored in the client folder')
  await shot(page, 'client-progress-photos'); clean('progress', errors)

  // chat reply
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.locator('.drawer').waitFor()
  ok(await page.locator('.drawer-item').count() >= 4, 'menu drawer lists the other pages')
  await page.waitForTimeout(400); await page.screenshot({ path: SHOTS + '/client-menu-drawer.png' })
  await page.keyboard.press('Escape')
  ok(await page.locator('.drawer').count() === 0, 'Escape closes the menu')
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.locator('.drawer-item', { hasText: 'Coach' }).click()
  ok(await page.locator('.drawer').count() === 0, 'choosing a page closes the menu')
  await page.getByText('Hi Ana, your plan is ready').waitFor()
  await page.getByPlaceholder('Write a message').fill('Thanks coach, done with push day!')
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByText('Thanks coach, done').waitFor()
  await page.waitForTimeout(400)
  ok((await sql(`select count(*)::int n from messages where client_id = '${IDS.ana}' and read_at is not null and sender_id = '${IDS.coach}'`))[0].n === 1, 'opening the chat marks coach messages as read')
  await shot(page, 'client-chat'); clean('chat', errors)

  // community: challenge entry + leaderboard
  await page.goto(BASE + '/community', { waitUntil: 'networkidle' })
  ok(await page.getByText('Welcome to PTPN, everyone!').count() === 1, 'client sees the announcement')
  await page.getByRole('tab', { name: 'Challenges' }).click()
  await page.getByText('October steps').first().click()
  await page.getByPlaceholder(/Add steps/).fill('9000')
  await page.locator('.sheet button', { hasText: 'Log' }).click()
  await page.locator('.leader').first().waitFor()
  await page.waitForTimeout(300)
  ok(await page.locator('.leader.me').count() === 1, 'leaderboard highlights the client')
  await shot(page, 'client-challenge'); clean('community client', errors)
  await page.keyboard.press('Escape')

  // booking, resources, more, account
  await page.goto(BASE + '/resources', { waitUntil: 'networkidle' })
  ok(await page.getByText('Protein guide').count() === 1, 'client sees resources')
  await page.goto(BASE + '/more', { waitUntil: 'networkidle' })
  await shot(page, 'client-more'); clean('more', errors)
  await page.goto(BASE + '/book', { waitUntil: 'networkidle' }); clean('book', errors)
  await page.goto(BASE + '/account', { waitUntil: 'networkidle' }); clean('account', errors)

  // client builds their own workout
  await page.goto(BASE + '/train', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Build my own/ }).click()
  await page.getByRole('button', { name: /Add exercise/ }).waitFor()
  await page.getByRole('button', { name: /Add exercise/ }).click()
  await page.getByPlaceholder(/Search 100/).fill('push-up')
  await page.locator('.sheet .item', { hasText: 'Push-up' }).first().click()
  await page.getByRole('button', { name: 'Save workout' }).click()
  await page.waitForURL(/\/workout\//)
  await page.waitForTimeout(800)
  console.log('   url:', page.url().replace(BASE, ''), '| body:', (await page.locator('main').innerText()).replace(/\n+/g, ' / ').slice(0, 220))
  ok(await page.getByText('Push-up').count() >= 1, 'client-built workout opens in the player after saving')
  clean('client builder', errors)

  // privacy: Ana cannot read Bo or the coach data through the API
  const leak = await page.evaluate(async () => {
    const t = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.includes('auth-token')))).access_token
    const h = { Authorization: `Bearer ${t}`, apikey: 'anon-key' }
    const prof = await (await fetch('/rest/v1/profiles?select=id', { headers: h })).json()
    const msgs = await (await fetch('/rest/v1/messages?select=client_id', { headers: h })).json()
    return { profiles: prof.length, otherMsgs: msgs.filter(m => m.client_id !== JSON.parse(atob(t.split('.')[1])).sub).length }
  })
  ok(leak.profiles === 1 && leak.otherMsgs === 0, 'a client cannot read other profiles or conversations')
  await ctx.close()
}

// ================= extra views: desktop client + login =================
{
  const { ctx, page, errors } = await open('ana', { w: 1280, h: 860 })
  await page.waitForTimeout(700)
  await shot(page, 'client-home-desktop')
  await tab(page, 'Nutrition'); await page.waitForTimeout(400); await shot(page, 'client-nutrition-desktop')
  clean('client desktop', errors)
  await ctx.close()
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await c2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort())
  const p2 = await c2.newPage()
  await p2.goto(BASE + '/', { waitUntil: 'networkidle' })
  await shot(p2, 'login')
  await c2.close()
}

// ================= Second client: isolation =================
{
  const { ctx, page, errors } = await open('bo')
  await page.waitForTimeout(500)
  ok(await page.getByText('Rest day').count() === 1, "another client sees no one else's workouts")
  await page.goto(BASE + '/chat', { waitUntil: 'networkidle' })
  ok(await page.getByText('Hi Ana').count() === 0, 'another client cannot see Ana\'s chat')
  await shot(page, 'client2-chat'); clean('second client', errors)
  await ctx.close()
}

// coach desktop client-side views of what Ana did
{
  const { ctx, page, errors } = await open('coach', { w: 1280, h: 860 })
  await page.goto(BASE + `/clients/${IDS.ana}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await shot(page, 'coach-client-overview')
  ok(await page.getByText('Recent workouts').count() >= 1, 'coach overview renders')
  await page.getByRole('tab', { name: 'Habits' }).click(); await page.waitForTimeout(300)
  await page.getByRole('tab', { name: 'Progress' }).click(); await page.waitForTimeout(300)
  await page.getByRole('tab', { name: 'Photos' }).click(); await page.waitForTimeout(500)
  ok(await page.locator('.photo').count() === 1, 'coach can see the client photo')
  clean('coach client views', errors)
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(400)
  await shot(page, 'coach-dashboard-after')
  await ctx.close()
}

console.log(`\n${pass} passed, ${fail} failed`)
await browser.close(); server.close()
process.exit(fail ? 1 : 0)
