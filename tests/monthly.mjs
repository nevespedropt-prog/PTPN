import { monthWindow, monthlySummary, shiftMonth } from '../src/lib/monthly.ts'

export function monthlyUnitChecks(ok) {
  ok(shiftMonth('2026-01', -1) === '2025-12' && shiftMonth('2026-12', 1) === '2027-01', 'monthly: year boundaries')
  ok(monthWindow('2024-02', '2024-03-01').end === '2024-02-29', 'monthly: leap February')
  ok(monthWindow('2025-02', '2025-03-01').end === '2025-02-28', 'monthly: ordinary February')
  ok(monthWindow('2026-03', '2026-04-01').end === '2026-03-31', 'monthly: DST month stays on calendar boundary')
  const partial = monthWindow('2026-10', '2026-10-26')
  ok(partial.end === '2026-10-26' && partial.partial, 'monthly: current month stops today')
  ok(monthWindow('2026-10', '2026-10-31').partial, 'monthly: current month remains provisional on its last day')
  let rejected = false
  try { monthWindow('2026-11', '2026-10-26') } catch { rejected = true }
  ok(rejected, 'monthly: future month rejected')
  const measurements = [
    { date: '2025-12-31', weight_kg: 83, body_fat_pct: null },
    { date: '2026-01-01', weight_kg: 80, body_fat_pct: 25 },
    { date: '2026-01-01', weight_kg: 82, body_fat_pct: 27 },
    { date: '2026-01-02', weight_kg: 79, body_fat_pct: 24 },
    { date: '2026-01-03', weight_kg: null, body_fat_pct: null },
    { date: '2026-01-04', weight_kg: -10, body_fat_pct: 101 },
    { date: '2026-01-05', weight_kg: 0, body_fat_pct: -1 },
    { date: '2026-01-10', weight_kg: 78, body_fat_pct: 0 },
    { date: '2026-01-11', weight_kg: 100, body_fat_pct: 50 },
  ]
  const workouts = [
    { date: '2025-12-31', status: 'done' }, { date: '2026-01-01', status: 'done' },
    { date: '2026-01-01', status: 'done' }, { date: '2026-01-02', status: 'skipped' },
    { date: '2026-01-03', status: 'scheduled' }, { date: '2026-01-11', status: 'done' },
  ]
  const s = monthlySummary(workouts, measurements, '2026-01-01', '2026-01-10')
  ok(s.done === 2 && s.due === 4 && s.trainingDays === 1, 'monthly: scheduled-date consistency includes missed/skipped and excludes future')
  ok(s.weights.length === 3 && s.weights[0].y === 81, 'monthly: duplicate dates average before smoothing; invalid and absent weights ignored')
  ok(s.trend.map(p => p.y).join(',') === '82,81,78', 'monthly: rolling average uses recorded days within seven calendar days')
  ok(s.trend.length === 3 && s.trend.at(-1).x === '2026-01-10', 'monthly: missing days are not invented')
  ok(s.fat.length === 3 && s.fat[0].y === 26 && s.fat.at(-1).y === 0, 'monthly: body fat handles zero, duplicates and bounds')
  const empty = monthlySummary([], [], '2026-01-01', '2026-01-31')
  ok(empty.due === 0 && empty.trend.length === 0 && empty.fat.length === 0, 'monthly: empty period has no invented progress')
}

