export async function workoutFormatChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  const id = n => 'ff600000-0000-4000-8000-' + String(n).padStart(12, '0')
  const formats = [
    ['standard', 'Sets', 'any combination', 'rest rule'],
    ['circuit', 'Circuit', 'one round', 'next, then repeat'],
    ['amrap', 'AMRAP', 'as many rounds as possible', 'workout time cap'],
    ['emom', 'EMOM', 'each minute', 'Start on the minute'],
    ['intervals', 'Intervals', 'work and recovery', 'prescribed recovery'],
  ]
  let coach, client
  try {
    await sql("insert into workouts(id,name,description,format,duration_min,rounds,created_by) values($1,'Format guidance test','Personal coaching note.','intervals',20,5,$2)", [id(1), IDS.coach])
    for (const [n, name] of [[2, 'Goblet squat'], [3, 'Treadmill run'], [5, 'Seated cable row'], [6, 'Push-up'], [7, 'Plank'], [8, 'Dead bug']]) {
      const ex = (await sql('select id from exercises where name=$1', [name]))[0]
      const sort = n === 2 ? 0 : n === 3 ? 1 : n - 3
      const style = sort < 2 ? 'superset' : sort < 5 ? 'triset' : 'single'
      const group = sort < 2 ? 'A' : sort < 5 ? 'B' : 'C'
      const rest = sort === 1 || sort === 4 ? 75 : sort === 5 ? 60 : 0
      await sql("insert into workout_items(id,workout_id,exercise_id,exercise_name,sort,group_label,set_style,sets,reps,rest_sec,cardio_time) values($1,$2,$3,$4,$5,$6,$7,3,'10',$8,'1:00')", [id(n), id(1), ex.id, name, sort, group, style, rest])
    }
    await sql('insert into client_workouts(id,client_id,workout_id,date) values($1,$2,$3,current_date)', [id(4), IDS.ana, id(1)])
    await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now())", [IDS.ana])
    coach = await open('coach')
    client = await open('ana')
    const { page } = coach
    await page.goto(BASE + '/library/workouts/' + id(1), { waitUntil: 'networkidle' })
    const select = page.getByLabel('Format', { exact: true })
    await select.waitFor()

    await page.getByRole('button', { name: 'Collapse details', exact: true }).click()
    ok(await page.getByRole('group', { name: 'Exercise 1: Goblet squat', exact: true }).getByLabel('Sets', { exact: true }).count() === 0, 'coach can collapse busy exercise prescriptions')
    await page.getByRole('button', { name: 'Show details', exact: true }).click()
    const optionLabels = await select.locator('option').allTextContents()
    ok(JSON.stringify(optionLabels) === JSON.stringify(formats.map(f => f[1])), 'workout formats retain Sets and the four timed or round-based options')
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
      if (value === 'standard') ok(await guide.getByText(/Rounds:/).count() === 0, 'Set-block guidance uses prescriptions rather than a global rounds target')
      if (value === 'standard') {
        ok(JSON.stringify(await page.getByLabel('Set style', { exact: true }).locator('option').allTextContents()) === JSON.stringify(['Single set', 'Superset', 'Tri-set']), 'builder offers all three set-block styles')
        const rest = n => page.getByRole('group', { name: `Exercise ${n}:`, exact: false }).getByLabel('Rest (s)', { exact: true })
        ok(await rest(1).isDisabled(), 'Superset prevents rest after its first exercise')
        ok(await rest(2).getAttribute('min') === '60' && await rest(2).getAttribute('max') === '90', 'Superset limits rest after its second exercise to 60–90 seconds')
        ok(await rest(3).isDisabled() && await rest(4).isDisabled(), 'Tri-set prevents rest after its first two exercises')
        ok(await rest(5).getAttribute('min') === '60' && await rest(5).getAttribute('max') === '90', 'Tri-set limits rest after its third exercise to 60–90 seconds')
      }
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
      const live = client.page.getByRole('region', { name: 'Live format guidance', exact: true })
      await live.waitFor()
      const expectedLive = value === 'standard' ? 'Current set block' : value === 'circuit' ? 'Current round' : value === 'amrap' ? 'AMRAP time remaining' : value === 'emom' ? 'Minute 1' : 'Work interval'
      ok((await live.innerText()).includes(expectedLive), label + ' controls its live grouping or timer')
      const expectedGroup = value === 'standard' ? 'Superset 1' : value === 'circuit' ? 'Circuit' : value === 'amrap' ? 'AMRAP sequence' : value === 'emom' ? 'Minute 1' : 'Interval 1'
      if (expectedGroup) ok(await client.page.getByText(expectedGroup, { exact: true }).count() >= 1, label + ' automatically structures the exercise list')
      if (value === 'standard') {
        const clock = client.page.getByLabel('Elapsed time', { exact: true })
        ok(await clock.innerText() === '0:00' && await client.page.getByText('Ready to start', { exact: true }).count() === 1, 'opening a workout leaves its timer stopped')
        await client.page.waitForTimeout(1100)
        ok(await clock.innerText() === '0:00', 'workout timer does not start by itself')
        await client.page.getByRole('button', { name: 'Start', exact: true }).click()
        await client.page.waitForFunction(() => document.querySelector('[aria-label="Elapsed time"]')?.textContent !== '0:00')
        ok(await clock.innerText() !== '0:00' && await client.page.getByText('Running', { exact: true }).count() === 1, 'Start begins the session timer')
        await client.page.getByRole('button', { name: 'Pause', exact: true }).click()
        await client.page.getByRole('button', { name: 'Resume', exact: true }).waitFor()
        const paused = await clock.innerText()
        await client.page.waitForTimeout(1200)
        ok(await clock.innerText() === paused, 'Pause freezes the session timer')
        await client.page.getByText('Saved', { exact: true }).waitFor()
        await client.page.reload({ waitUntil: 'networkidle' })
        ok(await client.page.getByLabel('Elapsed time', { exact: true }).innerText() === paused && await client.page.getByRole('button', { name: 'Resume', exact: true }).count() === 1, 'paused timer survives refresh')
        await client.page.getByRole('button', { name: 'Resume', exact: true }).click()
        await client.page.waitForFunction(previous => document.querySelector('[aria-label="Elapsed time"]')?.textContent !== previous, paused)
        ok(await client.page.getByLabel('Elapsed time', { exact: true }).innerText() !== paused, 'Resume continues from the saved time')
        await client.page.getByRole('button', { name: 'Reset', exact: true }).click()
        ok(await client.page.getByLabel('Elapsed time', { exact: true }).innerText() === '0:00' && await client.page.getByRole('button', { name: 'Start', exact: true }).count() === 1, 'Reset returns the timer to its initial state')
      }
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
