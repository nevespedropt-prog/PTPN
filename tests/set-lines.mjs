export async function setLineChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  console.log('Exercise set lines')
  await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now()) on conflict (client_id) do nothing", [IDS.ana])
  const workout = (await sql("insert into workouts(name, created_by) values('Set lines test', $1) returning id", [IDS.ana]))[0].id
  await sql("insert into workout_items(workout_id, exercise_name, sort, group_label, sets, reps, rest_sec) values($1,'Goblet squat',0,'g1',3,'15',90)", [workout])
  const today = new Date().toLocaleDateString('en-CA')
  const session = (await sql('insert into client_workouts(client_id, workout_id, date) values($1,$2,$3) returning id', [IDS.ana, workout, today]))[0].id
  try {
    const client = await open('ana', { w: 390, h: 844 })
    const { page } = client
    await page.goto(BASE + `/build/${workout}?cw=${session}&returnTo=${encodeURIComponent('/train?tab=plan')}`, { waitUntil: 'networkidle' })
    const line = n => page.getByRole('group', { name: `Exercise ${n}: Goblet squat` })
    await line(1).getByLabel('Sets', { exact: true }).fill('1')
    await line(1).getByRole('button', { name: 'Add another set line for Goblet squat' }).click()
    await line(2).getByLabel('Reps', { exact: true }).fill('12')
    await line(2).getByRole('button', { name: 'Add another set line for Goblet squat' }).click()
    await line(3).getByLabel('Reps', { exact: true }).fill('10')
    ok(await line(2).getByText('(another line)').count() === 1 && await line(3).getByText('(another line)').count() === 1 && await line(1).getByText('(another line)').count() === 0, 'set lines: extra lines are marked as continuing the exercise')
    await shot(page, 'builder-set-lines-phone')
    await page.getByRole('button', { name: 'Save workout', exact: true }).click()
    await page.waitForURL(/\/workout\//)
    const rows = await sql('select sets, reps, group_label from workout_items where workout_id=$1 order by sort', [workout])
    ok(rows.length === 3 && rows.map(r => r.reps).join(',') === '15,12,10' && rows.every(r => Number(r.sets) === 1) && new Set(rows.map(r => r.group_label)).size === 3, 'set lines: each line keeps its own reps and sets')
    await page.getByText('Goblet squat', { exact: true }).first().waitFor()
    ok(await page.getByText('Goblet squat', { exact: true }).count() >= 3, 'set lines: the workout screen shows every line')
    clean('set lines', client.errors); await client.ctx.close()
  } finally {
    await sql('delete from client_workouts where id=$1', [session])
    await sql('delete from workouts where id=$1', [workout])
    await sql('delete from client_health where client_id=$1', [IDS.ana])
  }
}