export async function monthlyDbChecks(db, { coach: C, ana: A, bo: B }, ok) {
  async function as(who, query, params = []) {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claims', $1, false)", [who ? JSON.stringify({ sub: who, role: 'authenticated' }) : ''])
    await db.exec(who ? 'set role authenticated' : 'set role anon')
    try { return { rows: (await db.query(query, params)).rows } } catch (e) { return { error: e.message } }
    finally { await db.exec('reset role') }
  }
  const insert = "insert into monthly_reviews(client_id,month_start,feedback,next_focus) values($1,'2026-09-01','Good consistency','Keep three sessions') returning *"
  ok(!!(await as(A, insert, [A])).error, 'monthly: client cannot write coach review')
  ok(!(await as(C, insert, [A])).error, 'monthly: coach writes review')
  ok(!!(await as(C, insert, [A])).error, 'monthly: one review per client/month')
  ok((await as(A, 'select * from monthly_reviews where client_id=$1', [A])).rows?.length === 1, 'monthly: client reads own review')
  ok((await as(B, 'select * from monthly_reviews where client_id=$1', [A])).rows?.length === 0, 'monthly: other client cannot read review')
  ok(!!(await as(null, 'select * from monthly_reviews')).error, 'monthly: anonymous review access denied')
  ok((await as(A, "update monthly_reviews set feedback='Spoof' where client_id=$1 returning *", [A])).rows?.length === 0, 'monthly: client cannot rewrite review')
  ok((await as(C, "update monthly_reviews set feedback='Excellent consistency' where client_id=$1 returning *", [A])).rows?.length === 1, 'monthly: coach updates review')
  ok(!!(await as(C, "update monthly_reviews set month_start='2026-09-02' where client_id=$1", [A])).error, 'monthly: month must start on day one')
  ok(!!(await as(C, "update monthly_reviews set feedback=' ' where client_id=$1", [A])).error, 'monthly: blank feedback rejected')
  ok(!!(await as(C, "update monthly_reviews set next_focus=' ' where client_id=$1", [A])).error, 'monthly: blank focus rejected')
  ok(!!(await as(C, "update monthly_reviews set feedback=repeat('x',2001) where client_id=$1", [A])).error, 'monthly: feedback bound enforced')
  ok(!!(await as(C, "update monthly_reviews set next_focus=repeat('x',1001) where client_id=$1", [A])).error, 'monthly: focus bound enforced')
  ok(!!(await as(A, 'delete from monthly_reviews where client_id=$1', [A])).error, 'monthly: no accidental client deletion')
  await db.query('delete from monthly_reviews where client_id=$1', [A])
  const temp = '55555555-5555-5555-5555-555555555555'
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'monthly@x.com','{}')", [temp])
  await db.query(insert, [temp]); await db.query('delete from auth.users where id=$1', [temp])
  ok((await db.query('select * from monthly_reviews where client_id=$1', [temp])).rows.length === 0, 'monthly: account removal cascades review')
}

