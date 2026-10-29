import assert from 'node:assert/strict'

// Shared by the existing DB and browser harnesses; no new dependencies.
export async function weeklyDbChecks(db, ids, ok) {
  const { coach: C, ana: A, bo: B } = ids
  async function as(who, query, params = []) {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claims', $1, false)", [who ? JSON.stringify({ sub: who, role: 'authenticated' }) : ''])
    await db.exec(who ? 'set role authenticated' : 'set role anon')
    try { return { rows: (await db.query(query, params)).rows } }
    catch (e) { return { error: e.message } }
    finally { await db.exec('reset role') }
  }
  const submit = (who, client = who, week = '2026-10-19', energy = 4) => as(who,
    "insert into weekly_checkins (client_id,week_start,training,nutrition,sleep_hours,energy,biggest_win,difficulties) values ($1,$2,'Good sessions','Consistent meals',7.5,$3,'Stronger squat','Busy at work') returning id",
    [client, week, energy])
  const a = await submit(A)
  ok(!a.error && a.rows.length === 1, 'weekly: client submits own answers')
  const id = a.rows[0].id
  ok(!!(await submit(A)).error, 'weekly: duplicate week rejected')
  ok(!!(await submit(B, A, '2026-10-12')).error, 'weekly: cannot submit for another client')
  ok(!!(await submit(C, A, '2026-10-12')).error, 'weekly: coach cannot impersonate a client')
  ok(!!(await submit(A, A, '2026-10-20')).error, 'weekly: week must start Monday')
  ok(!!(await submit(A, A, '2026-10-12', 6)).error, 'weekly: invalid energy rejected')
  ok(!!(await as(A, "update weekly_checkins set training='Changed' where id=$1", [id])).error, 'weekly: submissions are immutable')
  ok(!!(await as(A, 'delete from weekly_checkins where id=$1', [id])).error, 'weekly: client cannot delete submissions')
  ok((await as(B, 'select * from weekly_checkins where id=$1', [id])).rows.length === 0, 'weekly: another client cannot read answers')
  ok((await as(C, 'select * from weekly_checkins where id=$1', [id])).rows.length === 1, 'weekly: coach reads answers')
  ok(!!(await as(null, 'select * from weekly_checkins')).error, 'weekly: anonymous cannot read answers')
  const review = "insert into weekly_reviews (checkin_id,feedback,next_focus) values ($1,'Good consistency','Keep three sessions')"
  ok(!!(await as(A, review, [id])).error, 'weekly: client cannot write coach feedback')
  ok(!(await as(C, review, [id])).error, 'weekly: coach leaves feedback and focus')
  ok((await as(A, 'select * from weekly_reviews where checkin_id=$1', [id])).rows.length === 1, 'weekly: client reads own feedback')
  ok((await as(B, 'select * from weekly_reviews where checkin_id=$1', [id])).rows.length === 0, 'weekly: other client cannot read feedback')
  ok(!!(await as(null, 'select * from weekly_reviews')).error, 'weekly: anonymous cannot read feedback')
  ok((await as(A, "update weekly_reviews set feedback='Spoof' where checkin_id=$1 returning *", [id])).rows?.length === 0, 'weekly: client cannot change coach feedback')
  ok((await as(C, "update weekly_reviews set next_focus='Updated focus' where checkin_id=$1 returning *", [id])).rows?.length === 1, 'weekly: coach updates review')
  ok(!!(await as(C, "update weekly_reviews set feedback=' ' where checkin_id=$1", [id])).error, 'weekly: blank feedback rejected')
  ok(!!(await as(C, 'delete from weekly_reviews where checkin_id=$1', [id])).error, 'weekly: no accidental review deletion')
  await db.query('delete from weekly_checkins where id=$1', [id])
  ok((await db.query('select * from weekly_reviews where checkin_id=$1', [id])).rows.length === 0, 'weekly: deleting submission cascades review')
}

