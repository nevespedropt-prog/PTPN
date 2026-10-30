export async function trainWeekChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  console.log('Train schedule shows one week')
  await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now()) on conflict (client_id) do nothing", [IDS.ana])
  const move = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }
  const today = new Date().toLocaleDateString('en-CA')
  const nextWeek = move(today, 7), lastWeek = move(today, -7)
  const w = {}
  const ids = []
  try {
    for (const name of ['Week fixture next', 'Week fixture last']) w[name] = (await sql('insert into workouts(name, created_by) values($1, null) returning id', [name]))[0].id
    ids.push((await sql("insert into client_workouts(client_id, workout_id, date, status) values($1,$2,$3,'scheduled') returning id", [IDS.ana, w['Week fixture next'], nextWeek]))[0].id)
    ids.push((await sql("insert into client_workouts(client_id, workout_id, date, status, completed_at) values($1,$2,$3,'done',now()) returning id", [IDS.ana, w['Week fixture last'], lastWeek]))[0].id)
    const client = await open('ana', { w: 390, h: 844 })
    const { page } = client
    await page.goto(BASE + '/train?tab=plan', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Next week' }).waitFor()
    ok(await page.getByRole('button', { name: 'Previous week' }).count() === 1, 'train week: arrows page through the weeks')
    ok(await page.getByText('Week fixture next').count() === 0 && await page.getByText('Week fixture last').count() === 0, 'train week: only this week\'s workouts are listed')
    ok(await page.getByRole('button', { name: 'Back to this week' }).count() === 0, 'train week: no back-to-this-week button on the current week')
    await page.getByRole('button', { name: 'Next week' }).click()
    await page.getByText('Week fixture next').first().waitFor()
    ok(await page.getByText('Week fixture last').count() === 0, 'train week: next week shows only next week\'s workouts')
    await page.getByRole('button', { name: 'Back to this week' }).click()
    await page.getByRole('button', { name: 'Previous week' }).click()
    await page.getByText('Week fixture last').first().waitFor()
    ok(await page.getByText('Week fixture next').count() === 0, 'train week: previous week shows only last week\'s workouts')
    await page.getByRole('button', { name: 'Back to this week' }).click()
    await page.getByRole('button', { name: 'Previous week' }).waitFor()
    ok(await page.getByText('Week fixture last').count() === 0 && await page.getByRole('button', { name: 'Back to this week' }).count() === 0, 'train week: Back to this week returns to the current week')
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    await page.getByText('Week fixture last').waitFor()
    ok(true, 'train week: older workouts are also in History')
    await shot(page, 'train-week-phone')
    clean('train week', client.errors); await client.ctx.close()
  } finally {
    for (const id of ids) await sql('delete from client_workouts where id=$1', [id])
    for (const id of Object.values(w)) await sql('delete from workouts where id=$1', [id])
    await sql('delete from client_health where client_id=$1', [IDS.ana])
  }
}