export async function monthlyBrowserChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  const today = new Date().toLocaleDateString('en-CA'), current = today.slice(0, 7)
  const moveDay = n => { const value = new Date(today + 'T12:00:00'); value.setDate(value.getDate() + n); return value.toLocaleDateString('en-CA') }
  const weekStart = moveDay(1 - ((new Date(today + 'T12:00:00').getDay() + 6) % 7 + 1))
  const previousWeek = (() => { const value = new Date(weekStart + 'T12:00:00'); value.setDate(value.getDate() - 1); return value.toLocaleDateString('en-CA') })()
  const month = shiftMonth(current, -1), previous = shiftMonth(month, -1)
  await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now())", [IDS.ana])
  const w = (await sql("insert into workouts(name,created_by) values('Monthly fixture',$1) returning id", [IDS.coach]))[0].id
  const item = (await sql("insert into workout_items(workout_id,exercise_name) values($1,'Monthly squat') returning id", [w]))[0].id
  const log = kg => JSON.stringify({ items: { [item]: [{ kg: String(kg), reps: '10', done: true }] } })
  await sql("insert into client_workouts(client_id,workout_id,date,status,log) values($1,$2,$3,'done',$4::jsonb),($1,$2,$5,'done',$6::jsonb),($1,$2,$7,'skipped','{}'),($1,$2,$8,'scheduled','{}')", [IDS.ana, w, previous + '-05', log(50), month + '-05', log(60), month + '-10', month + '-15'])
  await sql("insert into client_workouts(client_id,workout_id,date,status,log) values($1,$2,$3,'done',$4::jsonb),($1,$2,$3,'done',$4::jsonb),($1,$2,$3,'done',$4::jsonb),($1,$2,$5,'done',$4::jsonb)", [IDS.ana, w, today, log(65), previousWeek])
  const ids = (await sql("insert into measurements(client_id,date,weight_kg,body_fat_pct,notes) values($1,$2,81,25,'monthly fixture'),($1,$2,83,25,'monthly fixture'),($1,$3,80,24,'monthly fixture') returning id", [IDS.ana, month + '-01', month + '-03'])).map(x => x.id)
  ids.push(...(await sql("insert into measurements(client_id,date,weight_kg,notes) values($1,$2,80,'progress story fixture'),($1,$3,79,'progress story fixture') returning id", [IDS.ana, moveDay(-1), today])).map(x => x.id))
  const client = await open('ana')
  const { page } = client
  await page.goto(BASE + '/progress', { waitUntil: 'networkidle' })
  const story = page.getByRole('region', { name: 'Progress summary', exact: true })
  await story.locator('.tile').filter({ hasText: 'Workouts this week' }).getByText('3', { exact: true }).waitFor()
  ok(await story.getByText('3 workouts completed this week', { exact: true }).count() === 1 && await story.getByText('2 more workouts than last week', { exact: true }).count() === 1, 'progress story turns weekly training into clear achievements')
  ok(await story.locator('.tile').filter({ hasText: 'Latest weight' }).getByText('-1 kg since', { exact: false }).count() === 1, 'progress story shows the latest body trend')
  ok(await story.getByText('Your coach's latest summary and next focus will appear here.', { exact: true }).count() === 1, 'progress story explains where coach guidance will appear')
  await page.getByRole('tab', { name: 'Monthly', exact: true }).click()
  const report = page.getByRole('region', { name: 'Monthly report', exact: true })
  await report.getByText('Previous month: 66.7 kg. Change: +13.3 kg.', { exact: true }).waitFor()
  ok(await report.getByLabel('Report month', { exact: true }).inputValue() === month, 'monthly: defaults to previous complete month')
  ok(await report.locator('.tile').filter({ hasText: 'Workouts completed' }).getByText('1/3', { exact: true }).count() === 1, 'monthly: completion includes missed/skipped sessions')
  ok(/81\s*kg/.test(await report.locator('.tile').filter({ hasText: 'Weight average' }).locator('.value').innerText()), 'monthly: report displays smoothed daily weight average')
  ok(await report.getByRole('button', { name: 'Save monthly review', exact: true }).count() === 0, 'monthly: clients have no coach-edit controls')
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'monthly: client report fits phone width')
  await shot(page, 'monthly-client-phone')
  await report.getByRole('button', { name: 'View private photo comparisons', exact: true }).click()
  await page.getByRole('tab', { name: 'Photos', exact: true, selected: true }).waitFor()
  await page.getByRole('tab', { name: 'Photos', exact: true }).getAttribute('aria-selected').then(v => ok(v === 'true', 'monthly: photo action opens existing private photo viewer'))
  await page.getByRole('tab', { name: 'Monthly', exact: true }).click()
  await report.getByLabel('Report month', { exact: true }).waitFor()
  // Failed reads must not look like a successful empty report.
  await page.route('**/rest/v1/monthly_reviews*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Offline"}' }))
  await report.getByLabel('Report month', { exact: true }).selectOption(current)
  await report.getByRole('alert').waitFor()
  ok(await report.locator('.tile').count() === 0, 'monthly: incomplete load hides misleading summary')
  await page.unroute('**/rest/v1/monthly_reviews*')
  await report.getByRole('button', { name: 'Retry monthly report', exact: true }).click()
  await report.getByText('No weight entries this month.', { exact: true }).waitFor()
  // Intentionally delayed old response must not replace the currently selected month.
  await page.route('**/rest/v1/monthly_reviews*', async route => {
    if (new URL(route.request().url()).searchParams.get('month_start') === 'eq.' + month + '-01') await new Promise(resolve => setTimeout(resolve, 500))
    return route.continue()
  })
  await report.getByLabel('Report month', { exact: true }).selectOption(month)
  await report.getByLabel('Report month', { exact: true }).selectOption(current)
  await report.getByText('No weight entries this month.', { exact: true }).waitFor()
  await page.waitForTimeout(650) // allow the deliberately delayed response to arrive
  ok(await report.getByText('Monthly squat', { exact: true }).count() === 0, 'monthly: old month response cannot overwrite current report')
  await page.unroute('**/rest/v1/monthly_reviews*')
  client.errors.splice(0, client.errors.length, ...client.errors.filter(e => !/503/.test(e)))
  clean('monthly client', client.errors); await client.ctx.close()

  const coach = await open('coach', { w: 1280, h: 860 })
  await coach.page.goto(BASE + '/clients/' + IDS.ana, { waitUntil: 'networkidle' })
  await coach.page.getByRole('tab', { name: 'Progress', exact: true }).click()
  await coach.page.getByRole('tab', { name: 'Monthly', exact: true }).click()
  const review = coach.page.getByRole('region', { name: 'Monthly report', exact: true })
  await review.getByLabel('Monthly feedback', { exact: true }).fill('Your consistency and strength improved this month.')
  await review.getByLabel("Next month's focus", { exact: true }).fill('Plan three manageable training sessions each week.')
  await coach.page.route('**/rest/v1/monthly_reviews*', route => route.request().method() === 'POST' ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Offline"}' }) : route.continue())
  await review.getByRole('button', { name: 'Save monthly review', exact: true }).click()
  await review.getByRole('alert').waitFor()
  ok((await review.getByLabel('Monthly feedback', { exact: true }).inputValue()).startsWith('Your consistency'), 'monthly: failed coach save retains feedback')
  await coach.page.unroute('**/rest/v1/monthly_reviews*')
  await review.locator('form').evaluate(el => { el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  await review.getByText('Monthly review saved and visible to your client.', { exact: true }).waitFor()
  ok((await sql('select * from monthly_reviews where client_id=$1 and month_start=$2', [IDS.ana, month + '-01'])).length === 1, 'monthly: duplicate coach submit creates one review')
  await review.getByLabel('Monthly feedback', { exact: true }).fill('Excellent consistency and strength progress.')
  coach.page.removeAllListeners('dialog') // override open()'s automatic acceptance for this cancellation check
  coach.page.once('dialog', dialog => dialog.dismiss())
  await review.getByLabel('Report month', { exact: true }).selectOption(current)
  ok(await review.getByLabel('Report month', { exact: true }).inputValue() === month, 'monthly: cancelled month change preserves unsaved review')
  await review.getByRole('button', { name: 'Update monthly review', exact: true }).click()
  await review.getByText('Monthly review saved and visible to your client.', { exact: true }).waitFor()
  await shot(coach.page, 'monthly-coach-desktop')
  await coach.page.setViewportSize({ width: 390, height: 844 })
  ok(await coach.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'monthly: coach review fits phone width')
  await shot(coach.page, 'monthly-coach-phone')
  coach.errors.splice(0, coach.errors.length, ...coach.errors.filter(e => !/503/.test(e)))
  clean('monthly coach', coach.errors); await coach.ctx.close()
  const returning = await open('ana')
  await returning.page.goto(BASE + '/progress', { waitUntil: 'networkidle' })
  const returningStory = returning.page.getByRole('region', { name: 'Progress summary', exact: true })
  await returningStory.getByText('Excellent consistency and strength progress.', { exact: true }).waitFor()
  ok(await returningStory.getByText('Plan three manageable training sessions each week.', { exact: true }).count() === 1, 'progress story surfaces the coach summary and current focus without opening the report')
  await returning.page.getByRole('tab', { name: 'Monthly', exact: true }).click()
  await returning.page.getByRole('region', { name: 'Monthly report', exact: true }).getByText('Excellent consistency and strength progress.', { exact: true }).waitFor()
  ok(true, 'monthly: client sees saved coach review after reopening')
  clean('monthly saved review', returning.errors); await returning.ctx.close()
  await sql('delete from monthly_reviews where client_id=$1', [IDS.ana])
  await sql('delete from measurements where id=any($1::uuid[])', [ids])
  await sql('delete from workouts where id=$1', [w])
  await sql('delete from client_health where client_id=$1', [IDS.ana])
}