export async function weeklyBrowserChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  const { ctx, page, errors } = await open('ana')
  const weekly = page.getByRole('region', { name: 'Weekly check-in', exact: true })
  await weekly.getByRole('button', { name: 'Complete weekly check-in', exact: true }).waitFor()
  const week = await weekly.getByLabel('Review week').inputValue()
  const monday = new Date(week + 'T12:00:00')
  ok(monday.getDay() === 1, 'weekly: dates start Monday on any weekday')
  ok(await page.getByRole('heading', { name: 'Daily check-in', exact: true }).count() === 1, 'weekly: daily form preserved')
  await weekly.getByRole('button', { name: 'Complete weekly check-in', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Complete weekly check-in' })
  await form.getByLabel('How did training go?').fill('Completed my planned sessions.')
  await form.getByLabel('How did nutrition go?').fill('Prepared lunches ahead.')
  await form.getByLabel('Biggest win').fill('More consistent this week.')
  await form.getByLabel('Difficulties or support needed').fill('Busy evenings.')
  await form.getByLabel('Average sleep (hours per night)', { exact: true }).fill('7.5')
  await form.getByLabel('Average energy').selectOption('4')
  // A failed save must preserve answers and allow a retry.
  await page.route('**/rest/v1/weekly_checkins*', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Temporarily unavailable"}' }) : route.continue())
  await form.getByRole('button', { name: 'Submit weekly check-in', exact: true }).click()
  await form.getByRole('alert').waitFor()
  ok(await form.getByLabel('Biggest win').inputValue() === 'More consistent this week.', 'weekly: failed submission keeps answers')
  await page.unroute('**/rest/v1/weekly_checkins*')
  errors.splice(0, errors.length, ...errors.filter(e => !/503/.test(e)))
  await shot(page, 'weekly-form-phone')
  await form.getByRole('button', { name: 'Submit weekly check-in', exact: true }).click()
  await weekly.getByText('Awaiting coach review', { exact: true }).waitFor()
  ok(await weekly.getByRole('button', { name: 'Complete weekly check-in', exact: true }).count() === 0, 'weekly: duplicate submission not offered')
  await page.reload({ waitUntil: 'networkidle' })
  await weekly.getByText('More consistent this week.', { exact: true }).waitFor()
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'weekly: client fits phone width')
  await shot(page, 'weekly-client-submitted-phone')
  const checkin = (await sql('select id from weekly_checkins where client_id=$1 and week_start=$2', [IDS.ana, week]))[0]
  ok(!!checkin, 'weekly: submission persists')
  clean('weekly client', errors)
  await ctx.close()

  const coach = await open('coach', { w: 1280, h: 860 })
  const queue = coach.page.getByRole('region', { name: 'Weekly reviews', exact: true })
  await queue.getByRole('link', { name: /Ana Silva/ }).waitFor()
  await queue.getByRole('link', { name: /Ana Silva/ }).click()
  const review = coach.page.getByRole('region', { name: 'Weekly check-in', exact: true })
  await review.getByText('Weekly check-in', { exact: true }).click()
  await review.getByLabel('Coach feedback').waitFor()
  ok(await review.getByLabel('Review week').inputValue() === week, 'weekly: queue opens correct week')
  await review.getByLabel('Coach feedback').fill('Great consistency. Keep your preparation routine.')
  await review.getByLabel("Next week's focus").fill('Plan three training sessions.')
  await review.getByRole('button', { name: 'Send weekly review', exact: true }).click()
  await review.getByText('Weekly review saved and visible to your client.', { exact: true }).waitFor()
  await review.getByLabel('Coach feedback').fill('Excellent consistency. Keep your preparation routine.')
  await review.getByRole('button', { name: 'Update weekly review', exact: true }).click()
  await review.getByText('Weekly review saved and visible to your client.', { exact: true }).waitFor()
  ok((await sql('select feedback from weekly_reviews where checkin_id=$1', [checkin.id]))[0].feedback.startsWith('Excellent'), 'weekly: coach can update feedback')
  await coach.page.setViewportSize({ width: 390, height: 844 })
  ok(await coach.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'weekly: coach review fits phone width')
  await shot(coach.page, 'weekly-coach-review-phone')
  await coach.page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await coach.page.getByRole('region', { name: 'Weekly reviews', exact: true }).getByText('No pending reviews among the latest 100 check-ins.', { exact: true }).waitFor()
  ok(true, 'weekly: reviewed submission leaves pending list')
  clean('weekly coach', coach.errors)
  await coach.ctx.close()

  const client = await open('ana')
  const feedback = client.page.getByRole('region', { name: 'Weekly check-in', exact: true })
  await feedback.getByText('Excellent consistency. Keep your preparation routine.', { exact: true }).waitFor()
  await feedback.getByText('Plan three training sessions.', { exact: true }).waitFor()
  ok(true, 'weekly: client sees coach feedback and next focus after reload')
  await feedback.locator('summary').click()
  ok(!(await feedback.getByText('Plan three training sessions.', { exact: true }).isVisible()), 'weekly: client can minimise the check-in box')
  await feedback.locator('summary').click()
  ok(await feedback.getByText('Plan three training sessions.', { exact: true }).isVisible(), 'weekly: client can expand the check-in box again')
  await shot(client.page, 'weekly-client-feedback-phone')
  // Past weeks can be reviewed; future weeks are never offered.
  const options = await feedback.getByLabel('Review week').locator('option').evaluateAll(os => os.map(o => o.value))
  ok(options.every(w => w <= week), 'weekly: no future weeks offered')
  await feedback.getByLabel('Review week').selectOption(options[1])
  await feedback.getByRole('button', { name: 'Complete weekly check-in', exact: true }).waitFor()
  ok(true, 'weekly: previous week remains available for late submission')
  clean('weekly feedback', client.errors)
  await client.ctx.close()
  assert.ok(checkin.id)
}

