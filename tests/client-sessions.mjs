// Coach side: a client's sessions appear on their page, and a session can be moved to another day.
export async function clientSessionDbChecks({ db, ok, as, IDS }) {
  const A = IDS.ana, C = IDS.coach
  const soon = new Date(Date.now() + 2 * 86400000).toISOString()
  const later = new Date(Date.now() + 5 * 86400000).toISOString()
  const sid = (await db.query("insert into sessions(starts_at,duration_min,title) values($1,45,'Move test') returning id", [soon])).rows[0].id
  await db.query('insert into bookings(session_id, client_id, reminder_sent_at) values($1,$2, now())', [sid, A])
  const moved = await as(C, `update sessions set starts_at = '${later}' where id = '${sid}' returning id`)
  ok(!moved.error && moved.rows.length === 1, 'v38: the coach can move a booked session to another day')
  ok((await db.query('select reminder_sent_at from bookings where session_id=$1', [sid])).rows[0].reminder_sent_at === null, 'v38: moving a session re-arms the reminder for the new time')
  await db.query("update bookings set reminder_sent_at = now() where session_id=$1", [sid])
  await as(C, `update sessions set title = 'Renamed' where id = '${sid}'`)
  ok((await db.query('select reminder_sent_at from bookings where session_id=$1', [sid])).rows[0].reminder_sent_at !== null, 'v38: changing something other than the time leaves the reminder alone')
  const clientMove = await as(A, `update sessions set starts_at = now() + interval '9 days' where id = '${sid}' returning id`)
  ok(!clientMove.error && clientMove.rows.length === 0, 'v38: a client cannot move a session')
  await db.query('delete from sessions where id=$1', [sid])
}

export async function clientSessionBrowserChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  console.log('Coach sees and moves a client session')
  const t1 = new Date(Date.now() + 3 * 86400000), t2 = new Date(Date.now() + 4 * 86400000)
  t1.setMinutes(0, 0, 0); t2.setMinutes(0, 0, 0)
  const past = new Date(Date.now() - 3 * 86400000)
  const ids = []
  for (const [t, title] of [[t1, 'Upcoming move test'], [past, 'Past move test']]) {
    const id = (await sql("insert into sessions(starts_at,duration_min,title) values($1,45,$2) returning id", [t.toISOString(), title]))[0].id
    await sql('insert into bookings(session_id, client_id) values($1,$2)', [id, IDS.ana]); ids.push(id)
  }
  await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now()) on conflict (client_id) do nothing", [IDS.ana])
  const other = (await sql("insert into sessions(starts_at,duration_min,title) values($1,60,'Other client slot') returning id", [t2.toISOString()]))[0].id
  try {
    const coach = await open('coach', { w: 1280, h: 900 })
    await coach.page.goto(BASE + '/clients/' + IDS.ana, { waitUntil: 'networkidle' })
    const card = coach.page.getByRole('region', { name: 'Client sessions' })
    await card.getByText('Upcoming move test').waitFor()
    ok(await card.getByText('1 upcoming').count() === 1 && await card.getByRole('button', { name: /^Edit session on/ }).count() === 1, 'client sessions: the coach sees the upcoming session with an Edit button')
    ok(!(await card.getByText('Past move test').isVisible()) && await card.getByText(/Past sessions \(1\)/).count() === 1, 'client sessions: past sessions are listed apart')
    await card.getByRole('button', { name: /^Edit session on/ }).first().click()
    const sheet = coach.page.locator('.sheet')
    const input = sheet.locator('input[type=datetime-local]')
    // A clash with another session is refused.
    const pad = n => String(n).padStart(2, '0')
    const local = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    await input.fill(local(t2))
    await sheet.getByRole('button', { name: 'Save changes' }).click()
    await sheet.getByText(/overlaps another session/).waitFor()
    ok((await sql('select starts_at from sessions where id=$1', [ids[0]]))[0].starts_at.getTime() === t1.getTime(), 'client sessions: a clashing time is refused and nothing changes')
    // A free time works.
    const free = new Date(t1.getTime() + 6 * 86400000)
    await input.fill(local(free))
    await sheet.getByRole('button', { name: 'Save changes' }).click()
    await card.getByText(/Session moved to/).waitFor()
    ok((await sql('select starts_at from sessions where id=$1', [ids[0]]))[0].starts_at.getTime() === free.getTime(), 'client sessions: the session moves to the new day')
    await shot(coach.page, 'coach-client-sessions')
    // The coach Sessions page and the client Home follow.
    await coach.page.goto(BASE + '/slots', { waitUntil: 'networkidle' })
    ok(await coach.page.locator('.session-row').filter({ hasText: 'Booked: Ana Silva' }).count() >= 1, 'client sessions: the Sessions page still shows the booking')
    // Add a session, including one in the past.
    await coach.page.goto(BASE + '/clients/' + IDS.ana, { waitUntil: 'networkidle' })
    await card.getByRole('button', { name: 'Add session' }).click()
    await sheet.getByLabel('Session name').fill('Added by coach')
    await sheet.locator('input[type=datetime-local]').fill(local(new Date(Date.now() - 2 * 86400000 - 3600000 * 5)))
    await sheet.getByRole('button', { name: 'Add session', exact: true }).click()
    await card.getByText(/Session added for/).waitFor()
    const added = (await sql("select s.id from sessions s join bookings b on b.session_id = s.id where s.title = 'Added by coach' and b.client_id = $1", [IDS.ana]))
    ok(added.length === 1, 'client sessions: the coach can add a session for the client, even one in the past')
    await sql('delete from sessions where title = $1', ['Added by coach'])
    clean('client sessions coach', coach.errors); await coach.ctx.close()
    const client = await open('ana', { w: 390, h: 844 })
    // The client's Home shows their next booked session, whatever else is in their diary.
    const next = (await sql("select s.title, s.starts_at from sessions s join bookings b on b.session_id = s.id where b.client_id = $1 and s.starts_at >= now() order by s.starts_at limit 1", [IDS.ana]))[0]
    await client.page.getByText(next.title, { exact: true }).first().waitFor()
    ok(true, 'client sessions: the client Home shows their next session')
    clean('client sessions client', client.errors); await client.ctx.close()
  } finally {
    await sql('delete from sessions where id = any($1)', [[...ids, other]])
    await sql('delete from client_health where client_id=$1', [IDS.ana])
  }
}
