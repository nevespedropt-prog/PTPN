// The coach starts a ready-made challenge in one tap; a client logs progress and sees it complete.
export async function challengeIdeasBrowserChecks({ open, sql, IDS, BASE, shot, ok }) {
  console.log('Challenge ideas')
  await sql("delete from challenges where name = 'The Hundred Club'")
  const hadConsent = (await sql('select 1 from client_health where client_id=$1', [IDS.ana])).length > 0
  if (!hadConsent) await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now())", [IDS.ana])
  try {
    const coach = await open('coach', { w: 430, h: 900 })
    await coach.page.goto(BASE + '/community?tab=challenges', { waitUntil: 'networkidle' })
    await coach.page.getByRole('button', { name: 'Challenge ideas' }).click()
    await coach.page.locator('.sheet').getByText('Press-up Staircase', { exact: true }).waitFor()
    await shot(coach.page, 'challenge-ideas')
    await coach.page.getByRole('button', { name: 'Start The Hundred Club' }).click()
    await coach.page.locator('.sheet').waitFor({ state: 'hidden' })
    const row = (await sql("select goal::int g, unit, end_date - start_date d from challenges where name = 'The Hundred Club'"))[0]
    ok(row && row.g === 100 && row.unit === 'press-ups' && Number(row.d) === 7, 'challenges: the coach starts a ready-made challenge in one tap')
    const client = await open('ana', { w: 430, h: 900 })
    await client.page.goto(BASE + '/community?tab=challenges', { waitUntil: 'networkidle' })
    await client.page.getByText('The Hundred Club', { exact: true }).click()
    await client.page.getByPlaceholder(/Add press-ups/).fill('100')
    await client.page.getByRole('button', { name: 'Log', exact: true }).click()
    await client.page.getByText('Challenge complete').waitFor()
    await shot(client.page, 'challenge-complete')
    ok(true, 'challenges: the client sees Challenge complete at the goal')
  } finally { if (!hadConsent) await sql('delete from client_health where client_id=$1', [IDS.ana])
    await sql("delete from challenges where name = 'The Hundred Club'") }
}
