// The coach can add, change and delete a client's body measurements.
export async function coachEditProgressDbChecks({ db, ok, as, IDS }) {
  const A = IDS.ana, B = IDS.bo, C = IDS.coach
  const n = async (who, sql) => { const r = await as(who, sql + ' returning id'); return r.error ? 'ERR' : r.rows.length }
  const ins = async (who, client, day) => (await as(who, `insert into measurements(client_id, date, weight_kg) values('${client}', current_date - ${day}, 80) returning id`)).rows?.[0]?.id
  const m1 = await ins(C, A, 40)
  ok(!!m1, 'v42: the coach can add a measurement for a client')
  ok(await n(C, `update measurements set weight_kg = 79 where id = '${m1}'`) === 1, 'v42: the coach can change a measurement')
  ok(await n(B, `delete from measurements where id = '${m1}'`) === 0, 'v42: another client cannot delete it')
  ok(await n(C, `delete from measurements where id = '${m1}'`) === 1, 'v42: the coach can delete a measurement')
  const m2 = await ins(A, A, 41)
  ok(await n(A, `delete from measurements where id = '${m2}'`) === 1, 'v42: a client can still delete their own measurement')
  await db.query(`select set_config('request.jwt.claims', '', false)`)
}

export async function coachEditProgressBrowserChecks({ open, sql, IDS, BASE, ok }) {
  console.log('Coach edits measurements')
  const id = (await sql("insert into measurements(client_id, date, weight_kg) values($1, current_date - 50, 81) returning id", [IDS.ana]))[0].id
  try {
    const coach = await open('coach', { w: 1280, h: 900 })
    await coach.page.goto(BASE + '/clients/' + IDS.ana + '?tab=progress&progressTab=body', { waitUntil: 'networkidle' })
    const row = coach.page.locator('tr', { hasText: '81' }).first()
    await row.getByRole('button', { name: 'Edit', exact: true }).click()
    const sheet = coach.page.locator('.sheet')
    await sheet.getByLabel('Weight kg').fill('78.5')
    await sheet.getByRole('button', { name: 'Save', exact: true }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet'))
    ok(Number((await sql('select weight_kg from measurements where id=$1', [id]))[0].weight_kg) === 78.5, 'progress: the coach edits a client measurement')
    await coach.page.locator('tr', { hasText: '78.5' }).first().getByRole('button', { name: 'Delete', exact: true }).click()
    await coach.page.locator('.sheet').getByRole('button', { name: 'Confirm deletion' }).click()
    await coach.page.waitForFunction(() => !document.querySelector('.sheet'))
    ok((await sql('select count(*)::int n from measurements where id=$1', [id]))[0].n === 0, 'progress: the coach deletes a client measurement')
    await coach.ctx?.close?.()
  } finally { await sql('delete from measurements where id=$1', [id]) }
}
