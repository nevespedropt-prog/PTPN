// The coach can tick, untick and set numbers on a client's habit days, and edit or delete the habit itself.
export async function coachEditHabitsDbChecks({ db, ok, as, IDS }) {
  const A = IDS.ana, B = IDS.bo, C = IDS.coach
  const n = async (who, sql) => { const r = await as(who, sql + ' returning id'); return r.error ? 'ERR' : r.rows.length }
  const hA = (await db.query(`insert into habits(client_id, name, kind) values('${A}', 'v41 habit', 'check') returning id`)).rows[0].id
  const hB = (await db.query(`insert into habits(client_id, name, kind) values('${B}', 'v41 other habit', 'check') returning id`)).rows[0].id
  const log = await as(C, `insert into habit_logs(habit_id, client_id, date, value) values('${hA}', '${A}', current_date - 30, 1) returning id`)
  ok(!log.error && log.rows.length === 1, 'v41: the coach can tick a day for a client habit')
  const lid = log.rows[0].id
  ok(await n(C, `update habit_logs set value = 3 where id = '${lid}'`) === 1, 'v41: the coach can change a day')
  ok((await as(C, `insert into habit_logs(habit_id, client_id, date) values('${hB}', '${A}', current_date - 31)`)).error, 'v41: a coach entry must belong to that client\'s own habit')
  ok(!(await as(A, `insert into habit_logs(habit_id, client_id, date) values('${hA}', '${A}', current_date - 32)`)).error, 'v41: the client can still log their own habit')
  ok((await as(A, `insert into habit_logs(habit_id, client_id, date) values('${hB}', '${A}', current_date - 33)`)).error, 'v41: a client cannot log someone else\'s habit')
  ok(await n(B, `update habit_logs set value = 9 where id = '${lid}'`) === 0, 'v41: another client cannot change the day')
  ok(await n(B, `delete from habit_logs where id = '${lid}'`) === 0, 'v41: another client cannot delete the day')
  ok(await n(C, `delete from habit_logs where id = '${lid}'`) === 1, 'v41: the coach can untick a day')
  await db.query(`select set_config('request.jwt.claims', '', false)`)
  await db.query('delete from habits where id = any($1)', [[hA, hB]])
}

export async function coachEditHabitsBrowserChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  console.log('Coach edits habit days')
  const tick = (await sql("insert into habits(client_id, name, kind, sort) values($1,'Coach tick habit','check',0) returning id", [IDS.ana]))[0].id
  const num = (await sql("insert into habits(client_id, name, kind, unit, target, sort) values($1,'Coach number habit','number','L',3,1) returning id", [IDS.ana]))[0].id
  try {
    const coach = await open('coach', { w: 1280, h: 900 })
    await coach.page.goto(BASE + '/clients/' + IDS.ana + '?tab=habits', { waitUntil: 'networkidle' })
    const cell = coach.page.getByRole('button', { name: /^Tick Coach tick habit on/ }).last()
    await cell.waitFor()
    await cell.click()
    await coach.page.getByRole('button', { name: /^Untick Coach tick habit on/ }).waitFor()
    ok((await sql('select count(*)::int n from habit_logs where habit_id=$1', [tick]))[0].n === 1, 'habits: the coach ticks a day for the client')
    await coach.page.getByRole('button', { name: /^Untick Coach tick habit on/ }).click()
    await coach.page.getByRole('button', { name: /^Tick Coach tick habit on/ }).last().waitFor()
    await coach.page.waitForFunction(() => document.querySelectorAll('button[aria-label^="Untick"]').length === 0)
    ok((await sql('select count(*)::int n from habit_logs where habit_id=$1', [tick]))[0].n === 0, 'habits: the coach unticks a day')
    await coach.page.getByRole('button', { name: /^Edit Coach number habit on/ }).last().click()
    const sheet = coach.page.locator('.sheet')
    await sheet.getByLabel(/^Amount/).fill('2.5')
    await sheet.getByRole('button', { name: 'Save', exact: true }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet'))
    ok(Number((await sql('select value from habit_logs where habit_id=$1', [num]))[0]?.value) === 2.5, 'habits: the coach sets the number for a day')
    // go back a week and fill an earlier day
    await coach.page.getByRole('button', { name: 'Previous week' }).click()
    await coach.page.getByRole('button', { name: /^Tick Coach tick habit on/ }).first().click()
    await coach.page.getByRole('button', { name: /^Untick Coach tick habit on/ }).waitFor()
    const old = (await sql("select date::text d from habit_logs where habit_id=$1", [tick]))[0]
    ok(!!old && old.d < new Date(Date.now() - 6 * 86400000).toLocaleDateString('en-CA'), 'habits: scrolling back a week lets the coach fill an earlier day')
    await coach.page.getByRole('button', { name: 'Back to today' }).click()
    // edit and delete the habit
    await coach.page.getByRole('button', { name: 'Edit habit Coach number habit' }).click()
    await sheet.getByLabel('Name').fill('Coach water habit')
    await sheet.getByLabel('Goal').fill('4')
    await sheet.getByRole('button', { name: 'Save', exact: true }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet'))
    const h = (await sql('select name, target::float t from habits where id=$1', [num]))[0]
    ok(h.name === 'Coach water habit' && h.t === 4, 'habits: the coach edits a habit name and goal')
    await coach.page.getByRole('button', { name: 'Edit habit Coach water habit' }).click()
    await sheet.getByRole('button', { name: 'Delete habit' }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet'))
    ok((await sql('select count(*)::int n from habits where id=$1', [num]))[0].n === 0, 'habits: the coach deletes a habit')
    await shot(coach.page, 'coach-habits-edit')
    clean('coach edit habits', coach.errors); await coach.ctx.close()
  } finally {
    await sql('delete from habits where id = any($1)', [[tick, num]])
  }
}
