export async function exerciseBoxChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  const prefix = 'eb140000-0000-4000-8000-'
  const id = n => prefix + String(n).padStart(12, '0')
  const exercise = async name => (await sql('select id,category from exercises where name=$1', [name]))[0]
  const burpee = await exercise('Burpee'), squat = await exercise('Goblet squat'), treadmill = await exercise('Treadmill run')
  ok(burpee.category === 'strength', 'Burpee seed uses strength-style prescription')
  let coach, client
  try {
    await sql("insert into workouts(id,name,format,created_by) values($1,'Exercise box check','amrap',$2)", [id(1), IDS.coach])
    for (const [n, name, e, tempo] of [[2, 'Burpee', burpee, 'legacy-tempo'], [3, 'Goblet squat', squat, '3-1-1'], [4, 'Treadmill run', treadmill, '']]) {
      await sql("insert into workout_items(id,workout_id,exercise_id,exercise_name,sort,sets,reps,weight,load,tempo,rest_sec,group_label) values($1,$2,$3,$4,$5,3,'10','20','RPE 8',$6,60,'A')", [id(n), id(1), e.id, name, n, tempo])
    }
    coach = await open('coach')
    const { page, errors } = coach
    await page.goto(BASE + '/library/workouts/' + id(1), { waitUntil: 'networkidle' })
    const box = n => page.getByRole('group', { name: 'Exercise ' + n + ': ' + (n === 1 ? 'Burpee' : n === 2 ? 'Goblet squat' : 'Treadmill run'), exact: true })
    await box(1).waitFor()
    ok(await page.getByLabel('Effort', { exact: true }).count() === 0 && await page.getByLabel('Group', { exact: true }).count() === 0, 'exercise boxes omit Effort and Group controls')
    for (const label of ['Sets', 'Reps', 'Weight', 'Rest (s)']) ok(await box(1).getByLabel(label, { exact: true }).count() === 1, 'Burpee has ' + label)
    ok(await box(1).getByLabel('Tempo', { exact: true }).count() === 0 && await box(1).getByText(/Cardio\./).count() === 0, 'Burpee has no tempo or machine-cardio hint')
    ok(await box(1).getByLabel('Time', { exact: true }).count() === 0 && await box(1).getByLabel('Distance (km)', { exact: true }).count() === 0, 'Burpee does not use time or distance fields')
    ok(await box(2).getByLabel('Tempo', { exact: true }).inputValue() === '3-1-1', 'other strength exercises retain tempo')
    ok(await box(3).getByLabel('Time', { exact: true }).count() === 1 && await box(3).getByLabel('Distance (km)', { exact: true }).count() === 1, 'machine cardio retains its appropriate AMRAP fields')
    await box(1).getByLabel('Sets', { exact: true }).fill('4')
    await box(1).getByLabel('Reps', { exact: true }).fill('12')
    await box(1).getByLabel('Weight', { exact: true }).fill('5')
    await box(1).getByLabel('Rest (s)', { exact: true }).fill('45')
    await page.getByRole('button', { name: 'Save workout', exact: true }).click()
    await page.getByRole('button', { name: 'Saved', exact: true }).waitFor()
    const saved = (await sql('select * from workout_items where id=$1', [id(2)]))[0]
    ok(saved.sets === 4 && saved.reps === '12' && saved.weight === '5' && saved.rest_sec === 45, 'Burpee prescription saves sets reps weight and rest')
    ok(saved.load === 'RPE 8' && saved.group_label === 'A' && saved.tempo === 'legacy-tempo', 'hiding controls does not erase historical prescription fields')
    await page.reload({ waitUntil: 'networkidle' })
    ok(await box(1).getByLabel('Weight', { exact: true }).inputValue() === '5', 'Burpee strength prescription survives reload')
    await page.getByRole('button', { name: 'Add exercise', exact: true }).click()
    await page.getByPlaceholder(/Search 100/).fill('Burpee')
    await page.locator('.sheet .item', { hasText: 'Burpee' }).click()
    const added = page.getByRole('group', { name: 'Exercise 4: Burpee', exact: true })
    ok(await added.getByLabel('Sets', { exact: true }).inputValue() === '3' && await added.getByLabel('Tempo', { exact: true }).count() === 0, 'newly picked Burpee uses strength defaults without tempo')
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'simplified exercise cards fit phone width')
    await shot(page, 'exercise-boxes-phone')
    clean('exercise builder fields', errors)
    await sql("insert into client_workouts(id,client_id,workout_id,date) values($1,$2,$3,current_date)", [id(5), IDS.ana, id(1)])
    await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now())", [IDS.ana])
    client = await open('ana')
    await client.page.goto(BASE + '/workout/' + id(5), { waitUntil: 'networkidle' })
    const live = client.page.locator('.exercise-block').filter({ has: client.page.getByText('Burpee', { exact: true }) })
    await live.getByLabel('Set 1 weight', { exact: true }).waitFor()
    ok(await live.getByLabel('Set 1 reps', { exact: true }).count() === 1 && await live.getByText('km/h', { exact: true }).count() === 0, 'client logs Burpee with strength reps and weight inputs')
    const description = await live.locator('.presc').innerText()
    ok(description.includes('4 x 12') && description.includes('rest 45 s') && !description.includes('tempo') && !description.includes('RPE'), 'client Burpee description includes rest and omits effort and tempo')
    ok(await client.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Burpee logging fits phone width')
    await shot(client.page, 'burpee-strength-player-phone')
    clean('Burpee strength logging', client.errors)
  } finally {
    await coach?.ctx.close(); await client?.ctx.close()
    await sql('delete from client_health where client_id=$1', [IDS.ana])
    await sql('delete from workouts where id=$1', [id(1)])
  }
}
