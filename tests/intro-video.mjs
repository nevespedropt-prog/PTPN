// Records the client introduction video with a made-up demo client. Not part of npm test.
// Run: node intro-video.mjs  (needs npm run build:e2e first). Output: .out/intro/ptpn-intro.mp4
import { chromium } from 'playwright'
import { createDb, startServer, IDS } from './shim.mjs'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

const wait0 = ms => new Promise(r => setTimeout(r, ms))
const OUT = new URL('./.out/intro', import.meta.url).pathname
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true })
const PORT = 4180, BASE = `http://localhost:${PORT}`
const db = await createDb()
await startServer(db, { port: PORT, dist: new URL('./.out/e2e-dist', import.meta.url).pathname })
const sql = async (q, p = []) => (await db.query(q, p)).rows
const iso = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }

// ---- demo data: one made-up client
await sql("update profiles set full_name='Sam Carter' where id=$1", [IDS.ana])
await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now()) on conflict (client_id) do nothing", [IDS.ana])
const ex = async n => (await sql('select id from exercises where lower(name)=lower($1) limit 1', [n]))[0]?.id ?? null
async function workout(name, desc, items) {
  const w = (await sql("insert into workouts(name,description,created_by) values($1,$2,$3) returning id", [name, desc, IDS.coach]))[0].id
  let sort = 0
  for (const [n, sets, reps, rest] of items) await sql('insert into workout_items(workout_id,exercise_id,exercise_name,sort,sets,reps,rest_sec) values($1,$2,$3,$4,$5,$6,$7)', [w, await ex(n), n, sort++, sets, reps, rest])
  return w
}
const upper = await workout('Upper Body Strength', 'Chest, back and shoulders. Keep two reps in reserve.', [['Dumbbell bench press', 3, '10', 90], ['Seated cable row', 3, '12', 75], ['Dumbbell shoulder press', 3, '10', 75], ['Lat pulldown', 3, '12', 60]])
const lower = await workout('Lower Body Power', 'Legs and glutes. Drive through your heels.', [['Goblet squat', 4, '10', 90], ['Romanian deadlift', 3, '10', 90], ['Walking lunge', 3, '12', 60]])
await sql("insert into client_workouts(client_id,workout_id,date,status) values($1,$2,$3,'scheduled')", [IDS.ana, upper, iso(0)])
await sql("insert into client_workouts(client_id,workout_id,date,status) values($1,$2,$3,'scheduled')", [IDS.ana, lower, iso(2)])
await sql("insert into client_workouts(client_id,workout_id,date,status,completed_at,rating) values($1,$2,$3,'done',now(),4)", [IDS.ana, lower, iso(-3)])
for (const [d, w, f] of [[-35, 82.4, 22.1], [-28, 81.9, 21.8], [-21, 81.2, 21.3], [-14, 80.8, 20.9], [-7, 80.1, 20.4]]) await sql('insert into measurements(client_id,date,weight_kg,body_fat_pct) values($1,$2,$3,$4)', [IDS.ana, iso(d), w, f])
await sql("insert into one_rep_maxes(client_id,exercise,weight_kg,date) values($1,'Back squat',100,$2),($1,'Bench press',70,$2)", [IDS.ana, iso(-20)])

