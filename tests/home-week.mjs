export async function homeWeekChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  console.log('Client Home week summary')
  await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now()) on conflict (client_id) do nothing", [IDS.ana])
  const lib = await sql('select id, name from workouts order by name limit 4')
  const today = new Date().toLocaleDateString('en-CA')
  const earlier = new Date(Date.now() - 8 * 86400000).toLocaleDateString('en-CA')
  const ids = []
  const add = async (workout, date, status, rating) => ids.push((await sql('insert into client_workouts(client_id, workout_id, date, status, completed_at, rating) values($1,$2,$3,$4,$5,$6) returning id', [IDS.ana, workout.id, date, status, status === 'done' ? new Date().toISOString() : null, rating]))[0].id)
  try {
    await add(lib[0], today, 'done', 4)
    await add(lib[1], today, 'done', null)
    await add(lib[2], today, 'scheduled', null)
    await add(lib[3], earlier, 'done', null)
    const client = await open('ana', { w: 390, h: 844 })
    const { page } = client
    const week = page.getByRole('region', { name: 'Your week', exact: true })
    await week.waitFor()
    ok(await page.getByRole('region', { name: 'Your week', exact: true }).count() === 1, 'home: one box summarises the week')
    ok(await week.getByRole('link').count() === 2 && await week.getByText(lib[0].name, { exact: true }).count() === 1 && await week.getByText(lib[1].name, { exact: true }).count() === 1, 'home: the week box lists this week\'s finished workouts')
    ok(await week.getByText(lib[3].name, { exact: true }).count() === 0, 'home: last week\'s workout is not in this week\'s box')
    ok(await page.getByRole('link', { name: /Start workout/ }).count() === 1 && await page.getByText('Completed', { exact: true }).count() === 0, 'home: finished workouts no longer get their own boxes, only the one still to do does')
    await shot(page, 'home-week-summary-phone')
    await sql("update client_workouts set status='done', completed_at=now() where id=$1", [ids[2]])
    await page.reload({ waitUntil: 'networkidle' })
    await week.waitFor()
    ok(await week.getByRole('link').count() === 3 && await page.getByRole('link', { name: /Start workout/ }).count() === 0 && await page.getByText('Rest day', { exact: true }).count() === 0, 'home: finishing the last workout adds a line to the week box, not a new box')
    ok(await week.getByText("Today's training is done", { exact: false }).count() === 1, 'home: the week box says when today is done')
    clean('home week', client.errors); await client.ctx.close()
  } finally {
    for (const id of ids) await sql('delete from client_workouts where id=$1', [id])
    await sql('delete from client_health where client_id=$1', [IDS.ana])
  }
}
