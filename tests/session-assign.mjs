export async function sessionAssignChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  console.log('Coach books a client into a session')
  const start = new Date(Date.now() + 3 * 86400000).toISOString()
  const slot = (await sql("insert into sessions(starts_at,duration_min,title) values($1,45,'Assigned PT session') returning id", [start]))[0].id
  await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now()) on conflict (client_id) do nothing", [IDS.ana])
  try {
    const coach = await open('coach', { w: 1280, h: 900 })
    await coach.page.goto(BASE + '/slots', { waitUntil: 'networkidle' })
    const row = coach.page.locator('.session-row').filter({ hasText: '45 min' })
    await row.waitFor()
    ok(await row.getByText('Open', { exact: true }).count() === 1, 'sessions: an open slot offers a client picker')
    ok(await row.getByRole('button', { name: /Add client/ }).isDisabled(), 'sessions: Add client waits for a choice')
    await row.getByRole('combobox').selectOption({ label: 'Ana Silva' })
    await row.getByRole('button', { name: /Add client/ }).click()
    await row.getByText('Booked: Ana Silva').waitFor()
    ok((await sql('select 1 from bookings where session_id=$1 and client_id=$2', [slot, IDS.ana])).length === 1, 'sessions: coach adds a client to a session')
    ok(await row.getByRole('combobox').count() === 0 && await row.getByRole('button', { name: /Remove/ }).count() === 1, 'sessions: a booked slot offers Remove client instead')
    await shot(coach.page, 'coach-session-assigned')

    const client = await open('ana', { w: 390, h: 844 })
    await client.page.getByText('Assigned PT session', { exact: true }).waitFor()
    ok(await client.page.locator('a', { hasText: 'Assigned PT session' }).count() === 0, 'sessions: the client sees the session on Home without a booking link')
    await client.page.goto(BASE + '/book', { waitUntil: 'networkidle' })
    ok(new URL(client.page.url()).pathname === '/home', 'sessions: the old booking page redirects clients home')
    clean('session assign client', client.errors); await client.ctx.close()

    await row.getByRole('button', { name: /Remove/ }).click()
    await row.getByText('Open', { exact: true }).waitFor()
    ok((await sql('select 1 from bookings where session_id=$1', [slot])).length === 0, 'sessions: coach removes the client again')
    clean('session assign coach', coach.errors); await coach.ctx.close()
  } finally {
    await sql('delete from sessions where id=$1', [slot])
    await sql('delete from client_health where client_id=$1', [IDS.ana])
  }
}