// ---- recording
const W = 540, H = 1170, Z = 1.5
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 86400
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: IDS.ana, role: 'authenticated', exp })}.sig`
const session = { access_token: jwt, token_type: 'bearer', expires_in: 86400, expires_at: exp, refresh_token: 'r', user: { id: IDS.ana, aud: 'authenticated', role: 'authenticated', email: 'ana@x.com', app_metadata: {}, user_metadata: {} } }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: { width: W, height: H } } })
await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), ['sb-localhost-auth-token', JSON.stringify(session)])
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort())
await ctx.route(/images\.pexels\.com/, r => r.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=', 'base64') }))
const page = await ctx.newPage()
page.setDefaultTimeout(6000)
page.on('dialog', d => d.accept())
page.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url().slice(0, 140)) })
page.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 160)))
await page.goto(BASE + '/home', { waitUntil: 'networkidle' })
if (process.env.DEBUG) { await wait0(4000); console.log(await page.locator("body").innerText()); process.exit(0) }
await page.addStyleTag({ content: `html{zoom:1.5}

  #vcap{position:fixed;left:14px;right:14px;bottom:92px;z-index:99999;background:rgba(20,20,22,.94);border:1.5px solid #c9a24a;color:#f5efe0;border-radius:16px;padding:12px 14px;font:700 17px/1.35 system-ui,sans-serif;text-align:center;opacity:0;transition:opacity .35s;pointer-events:none}
  #vcap.on{opacity:1}
  #vcard{position:fixed;inset:0;z-index:100000;background:#141416;color:#f5efe0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:30px;font-family:system-ui,sans-serif;opacity:0;transition:opacity .5s;pointer-events:none}
  #vcard.on{opacity:1}
  #vcard h1{margin:0;font-size:38px;color:#c9a24a;letter-spacing:.02em}
  #vcard p{margin:0;font-size:17px;opacity:.85}
  .vtap{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:3px solid #c9a24a;background:rgba(201,162,74,.28);z-index:100001;pointer-events:none;animation:vt .7s ease-out forwards}
  @keyframes vt{from{transform:scale(.4);opacity:1}to{transform:scale(1.4);opacity:0}}
` })
await page.evaluate(() => { for (const id of ['vcap', 'vcard']) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d) } })
const wait = ms => page.waitForTimeout(ms)
const cap = async (t, ms = 3200) => { await page.evaluate(t => { const c = document.getElementById('vcap'); c.textContent = t; c.classList.add('on') }, t); await wait(ms) }
const uncap = () => page.evaluate(() => document.getElementById('vcap').classList.remove('on'))
const card = async (h, p, ms = 3200) => { await page.evaluate(([h, p]) => { const c = document.getElementById('vcard'); c.innerHTML = `<h1>${h}</h1><p>${p}</p>`; c.classList.add('on') }, [h, p]); await wait(ms); await page.evaluate(() => document.getElementById('vcard').classList.remove('on')); await wait(500) }
const tap = async loc => { const b = await loc.first().boundingBox(); if (b) { await page.evaluate(([x, y]) => { const d = document.createElement('div'); d.className = 'vtap'; d.style.left = x / 1.5 + 'px'; d.style.top = y / 1.5 + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 800) }, [b.x + b.width / 2, b.y + b.height / 2]); await wait(450) } await loc.first().click(); await page.waitForLoadState('networkidle').catch(() => {}); await wait(500) }
const nav = n => page.locator('nav a', { hasText: new RegExp('^\\s*' + n, 'i') })
const scene = async (name, fn) => { try { await fn() } catch (e) { console.log('SCENE FAILED', name, String(e.message).split('\n')[0]) } }

await card('Welcome to PTPN', 'A 90 second tour of your coaching app', 3000)
await scene('home', async () => {
  await cap('Home shows your week and today\'s workout.', 3800)
  await page.mouse.wheel(0, 380); await wait(1200); await page.mouse.wheel(0, -380); await wait(800)
})
await scene('menu', async () => {
  await cap('The bar at the bottom is your menu. Everything is one tap away.', 3600)
  for (const n of ['Train', 'Nutrition', 'Progress']) { await tap(nav(n)); await wait(900) }
  await tap(nav('Home'))
})
await scene('train', async () => {
  await cap('Train: your scheduled workouts, week by week.', 2200)
  await tap(nav('Train')); await wait(1800)
  await cap('Tap a workout to open it.', 2200)
  await tap(page.getByText('Upper Body Strength').first()); await wait(800)
  const start = page.getByRole('button', { name: /^Start$/ })
  if (await start.count()) { await page.mouse.wheel(0, 0) }
})
await scene('exercise', async () => {
  await cap('Each exercise shows sets, reps and rest.', 3000)
  await page.mouse.wheel(0, 260); await wait(1200)
  const play = page.locator('a[aria-label^="Watch"]').first()
  await cap('Tap the play button to watch how the exercise is done.', 1800)
  await tap2(play)
  async function tap2(l) { const b = await l.boundingBox(); if (b) { await page.evaluate(([x, y]) => { const d = document.createElement('div'); d.className = 'vtap'; d.style.left = x / 1.5 + 'px'; d.style.top = y / 1.5 + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 800) }, [b.x + b.width / 2, b.y + b.height / 2]) } await wait(1600) }
  await uncap()
  await cap('Log your weight and reps, then tick each set.', 2200)
  const kg = page.locator('input[inputmode="decimal"]').first(), reps = page.locator('input[inputmode="numeric"]').first()
  await kg.scrollIntoViewIfNeeded(); await tap(kg); await kg.fill('24'); await wait(500)
  await tap(reps); await reps.fill('10'); await wait(500)
  await tap(page.locator('button.set-check').first()); await wait(1400)
  await cap('Finish the workout and rate it. Your coach sees everything.', 3200)
})
await scene('progress', async () => {
  await tap(nav('Progress')); await wait(800)
  await cap('Progress: your results in one place.', 2600)
  await tap(page.getByRole('button', { name: 'Strength', exact: true }).or(page.getByText('Strength', { exact: true })))
  await cap('Log a new personal best lift.', 2000)
  const ex = page.getByPlaceholder(/Exercise, e\.g\./); await ex.scrollIntoViewIfNeeded(); await tap(ex); await ex.fill('Deadlift'); await wait(400)
  const kg = page.getByPlaceholder('kg').first(); await tap(kg); await kg.fill('120'); await wait(400)
  await tap(page.getByRole('button', { name: 'Add', exact: true }).first()); await wait(1500)
  await tap(page.getByRole('button', { name: 'Body', exact: true }).or(page.getByText('Body', { exact: true })))
  await cap('Add your body weight and body fat.', 2000)
  const w = page.getByPlaceholder('Weight kg'); await tap(w); await w.fill('79.6'); await wait(400)
  const f = page.getByPlaceholder('Body fat %'); await tap(f); await f.fill('20.0'); await wait(400)
  await tap(page.getByRole('button', { name: 'Add', exact: true }).first()); await wait(1500)
  await cap('Your charts update straight away.', 2800)
  await tap(page.getByRole('button', { name: 'Photos', exact: true }).or(page.getByText('Photos', { exact: true })))
  await cap('Photos: upload front, side and back to see your change.', 3400)
})
await scene('chat', async () => {
  await tap(page.locator('nav').getByText('More', { exact: true })); await wait(600)
  await cap('More has your coach chat, community challenges and your account.', 2400)
  await tap(page.getByRole('link', { name: /Coach|Chat|Message/ })); await wait(800)
  await cap('Need to move a session or have a question? Message your coach here.', 3600)
})
await uncap()
await card('That is your app', 'Open it, train, log, and message me any time.', 3500)
await ctx.close(); await browser.close()
const webm = fs.readdirSync(OUT).find(f => f.endsWith('.webm'))
console.log('RECORDED', webm)

process.exit(0)
