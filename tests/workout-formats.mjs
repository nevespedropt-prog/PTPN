export async function workoutFormatChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  const id = n => 'ff600000-0000-4000-8000-' + String(n).padStart(12, '0')
  const formats = [
    ['standard', 'Superset', 'back-to-back', 'paired exercise'],
    ['circuit', 'Circuit', 'one round', 'next, then repeat'],
    ['amrap', 'AMRAP', 'as many rounds as possible', 'workout time cap'],
    ['emom', 'EMOM', 'each minute', 'Start on the minute'],
    ['intervals', 'Intervals', 'work and recovery', 'prescribed recovery'],
  ]
  let coach, client
  try {
    await sql("insert into workouts(id,name,description,format,duration_min,rounds,created_by) values($1,'Format guidance test','Personal coaching note.','intervals',20,5,$2)", [id(1), IDS.coach])
    for (const [n, name] of [[2, 'Goblet squat'], [3, 'Treadmill run']]) {
      const ex = (await sql('select id from exercises where name=$1', [name]))[0]
      await sql("insert into workout_items(id,workout_id,exercise_id,exercise_name,sort,sets,reps,rest_sec,cardio_time) values($1,$2,$3,$4,$5,3,'10',60,'1:00')", [id(n), id(1), ex.id, name, n])
    }
    await sql('insert into client_workouts(id,client_id,workout_id,date) values($1,$2,$3,current_date)', [id(4), IDS.ana, id(1)])
    await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now())", [IDS.ana])
    coach = await open('coach')
    client = await open('ana')
    const { page } = coach
    await page.goto(BASE + '/library/workouts/' + id(1), { waitUntil: 'networkidle' })
    const select = page.getByLabel('Format', { exact: true })
    const optionLabels = await select.locator('option').allTextContents()
    ok(JSON.stringify(optionLabels) === JSON.stringify(formats.map(f => f[1])), 'formats replace Straight sets with Superset and retain the other four options')
    const guide = page.getByRole('region', { name: 'Workout format', exact: true })
    const cardio = page.getByRole('group', { name: 'Exercise 2: Treadmill run', exact: true })
    for (const [value, label, meaning, cardioMeaning] of formats) {
      await select.selectOption(value)
      await guide.getByRole('heading', { name: label, exact: true }).waitFor()
      ok((await guide.innerText()).includes(meaning), label + ' immediately shows its own format instructions')
      ok(await guide.getAttribute('aria-live') === 'polite', label + ' format changes are announced accessibly')
      ok((await cardio.innerText()).includes(cardioMeaning), label + ' cardio station instructions agree with the selected format')
      const top = await guide.boundingBox(), exercises = await page.getByRole('group', { name: 'Exercise 1: Goblet squat', exact: true }).boundingBox()
      ok(!!top && !!exercises && top.y < exercises.y, label + ' description appears above the exercises')
      ok(await page.getByLabel('Description', { exact: true }).inputValue() === 'Personal coaching note.', label + ' selection preserves the coach workout notes')
      if (value === 'amrap') ok(await guide.getByText('Time cap: 20 min', { exact: true }).count() === 1, 'AMRAP shows the configured time cap')
      if (value === 'standard') ok(await guide.getByText(/Rounds:/).count() === 0, 'Superset guidance uses planned sets rather than a global rounds target')
      await page.getByRole('button', { name: 'Save workout', exact: true }).click()
      await page.getByRole('button', { name: 'Saved', exact: true }).waitFor()
      await page.reload({ waitUntil: 'networkidle' })
      await guide.getByRole('heading', { name: label, exact: true }).waitFor()
      ok(await select.inputValue() === value, label + ' and its matching guide persist after reload')
      ok((await sql('select description from workouts where id=$1', [id(1)]))[0].description === 'Personal coaching note.', label + ' save preserves original coach notes')
      await client.page.goto(BASE + '/workout/' + id(4), { waitUntil: 'networkidle' })
      const clientGuide = client.page.getByRole('region', { name: 'Workout format', exact: true })
      await clientGuide.getByRole('heading', { name: label, exact: true }).waitFor()
      ok((await clientGuide.innerText()).includes(meaning), label + ' instructions also appear on the client workout')
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && await client.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ' guide fits phone width on both sides')
      await shot(page, 'format-' + value + '-builder-phone')
      await shot(client.page, 'format-' + value + '-client-phone')
    }
    clean('workout format selection', coach.errors)
    clean('client workout format guidance', client.errors)
  } finally {
    await coach?.ctx.close(); await client?.ctx.close()
    await sql('delete from client_health where client_id=$1', [IDS.ana])
    await sql('delete from workouts where id=$1', [id(1)])
  }
}
