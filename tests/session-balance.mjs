export async function sessionBalanceChecks({ open, sql, IDS, BASE, clean, ok }) {
  await sql('delete from client_session_credits where client_id=$1', [IDS.ana])
  const coach = await open('coach', { w: 1280, h: 860 })
  const { page, errors } = coach
  await page.goto(`${BASE}/clients/${IDS.ana}`, { waitUntil: 'networkidle' })
  const balance = page.locator('.tile').filter({ hasText: 'Sessions left' })
  ok(await balance.getByText('0', { exact: true }).count() === 1, 'sessions: new client starts with no paid sessions')
  await balance.getByRole('button', { name: 'Add sessions', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Add paid sessions', exact: true })
  await sheet.getByLabel('Sessions to add', { exact: true }).fill('6')
  await sheet.getByRole('button', { name: 'Add sessions', exact: true }).click()
  await sheet.getByText('6 sessions added.', { exact: true }).waitFor()
  ok((await sql('select sessions_purchased from client_session_credits where client_id=$1', [IDS.ana]))[0].sessions_purchased === 6, 'sessions: coach adds a paid allowance')
  await sheet.getByRole('button', { name: 'Close', exact: true }).click()
  await balance.getByText('0 completed � 6 purchased', { exact: true }).waitFor()

  const workout = (await sql("insert into workouts(name,created_by) values('Session credit fixture',$1) returning id", [IDS.coach]))[0].id
  const assigned = (await sql("insert into client_workouts(client_id,workout_id,date,status,completed_at) values($1,$2,current_date,'done',now()) returning id", [IDS.ana, workout]))[0].id
  await page.reload({ waitUntil: 'networkidle' })
  const updated = page.locator('.tile').filter({ hasText: 'Sessions left' })
  ok(await updated.getByText('5', { exact: true }).count() === 1 && await updated.getByText('1 completed � 6 purchased', { exact: true }).count() === 1, 'sessions: completed training automatically reduces the balance')

  const client = await open('ana')
  await client.page.goto(BASE + '/', { waitUntil: 'networkidle' })
  const clientBalance = client.page.locator('.tile').filter({ hasText: 'Sessions left' })
  ok(await clientBalance.getByText('5', { exact: true }).count() === 1 && await clientBalance.getByText('1 completed � 6 purchased', { exact: true }).count() === 1, 'sessions: client overview shows the same balance')
  clean('session balance coach', errors)
  clean('session balance client', client.errors)
  await client.ctx.close(); await coach.ctx.close()
  await sql('delete from client_workouts where id=$1', [assigned])
  await sql('delete from workouts where id=$1', [workout])
  await sql('delete from client_session_credits where client_id=$1', [IDS.ana])
}

