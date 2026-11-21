// Coach: the client's Training tab has a week calendar, every session can be edited, and the client cannot edit assigned ones.
export async function trainingEditChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  console.log('Coach edits the client Training tab')
  const iso = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }
  // Weekday-proof: dates relative to this week's Monday, so the calendar steps below do not depend on the day the tests run.
  const monOff = -((new Date().getDay() + 6) % 7)
  const inWeek = (weeks, dayInWeek) => iso(monOff + weeks * 7 + dayInWeek)
  const wid = (await sql("insert into workouts(name, created_by) values('Edit test workout', $1) returning id", [IDS.coach]))[0].id
  const wid2 = (await sql("insert into workouts(name, created_by) values('Swap test workout', $1) returning id", [IDS.coach]))[0].id
  const ins = async (date, status = 'scheduled') => (await sql("insert into client_workouts(client_id, workout_id, date, status) values($1,$2,$3,$4) returning id", [IDS.ana, wid, date, status]))[0].id
  const past = await ins(inWeek(-3, 2)), later = await ins(inWeek(2, 2)), soon = await ins(iso(0))
  await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now()) on conflict (client_id) do nothing", [IDS.ana])
  try {
    const coach = await open('coach', { w: 1280, h: 900 })
    await coach.page.goto(BASE + '/clients/' + IDS.ana + '?tab=training', { waitUntil: 'networkidle' })
    const cal = coach.page.getByRole('region', { name: 'Workout calendar' })
    await cal.waitFor()
    ok(await cal.getByRole('button', { name: /^Open Edit test workout on/ }).count() === 1, 'training: the calendar shows this week\'s session')
    // scroll forward to the week 12 days out, back to 20 days ago
    await cal.getByRole('button', { name: 'Next week' }).click(); await cal.getByRole('button', { name: 'Next week' }).click()
    ok(await cal.getByRole('button', { name: /^Open Edit test workout on/ }).count() === 1, 'training: scrolling forward shows a later week\'s session')
    await cal.getByRole('button', { name: 'Back to this week' }).click()
    for (let i = 0; i < 3; i++) await cal.getByRole('button', { name: 'Previous week' }).click()
    ok(await cal.getByRole('button', { name: /^Open Edit test workout on/ }).count() === 1 && await cal.locator('.cal-chip', { hasText: 'Missed' }).count() === 1, 'training: scrolling back shows a past session marked Missed')
    // He did the session after all: mark it done
    await cal.getByRole('button', { name: /^Open Edit test workout on/ }).click()
    const sheet = coach.page.locator('.sheet')
    await sheet.getByLabel('Status').selectOption('done')
    await sheet.getByRole('button', { name: 'Save changes' }).click()
    await cal.locator('.cal-chip', { hasText: 'Done' }).waitFor()
    const row = (await sql('select status, completed_at from client_workouts where id=$1', [past]))[0]
    ok(row.status === 'done' && row.completed_at !== null, 'training: a session marked Missed can be corrected to Done')
    // Move the upcoming one and change its workout
    await cal.getByRole('button', { name: 'Back to this week' }).click()
    await cal.getByRole('button', { name: /^Open Edit test workout on/ }).click()
    await sheet.getByLabel('Date', { exact: true }).fill(iso(5))
    await sheet.getByRole('button', { name: 'Change workout' }).click()
    await coach.page.getByText('Swap test workout').first().click()
    await sheet.getByRole('button', { name: 'Save changes' }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet input[type=date]'))
    const moved = (await sql('select date::text, workout_id from client_workouts where id=$1', [soon]))[0]
    ok(moved.date === iso(5) && moved.workout_id === wid2, 'training: a session can be moved to another day and given a different workout')
    // Mark one missed, then back to scheduled, via the list buttons
    await coach.page.getByRole('button', { name: /^Edit Edit test workout on/ }).first().click()
    await sheet.getByLabel('Status').selectOption('skipped')
    await sheet.getByRole('button', { name: 'Save changes' }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet input[type=date]'))
    ok((await sql('select status from client_workouts where id=$1', [later]))[0].status === 'skipped' || (await sql("select count(*)::int n from client_workouts where client_id=$1 and status='skipped'", [IDS.ana]))[0].n >= 1, 'training: a session can be marked Missed')
    await shot(coach.page, 'coach-training-calendar')

    // Repeat what the client did over the last two weeks onto the next two weeks.
    await sql("delete from client_workouts where client_id=$1 and workout_id = any($2)", [IDS.ana, [wid, wid2]])
    const r1 = await ins(iso(-10), 'done'), r2 = (await sql("insert into client_workouts(client_id, workout_id, date, status) values($1,$2,$3,'done') returning id", [IDS.ana, wid2, iso(-8)]))[0].id
    await coach.page.goto(BASE + '/clients/' + IDS.ana + '?tab=training', { waitUntil: 'networkidle' })
    await coach.page.getByRole('button', { name: 'Repeat sessions' }).click()
    const rsheet = coach.page.locator('.sheet')
    await rsheet.getByRole('button', { name: 'Last 4 weeks' }).click()
    ok(await rsheet.getByRole('checkbox', { checked: true }).count() === 2, 'repeat: the sessions from the last weeks are ticked')
    const start = (() => { const d = new Date(); d.setDate(d.getDate() + 7 - ((d.getDay() + 6) % 7) + 1); return d.toLocaleDateString('en-CA') })() // Tuesday of next week
    await rsheet.locator('input[type=date]').fill(start)
    await rsheet.locator('select').selectOption('2')
    await rsheet.getByText(/4 sessions will be added/).waitFor()
    await rsheet.getByRole('button', { name: 'Add to schedule' }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet'))
    const added = await sql("select workout_id, date::text d, status from client_workouts where client_id=$1 and date >= $2 order by date", [IDS.ana, start])
    const plus = n => { const d = new Date(start + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }
    ok(added.length === 4 && added.every(a => a.status === 'scheduled') && added[0].d === start && added[1].d === plus(2) && added[2].d === plus(7) && added[3].d === plus(9) && added[0].workout_id === wid && added[1].workout_id === wid2, 'repeat: the block is copied twice from the chosen date with the same spacing, as scheduled sessions')
    // Repeating the same block again does not double up.
    await coach.page.getByRole('button', { name: 'Repeat sessions' }).click()
    await rsheet.getByRole('button', { name: 'Last 4 weeks' }).click()
    await rsheet.locator('input[type=date]').fill(start)
    await rsheet.locator('select').selectOption('2')
    await rsheet.getByRole('button', { name: 'Add to schedule' }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet'))
    ok((await sql("select count(*)::int n from client_workouts where client_id=$1 and date >= $2", [IDS.ana, start]))[0].n === 4, 'repeat: repeating the same block twice never double-books a day')
    // Repeat one session from its Edit sheet, weekly for three weeks.
    await coach.page.getByRole('button', { name: /^Edit Edit test workout on/ }).first().click()
    await coach.page.locator('.sheet summary', { hasText: 'Repeat this session' }).click()
    const one = (() => { const d = new Date(start + 'T12:00:00'); d.setDate(d.getDate() + 20); return d.toLocaleDateString('en-CA') })()
    await coach.page.locator('.sheet input[aria-label="Repeat on date"]').fill(one)
    await coach.page.locator('.sheet select[aria-label="Repeat how many times"]').selectOption('3')
    await coach.page.getByRole('button', { name: 'Add repeats' }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet'))
    const weekly = await sql("select date::text d from client_workouts where client_id=$1 and workout_id=$2 and date >= $3 order by date", [IDS.ana, wid, one])
    ok(weekly.length === 3 && weekly[1].d !== weekly[0].d, 'repeat: one session can be repeated weekly from its Edit sheet')
    void r1; void r2
    const forClient = await ins(iso(1))

    // The coach can correct the numbers of a finished session, and fill an empty one from the plan.
    const item = (await sql("insert into workout_items(workout_id, exercise_name, sort, sets, reps) values($1,'Numbers test lift',0,2,'8') returning id", [wid]))[0].id
    const done = await ins(iso(-3), 'done')
    await sql("update client_workouts set log = $2::jsonb, completed_at = now() where id = $1", [done, JSON.stringify({ items: { [item]: [{ reps: '8', kg: '50', done: true }, { reps: '8', kg: '50', done: true }] } })])
    await coach.page.goto(BASE + '/workout/' + done + '?returnTo=' + encodeURIComponent('/clients/' + IDS.ana + '?tab=training'), { waitUntil: 'networkidle' })
    const nums = coach.page.locator('.exercise-block input[type=number]')
    await nums.first().waitFor()
    ok(await nums.first().isEnabled(), 'numbers: the coach can edit the sets of a finished session')
    await nums.first().fill('77')
    let saved = null
    for (let i = 0; i < 20 && !saved; i++) { await coach.page.waitForTimeout(300); const l = (await sql('select log from client_workouts where id=$1', [done]))[0].log; if (l.items[item][0].kg === '77') saved = l }
    ok(!!saved && saved.items[item][1].kg === '50', 'numbers: a changed weight on a finished session is saved, the other sets untouched')
    ok(await coach.page.getByRole('button', { name: /Finish workout|Skip/ }).count() === 0, 'numbers: the coach edit view has no Finish or Skip button')
    const blank = await ins(iso(-4), 'done')
    await coach.page.goto(BASE + '/workout/' + blank, { waitUntil: 'networkidle' })
    await coach.page.getByRole('button', { name: 'Fill from the plan' }).click()
    for (let i = 0; i < 20; i++) { await coach.page.waitForTimeout(300); const l = (await sql('select log from client_workouts where id=$1', [blank]))[0].log; if (l.items?.[item]?.length === 2) break }
    const filled = (await sql('select log from client_workouts where id=$1', [blank]))[0].log
    ok(filled.items?.[item]?.length === 2 && filled.items[item][0].reps === '8' && filled.items[item][0].done === true, 'numbers: a session done without logging can be filled from the plan')
    clean('training edit coach', coach.errors); await coach.ctx.close()

    // The client sees the same plan, but cannot skip or reschedule what the coach assigned.
    const client = await open('ana', { w: 390, h: 844 })
    await client.page.goto(BASE + '/train', { waitUntil: 'networkidle' })
    await client.page.getByRole('button', { name: 'Previous week' }).waitFor()
    await client.page.goto(BASE + '/workout/' + forClient, { waitUntil: 'networkidle' })
    await client.page.getByRole('button', { name: /Finish workout/ }).waitFor()
    ok(await client.page.getByRole('button', { name: 'Skip', exact: true }).count() === 0, 'training: a client cannot skip a workout the coach assigned')
    clean('training edit client', client.errors); await client.ctx.close()
  } finally {
    await sql('delete from client_workouts where client_id=$1 and workout_id = any($2)', [IDS.ana, [wid, wid2]])
    await sql('delete from workout_items where workout_id = $1', [wid])
    await sql('delete from workouts where id = any($1)', [[wid, wid2]])
    await sql('delete from client_health where client_id=$1', [IDS.ana])
  }
}
