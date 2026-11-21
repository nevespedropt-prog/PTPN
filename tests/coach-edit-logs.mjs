// The coach can add, change and delete a client's food diary entries and check-ins; clients keep their own rights.
export async function coachEditLogsDbChecks({ db, ok, as, IDS }) {
  const A = IDS.ana, B = IDS.bo, C = IDS.coach
  const n = async (who, sql) => { const r = await as(who, sql + ' returning id'); return r.error ? 'ERR' : r.rows.length }
  // food logs
  const food = (await as(C, `insert into food_logs(client_id, date, meal_type, name, kcal) values('${A}', current_date, 'lunch', 'Coach added lunch', 500) returning id`))
  ok(!food.error && food.rows.length === 1, 'v40: the coach can add a food entry for a client')
  const fid = food.rows[0].id
  ok(await n(C, `update food_logs set kcal = 640 where id = '${fid}'`) === 1, 'v40: the coach can change a client food entry')
  ok(await n(A, `update food_logs set kcal = 600 where id = '${fid}'`) === 1, 'v40: the client can still change their own food entry')
  ok(await n(B, `update food_logs set kcal = 1 where id = '${fid}'`) === 0, 'v40: another client cannot change it')
  ok(await n(B, `delete from food_logs where id = '${fid}'`) === 0, 'v40: another client cannot delete it')
  ok(await n(C, `delete from food_logs where id = '${fid}'`) === 1, 'v40: the coach can delete a food entry')
  ok(!(await as(A, `insert into food_logs(client_id, date, meal_type, name) values('${A}', current_date, 'snack', 'Ana own snack')`)).error, 'v40: the client can still log their own food')
  ok((await as(B, `insert into food_logs(client_id, date, meal_type, name) values('${A}', current_date, 'snack', 'Bo for Ana')`)).error, 'v40: a client cannot log food for someone else')
  await db.query(`select set_config('request.jwt.claims', '', false)`); await db.query(`delete from food_logs where client_id = '${A}'`)
  // daily check-ins
  const ci = (await as(C, `insert into checkins(client_id, date, mood, energy, note) values('${A}', current_date - 40, 4, 3, 'Coach entered') returning id`))
  ok(!ci.error && ci.rows.length === 1, 'v40: the coach can add a daily check-in for a client')
  const cid = ci.rows[0].id
  ok(await n(C, `update checkins set energy = 5 where id = '${cid}'`) === 1, 'v40: the coach can change a daily check-in')
  ok(await n(A, `update checkins set note = 'mine' where id = '${cid}'`) === 1, 'v40: the client can still change their own check-in')
  ok(await n(B, `update checkins set note = 'no' where id = '${cid}'`) === 0, 'v40: another client cannot change it')
  ok(await n(A, `delete from checkins where id = '${cid}'`) === 0, 'v40: a client cannot delete a check-in')
  ok(await n(C, `delete from checkins where id = '${cid}'`) === 1, 'v40: the coach can delete a daily check-in')
  // weekly check-ins
  const wk = "date_trunc('week', current_date - 70)::date"
  const w = (await as(C, `insert into weekly_checkins(client_id, week_start, training, nutrition, sleep_hours, energy, biggest_win, difficulties) values('${A}', ${wk}, 't', 'n', 7, 3, 'w', 'd') returning id`))
  ok(!w.error && w.rows.length === 1, 'v40: the coach can add a weekly check-in for a client')
  const wid = w.rows[0].id
  ok(await n(C, `update weekly_checkins set training = 'edited' where id = '${wid}'`) === 1, 'v40: the coach can edit a weekly check-in')
  ok(await n(A, `update weekly_checkins set training = 'mine' where id = '${wid}'`) === 0, 'v40: a client still cannot change a submitted weekly check-in')
  ok(await n(A, `delete from weekly_checkins where id = '${wid}'`) === 0, 'v40: a client cannot delete a weekly check-in')
  ok(!(await as(A, `insert into weekly_checkins(client_id, week_start, training, nutrition, sleep_hours, energy, biggest_win, difficulties) values('${A}', date_trunc('week', current_date - 77)::date, 't', 'n', 7, 3, 'w', 'd')`)).error, 'v40: a client can still submit their own weekly check-in')
  ok((await as(B, `insert into weekly_checkins(client_id, week_start, training, nutrition, sleep_hours, energy, biggest_win, difficulties) values('${A}', date_trunc('week', current_date - 84)::date, 't', 'n', 7, 3, 'w', 'd')`)).error, 'v40: a client cannot submit a weekly check-in for someone else')
  ok(await n(C, `delete from weekly_checkins where id = '${wid}'`) === 1, 'v40: the coach can delete a weekly check-in')
  await db.query(`select set_config('request.jwt.claims', '', false)`); await db.query(`delete from weekly_checkins where client_id = '${A}'`)
}

