export async function workoutDateChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  console.log('Plan a workout for another day')
  await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now()) on conflict (client_id) do nothing", [IDS.ana])
  const workout = (await sql("insert into workouts(name, created_by) values('Date test workout', $1) returning id", [IDS.ana]))[0].id
  await sql("insert into workout_items(workout_id, exercise_name, sort, group_label, sets, reps, rest_sec) values($1,'Goblet squat',0,'g1',3,'10',90)", [workout])
  const move = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }
  const today = new Date().toLocaleDateString('en-CA')
  const nextWeek = move(today, 7)
  const session = (await sql('insert into client_workouts(client_id, workout_id, date) values($1,$2,$3) returning id', [IDS.ana, workout, today]))[0].id
  try {
    const client = await open('ana', { w: 390, h: 844 })
    const { page } = client
    await page.goto(BASE + `/build/${workout}?cw=${session}&returnTo=${encodeURIComponent('/train?tab=plan&date=' + today)}`, { waitUntil: 'networkidle' })
    const date = page.getByLabel('Workout date', { exact: true })
    await date.waitFor()
    ok(await date.inputValue() === today, 'workout date: the builder shows the day the workout is planned for')
    await date.fill(nextWeek)
    await page.getByRole('button', { name: 'Save workout', exact: true }).click()
    await page.waitForURL(/\/workout\//)
    ok((await sql('select date::text as d from client_workouts where id=$1', [session]))[0].d === nextWeek, 'workout date: saving moves the workout to the chosen day')
    ok(decodeURIComponent(new URL(page.url()).searchParams.get('returnTo') ?? '').includes('date=' + nextWeek), 'workout date: Back returns to the week that now holds the workout')
    await page.goto(BASE + '/train?tab=plan', { waitUntil: 'networkidle' })
    await page.getByText('Date test workout').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
    ok(await page.getByText('Date test workout').count() === 0, 'workout date: it leaves this week')
    await page.getByRole('button', { name: 'Next week' }).click()
    await page.getByText('Date test workout').first().waitFor()
    ok(true, 'workout date: it appears in next week')
    await shot(page, 'workout-date-phone')
    clean('workout date', client.errors); await client.ctx.close()
  } finally {
    await sql('delete from client_workouts where id=$1', [session])
    await sql('delete from workouts where id=$1', [workout])
    await sql('delete from client_health where client_id=$1', [IDS.ana])
  }
}
