export async function dashboardBrowserChecks({ open, sql, IDS, shot, clean, ok }) {
  const today = new Date().toLocaleDateString('en-CA')
  const date = n => { const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }
  const monday = date(1 - ((new Date(today + 'T12:00:00').getDay() + 6) % 7 + 1))
  const workout = (await sql('select id from workouts limit 1'))[0].id
  const prefix = 'da500000-0000-4000-8000-'
  const id = n => prefix + String(n).padStart(12, '0')
  let context
  try {
    await sql('insert into client_archives(client_id) values($1)', [IDS.bo])
    for (const [n, client, status] of [[1, IDS.ana, 'done'], [2, IDS.bo, 'scheduled'], [3, IDS.bo, 'scheduled']]) {
      await sql('insert into client_workouts(id,client_id,workout_id,date,status) values($1,$2,$3,$4,$5)', [id(n), client, workout, today, status])
    }
    await sql('insert into checkins(id,client_id,date,mood) values($1,$2,$3,1),($4,$2,$5,5)', [id(4), IDS.ana, date(-1), id(5), today])
    await sql("insert into messages(id,client_id,sender_id,body) select ($1 || lpad(n::text,12,'0'))::uuid,$2,$2,'Dashboard test message' from generate_series(100,154) n", [prefix, IDS.bo])
    for (const [n, client] of [[6, IDS.ana], [7, IDS.bo]]) await sql("insert into weekly_checkins(id,client_id,week_start,training,nutrition,sleep_hours,energy,biggest_win,difficulties) values($1,$2,$3,'Training','Nutrition',8,4,'Win','None')", [id(n), client, monday])
    context = await open('coach', { w: 1280, h: 860 })
    const { page, errors } = context
    const actions = page.getByRole('region', { name: "Today's priorities", exact: true })
    const attention = page.getByRole('region', { name: 'Clients needing attention', exact: true })
    const tile = name => page.locator('.tile').filter({ has: page.getByText(name, { exact: true }) }).locator('.value')
    await actions.waitFor()
    ok(await tile('Active clients').innerText() === '1', 'dashboard counts only active clients')
    ok(await tile('Week compliance').innerText() === '100%', 'archived training does not affect weekly compliance')
    ok(await tile('Unread').innerText() === '55', 'dashboard includes unread conversations beyond the old 50 message cap')
    ok(await attention.getByText('Ana Silva', { exact: true }).count() === 0, 'latest recovered mood clears an older low mood flag')
    ok(await attention.getByText('Bo Jones', { exact: true }).count() === 0, 'archived client excluded from attention queue')
    await page.locator('#coach-activity').evaluate(element => { element.open = true })
    const inbox = page.getByRole('region', { name: 'Unread conversations', exact: true })
    ok(await inbox.getByRole('link').getAttribute('href') === '/inbox/' + IDS.bo, 'archived unread conversation keeps the correct reply link')
    await page.locator('#coach-reviews').evaluate(element => { element.open = true })
    const reviews = page.getByRole('region', { name: 'Weekly reviews', exact: true })
    await reviews.getByText('Ana Silva', { exact: true }).waitFor()
    ok(await reviews.getByText('Bo Jones', { exact: true }).count() === 0, 'review queue excludes archived client')
    ok((await reviews.getByRole('link').getAttribute('href')).includes('reviewWeek=' + monday), 'weekly review opens the submitted week')
    await actions.getByText('Weekly reviews', { exact: true }).waitFor()
    const ranked = await actions.locator('a.item .title').allTextContents()
    ok(ranked[0] === 'Unread messages' && ranked[1] === 'Weekly reviews', 'dashboard ranks replies before routine review work')
    for (const target of ['dashboard-inbox', 'weekly-reviews']) {
      await actions.locator(`a[href="#${target}"]`).click()
      ok(await page.evaluate(id => location.hash === '#' + id && !!document.getElementById(id), target), 'dashboard priority opens ' + target)
    }
    await sql('update checkins set mood=1 where id=$1', [id(5)])
    await sql('insert into weekly_reviews(checkin_id,feedback,next_focus) values($1,$2,$3)', [id(6), 'Reviewed', 'Next week'])
    await actions.getByRole('button', { name: 'Refresh dashboard' }).click()
    await attention.getByText('Latest check-in: low mood', { exact: true }).waitFor()
    await reviews.getByText('No pending reviews among the latest 100 check-ins.').waitFor()
    ok(await attention.getByText('Ana Silva', { exact: true }).count() === 1, 'refresh updates client attention and review queues together')
    ok(await attention.getByRole('link').getAttribute('href') === '/clients/' + IDS.ana, 'attention opens the correct client')
    ok(await actions.locator('a.item').first().getByText('Urgent client follow-up', { exact: true }).count() === 1, 'low mood follow-up becomes the highest-ranked priority')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.evaluate(() => window.scrollTo(0, 0))
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'dashboard actions fit phone width')
    await shot(page, 'coach-dashboard-actions-phone')
    for (const table of ['client_archives', 'profiles', 'messages']) {
      const pattern = `**/rest/v1/${table}?*`
      await page.route(pattern, r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Test read failure' }) }))
      await actions.getByRole('button', { name: 'Refresh dashboard' }).click()
      await page.getByRole('button', { name: 'Retry dashboard' }).waitFor()
      ok(await page.getByText('Everyone is on track.', { exact: true }).count() === 0, `${table} failure does not show a false all-clear`)
      await page.unroute(pattern)
      await page.getByRole('button', { name: 'Retry dashboard' }).click()
      await actions.waitFor()
    }
    // Mock only the read to prove a full API page is not presented as a complete total.
    await page.route('**/rest/v1/messages?*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(Array(1000).fill({ client_id: IDS.bo })) }))
    await actions.getByRole('button', { name: 'Refresh dashboard' }).click()
    await page.getByRole('button', { name: 'Retry dashboard' }).waitFor()
    ok(await page.getByRole('region', { name: "Today's priorities", exact: true }).count() === 0, 'potentially truncated response hides incomplete dashboard totals')
    await page.unroute('**/rest/v1/messages?*')
    await page.getByRole('button', { name: 'Retry dashboard' }).click()
    await actions.waitFor()
    // Injected 503 responses are intentional, browser error logging is checked after clearing them.
    errors.splice(0, errors.length, ...errors.filter(x => !x.includes('503')))
    clean('dashboard actions', errors)
  } finally {
    await context?.ctx.close()
    for (const table of ['weekly_checkins', 'messages', 'checkins', 'client_workouts']) await sql(`delete from ${table} where id::text like $1`, [prefix + '%'])
    await sql('delete from client_archives where client_id=$1', [IDS.bo])
  }
}