export async function coachEditLogsBrowserChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  console.log('Coach edits food logs and check-ins')
  await sql("delete from food_logs where client_id=$1", [IDS.ana])
  try {
    const coach = await open('coach', { w: 1280, h: 900 })
    await coach.page.goto(BASE + '/clients/' + IDS.ana + '?tab=nutrition', { waitUntil: 'networkidle' })
    const diary = coach.page.getByRole('region', { name: 'Food diary' })
    await diary.waitFor()
    await diary.getByRole('button', { name: /^Add food on/ }).first().click()
    const sheet = coach.page.locator('.sheet')
    await sheet.getByLabel('Food', { exact: true }).fill('Coach added oats')
    await sheet.getByLabel('Calories').fill('300')
    await sheet.getByLabel('Protein g').fill('12')
    await sheet.getByRole('button', { name: 'Save', exact: true }).click()
    await diary.getByRole('button', { name: /^Edit Coach added oats on/ }).waitFor()
    let row = (await sql("select kcal::float k, protein::float p from food_logs where client_id=$1 and name='Coach added oats'", [IDS.ana]))[0]
    ok(!!row && row.k === 300 && row.p === 12, 'food diary: the coach adds a food entry for the client on any day')
    await diary.getByRole('button', { name: /^Edit Coach added oats on/ }).click()
    await sheet.getByLabel('Calories').fill('350')
    await sheet.getByRole('button', { name: 'Save', exact: true }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet'))
    row = (await sql("select kcal::float k from food_logs where client_id=$1 and name='Coach added oats'", [IDS.ana]))[0]
    ok(row.k === 350, 'food diary: the coach edits an entry')
    await diary.getByRole('button', { name: 'Previous week' }).click()
    ok(await diary.getByRole('button', { name: /^Edit Coach added oats/ }).count() === 0, 'food diary: scrolling back a week shows that week')
    await diary.getByRole('button', { name: 'Back to this week' }).click()
    await diary.getByRole('button', { name: /^Edit Coach added oats on/ }).click()
    await sheet.getByRole('button', { name: 'Delete entry' }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet'))
    ok((await sql("select count(*)::int n from food_logs where client_id=$1 and name='Coach added oats'", [IDS.ana]))[0].n === 0, 'food diary: the coach deletes an entry')
    await shot(coach.page, 'coach-food-diary')

    // daily check-ins on the client Overview
    await coach.page.goto(BASE + '/clients/' + IDS.ana + '?tab=overview', { waitUntil: 'networkidle' })
    const ci = coach.page.getByRole('region', { name: 'Daily check-ins' })
    await ci.getByRole('button', { name: 'Add check-in' }).click()
    await sheet.getByLabel('Mood').selectOption('4')
    await sheet.getByLabel('Note').fill('Coach wrote this')
    await sheet.getByRole('button', { name: 'Save', exact: true }).click()
    await ci.getByText(/Coach wrote this/).waitFor()
    ok((await sql("select mood from checkins where client_id=$1 and note='Coach wrote this'", [IDS.ana]))[0]?.mood === 4, 'daily check-ins: the coach adds a check-in for a day')
    await ci.getByRole('button', { name: /^Edit check-in on/ }).first().click()
    await sheet.getByLabel('Energy').selectOption('5')
    await sheet.getByRole('button', { name: 'Save', exact: true }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet'))
    ok((await sql("select energy from checkins where client_id=$1 and note='Coach wrote this'", [IDS.ana]))[0].energy === 5, 'daily check-ins: the coach corrects a check-in')
    await ci.getByRole('button', { name: /^Edit check-in on/ }).first().click()
    await sheet.getByRole('button', { name: 'Delete check-in' }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet'))
    ok((await sql("select count(*)::int n from checkins where client_id=$1 and note='Coach wrote this'", [IDS.ana]))[0].n === 0, 'daily check-ins: the coach deletes a check-in')

    // weekly check-in
    const wk = coach.page.getByRole('region', { name: 'Weekly check-in' })
    await wk.locator('summary').click()
    await wk.getByRole('button', { name: 'Add a check-in for this week' }).click()
    for (const t of await sheet.locator('textarea').all()) await t.fill('Coach entered')
    await sheet.getByLabel('Average sleep (hours per night)').fill('7')
    await sheet.getByRole('button', { name: 'Save weekly check-in' }).click()
    await wk.getByRole('button', { name: 'Edit their answers' }).waitFor()
    ok((await sql("select count(*)::int n from weekly_checkins where client_id=$1", [IDS.ana]))[0].n === 1, 'weekly check-in: the coach adds one for a week the client missed')
    await wk.getByRole('button', { name: 'Edit their answers' }).click()
    await sheet.locator('textarea').first().fill('Coach corrected')
    await sheet.getByRole('button', { name: 'Save weekly check-in' }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet'))
    ok((await sql("select training from weekly_checkins where client_id=$1", [IDS.ana]))[0].training === 'Coach corrected', 'weekly check-in: the coach edits the answers')
    await wk.getByRole('button', { name: 'Edit their answers' }).click()
    await sheet.getByRole('button', { name: 'Delete this weekly check-in' }).click()
    await wk.getByRole('button', { name: 'Add a check-in for this week' }).waitFor()
    ok((await sql("select count(*)::int n from weekly_checkins where client_id=$1", [IDS.ana]))[0].n === 0, 'weekly check-in: the coach deletes one')
    clean('coach edit logs', coach.errors); await coach.ctx.close()
  } finally {
    await sql("delete from food_logs where client_id=$1 and name = 'Coach added oats'", [IDS.ana])
    await sql("delete from checkins where client_id=$1 and note = 'Coach wrote this'", [IDS.ana])
    await sql("delete from weekly_checkins where client_id=$1 and training in ('Coach entered','Coach corrected')", [IDS.ana])
  }
}
