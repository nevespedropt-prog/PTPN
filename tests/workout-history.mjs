export async function workoutHistoryChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  console.log('Progress workouts tab')
  await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now()) on conflict (client_id) do nothing", [IDS.ana])
  const lib = (await sql('select id, name from workouts where created_by is null order by name limit 2'))
  const mine = (await sql("insert into workouts(name, created_by) values('History own workout', $1) returning id", [IDS.ana]))[0].id
  const now = new Date()
  const today = now.toLocaleDateString('en-CA')
  const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toLocaleDateString('en-CA')
  const log = JSON.stringify({ timer: { elapsed_sec: 2700, started_at: null, running: false }, items: { a: [{ reps: '10', kg: '20', done: true }, { reps: '10', kg: '20', done: true }, { reps: '10', kg: '20', done: false }] } })
  const ids = []
  const add = async (workout, date, rating, withLog) => ids.push((await sql("insert into client_workouts(client_id, workout_id, date, status, completed_at, rating, log) values($1,$2,$3,'done',$4,$5,$6::jsonb) returning id", [IDS.ana, workout, date, new Date().toISOString(), rating, withLog ? log : '{}']))[0].id)
  try {
    await add(lib[0].id, today, 5, true)
    await add(mine, today, null, false)
    await add(lib[1].id, lastMonth, null, false)
    const client = await open('ana', { w: 390, h: 844 })
    const { page } = client
    await page.goto(BASE + '/progress?progressTab=workouts', { waitUntil: 'networkidle' })
    const tabs = await page.getByRole('tab').allInnerTexts()
    ok(tabs.join(',') === 'Body,Strength,Photos,Workouts,Monthly', 'workouts tab: sits after Photos: ' + tabs.join(','))
    await page.getByText('3 workouts done', { exact: true }).waitFor()
    ok(await page.getByText('2 from the coach plan · 1 built by you', { exact: false }).count() === 1, 'workouts tab: summary splits coach plan and own workouts')
    const boxes = page.locator('details.collapsible-card')
    ok(await boxes.count() === 2 && !(await boxes.evaluateAll(els => els.some(el => el.open))), 'workouts tab: one box per month, all minimised')
    await boxes.first().locator('summary').click()
    const rows = boxes.first().getByRole('link')
    ok(await rows.count() === 2, 'workouts tab: opening a month lists its workouts')
    ok(await boxes.first().locator('.badge', { hasText: 'Own' }).count() === 1 && await boxes.first().locator('.badge', { hasText: 'Coach plan' }).count() === 1, 'workouts tab: each line says coach plan or own')
    const first = await boxes.first().innerText()
    ok(first.includes('45 min') && first.includes('2 sets') && first.includes('★'), 'workouts tab: time, sets and rating are shown')
    ok((await rows.first().getAttribute('href')).startsWith('/workout/'), 'workouts tab: a line opens the workout')
    await boxes.nth(1).locator('summary').click()
    ok(await boxes.nth(1).getByRole('link').count() === 1, 'workouts tab: an older month holds its own workouts')
    await shot(page, 'progress-workouts-tab-phone')
    clean('workouts tab', client.errors); await client.ctx.close()
  } finally {
    for (const id of ids) await sql('delete from client_workouts where id=$1', [id])
    await sql('delete from workouts where id=$1', [mine])
    await sql('delete from client_health where client_id=$1', [IDS.ana])
  }
}
