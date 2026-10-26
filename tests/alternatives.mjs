import { alternativeChoice, performedItems, samePreviousExercise } from '../src/lib/alternatives.ts'

export function alternativeUnitChecks(ok) {
  const base = { id: 'base', workout_id: 'w', exercise_id: 'original', exercise_name: 'Original squat', sort: 2, group_label: 'A', sets: 3, reps: '8', weight: '80', percent_1rm: 75, load: 'RPE 8', tempo: '3-1-1', rest_sec: 90, notes: 'Original note', cardio_time: '', cardio_distance_km: null, cardio_speed_kmh: null }
  const alt = { id: 'approval', workout_item_id: 'base', exercise_id: 'press', exercise_name: 'Dumbbell press', is_cardio: false, sets: 2, reps: '12', rest_sec: 30, notes: 'Control the movement', cardio_time: '', cardio_distance_km: null, cardio_speed_kmh: null }
  const choice = alternativeChoice(base, alt)
  ok(choice.item.id === 'base' && choice.item.workout_id === 'w' && choice.item.group_label === 'A', 'alternatives: preserve block and grouping identity')
  ok(choice.item.exercise_name === 'Dumbbell press' && choice.item.sets === 2 && choice.item.reps === '12', 'alternatives: use approved exercise and prescription')
  ok(choice.item.weight === '' && choice.item.percent_1rm === null && choice.item.load === '' && choice.item.tempo === '', 'alternatives: original weight, effort and tempo are not carried across')
  ok(base.weight === '80' && base.exercise_name === 'Original squat', 'alternatives: template remains unchanged')
  const log = { exercise_choices: { base: choice } }
  ok(performedItems([base], log)[0].exercise_name === 'Dumbbell press', 'alternatives: player resolves performed exercise')
  ok(performedItems([], log)[0].exercise_name === 'Dumbbell press', 'alternatives: removed template item retains session snapshot')
  ok(!samePreviousExercise(choice.item, base, { items: {} }) && samePreviousExercise(choice.item, base, log), 'alternatives: previous weights only match the same performed exercise')
}

export async function alternativeDbChecks(db, { coach: C, ana: A, bo: B }, ok) {
  async function as(who, query, params = []) {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claims', $1, false)", [who ? JSON.stringify({ sub: who, role: 'authenticated' }) : ''])
    await db.exec(who ? 'set role authenticated' : 'set role anon')
    try { return { rows: (await db.query(query, params)).rows } } catch (e) { return { error: e.message } }
    finally { await db.exec('reset role') }
  }
  const w = (await db.query("insert into workouts(name,created_by) values('Alternative policy fixture',$1) returning id", [C])).rows[0].id
  const exercises = (await db.query("select id,name,category from exercises where category='strength' limit 2")).rows
  const base = (await db.query("insert into workout_items(workout_id,exercise_id,exercise_name,sets,reps,weight,rest_sec) values($1,$2,$3,2,'8','80',90) returning *", [w, exercises[0].id, exercises[0].name])).rows[0]
  const insert = "insert into workout_alternatives(workout_item_id,exercise_id,exercise_name,sets,reps,rest_sec) values($1,$2,$3,1,'12',30) returning *"
  ok(!!(await as(A, insert, [base.id, exercises[1].id, exercises[1].name])).error, 'alternatives: clients cannot approve exercises')
  const alt = (await as(C, insert, [base.id, exercises[1].id, exercises[1].name])).rows?.[0]
  ok(!!alt, 'alternatives: coach approves prescription')
  ok(!!(await as(C, insert, [base.id, exercises[1].id, exercises[1].name])).error, 'alternatives: duplicate approval rejected')
  ok(!!(await as(null, 'select * from workout_alternatives')).error, 'alternatives: anonymous access denied')
  const cw = (await db.query("insert into client_workouts(client_id,workout_id,date) values($1,$2,current_date) returning id", [A, w])).rows[0].id
  ok((await as(A, 'select * from workout_alternatives where id=$1', [alt.id])).rows?.length === 1, 'alternatives: assigned client reads approvals')
  ok((await as(B, 'select * from workout_alternatives where id=$1', [alt.id])).rows?.length === 0, 'alternatives: unassigned client cannot read private template approvals')
  ok((await as(A, "update workout_alternatives set reps='999' where id=$1 returning *", [alt.id])).rows?.length === 0, 'alternatives: client cannot change approved prescription')
  ok((await as(A, 'delete from workout_alternatives where id=$1 returning *', [alt.id])).rows?.length === 0, 'alternatives: client cannot withdraw approval')
  ok(!!(await as(C, 'update workout_alternatives set sets=0 where id=$1', [alt.id])).error, 'alternatives: invalid set count rejected')
  const snapshot = alternativeChoice(base, alt)
  const selected = { exercise_choices: { [base.id]: snapshot }, items: { [base.id]: [{ kg: '', reps: '', done: false }] } }
  const update = 'update client_workouts set log=$1::jsonb where id=$2 returning log'
  const tampered = structuredClone(selected); tampered.exercise_choices[base.id].item.exercise_name = 'Unapproved'
  ok(!!(await as(A, update, [JSON.stringify(tampered), cw])).error, 'alternatives: fabricated snapshot denied')
  const wrongId = structuredClone(selected); wrongId.exercise_choices[base.id].alternative_id = '99999999-9999-9999-9999-999999999999'
  ok(!!(await as(A, update, [JSON.stringify(wrongId), cw])).error, 'alternatives: unknown approval denied')
  const wrongItem = structuredClone(selected); wrongItem.exercise_choices['99999999-9999-9999-9999-999999999999'] = snapshot; delete wrongItem.exercise_choices[base.id]
  ok(!!(await as(A, update, [JSON.stringify(wrongItem), cw])).error, 'alternatives: wrong workout item denied')
  ok((await as(B, update, [JSON.stringify(selected), cw])).rows?.length === 0, 'alternatives: another client cannot switch session')
  ok(!(await as(A, update, [JSON.stringify(selected), cw])).error, 'alternatives: approved unfinished choice saved')
  ok(!(await as(A, update, [JSON.stringify({ items: { [base.id]: [{ kg: '80', reps: '', done: false }] }, exercise_choices: {} }), cw])).error, 'alternatives: restore original before completed sets')
  const marked = structuredClone(selected); marked.items[base.id][0] = { kg: '20', reps: '12', done: true }
  ok(!!(await as(A, update, [JSON.stringify(marked), cw])).error, 'alternatives: switch and completed set cannot be combined')
  ok(!(await as(A, update, [JSON.stringify(selected), cw])).error, 'alternatives: select again before logging')
  ok(!(await as(A, update, [JSON.stringify(marked), cw])).error, 'alternatives: same approved choice accepts completed sets')
  ok(!!(await as(A, update, [JSON.stringify({ items: {}, exercise_choices: {} }), cw])).error, 'alternatives: cannot clear completed sets and switch in one write')
  await as(A, "update client_workouts set status='done' where id=$1", [cw])
  ok(!!(await as(A, update, [JSON.stringify({ items: {}, exercise_choices: {} }), cw])).error, 'alternatives: completed session choice locked')
  const video = '66666666-6666-6666-6666-666666666666'
  const clip = 'insert into exercise_videos(id,client_id,client_workout_id,workout_item_id,exercise_name,video_path) values($1,$2,$3,$4,$5,$6)'
  ok(!(await as(A, clip, [video, A, cw, base.id, alt.exercise_name, A + '/' + video + '/clip.mp4'])).error, 'alternatives: technique clip accepts actual selected exercise')
  const badVideo = '77777777-7777-7777-7777-777777777777'
  ok(!!(await as(A, clip, [badVideo, A, cw, base.id, base.exercise_name, A + '/' + badVideo + '/clip.mp4'])).error, 'alternatives: technique clip cannot claim original exercise after substitution')
  ok((await as(C, 'delete from workout_alternatives where id=$1 returning id', [alt.id])).rows?.length === 1, 'alternatives: coach withdraws approval')
  ok(!(await as(A, update, [JSON.stringify(marked), cw])).error, 'alternatives: withdrawn approval does not block unchanged session history')
  await db.query('delete from workout_items where id=$1', [base.id])
  ok(!(await as(A, update, [JSON.stringify(marked), cw])).error, 'alternatives: removed template item retains historical snapshot')
  const retained = (await as(A, 'select log from client_workouts where id=$1', [cw])).rows?.[0].log
  ok(retained?.exercise_choices[base.id].item.exercise_name === alt.exercise_name, 'alternatives: performed name preserved after removal')
  await db.query('delete from workouts where id=$1', [w])
}

export async function alternativeBrowserChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  const today = new Date().toLocaleDateString('en-CA')
  await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now())", [IDS.ana])
  const ex = []
  for (const [name, category] of [['Alternative fixture squat','strength'],['Alternative fixture press','strength'],['Alternative fixture bike','cardio']]) ex.push((await sql('insert into exercises(name,category,created_by) values($1,$2,$3) returning id', [name, category, IDS.coach]))[0].id)
  const w = (await sql("insert into workouts(name,created_by) values('Alternative choice fixture',$1) returning id", [IDS.coach]))[0].id
  const item = (await sql("insert into workout_items(workout_id,exercise_id,exercise_name,sets,reps,weight,rest_sec) values($1,$2,'Alternative fixture squat',2,'8','80',0) returning id", [w, ex[0]]))[0].id
  const cw = (await sql("insert into client_workouts(client_id,workout_id,date) values($1,$2,$3) returning id", [IDS.ana, w, today]))[0].id
  const coach = await open('coach', { w: 1280, h: 860 })
  await coach.page.goto(BASE + '/library/workouts/' + w, { waitUntil: 'networkidle' })
  await coach.page.getByRole('button', { name: 'Manage alternatives for Alternative fixture squat', exact: true }).click()
  const approvals = coach.page.getByRole('dialog', { name: 'Approved alternatives: Alternative fixture squat', exact: true })
  await approvals.getByRole('button', { name: 'Choose alternative exercise', exact: true }).click()
  const picker = coach.page.getByRole('dialog', { name: 'Add exercise', exact: true })
  await picker.getByPlaceholder('Search 100+ exercises').fill('Alternative fixture press')
  await picker.getByRole('button', { name: /^Alternative fixture press/ }).click()
  await approvals.getByLabel('Alternative sets', { exact: true }).fill('1')
  await approvals.getByLabel('Alternative reps', { exact: true }).fill('12')
  await approvals.getByLabel('Alternative rest', { exact: true }).fill('0')
  await approvals.getByLabel('Alternative coaching notes', { exact: true }).fill('Use controlled reps and choose a comfortable load.')
  await approvals.getByRole('button', { name: 'Save approved alternative', exact: true }).click()
  await approvals.getByRole('article', { name: 'Approved alternative: Alternative fixture press', exact: true }).waitFor()
  ok(true, 'alternatives: coach approves a separate prescription through builder')
  await shot(coach.page, 'alternative-coach-approval-desktop')
  await coach.page.setViewportSize({ width: 390, height: 844 })
  ok(await coach.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'alternatives: approval editor fits phone width')
  await shot(coach.page, 'alternative-coach-approval-phone')
  await approvals.getByRole('button', { name: 'Close', exact: true }).click()
  clean('alternative coach approval', coach.errors)
  const alt = (await sql('select * from workout_alternatives where workout_item_id=$1', [item]))[0]
  await sql("insert into workout_alternatives(workout_item_id,exercise_id,exercise_name,is_cardio,sets,reps,rest_sec,cardio_time) values($1,$2,'Alternative fixture bike',true,1,'',0,'1:00')", [item, ex[2]])
  const client = await open('ana')
  const { page } = client
  await page.goto(BASE + '/workout/' + cw, { waitUntil: 'networkidle' })
  const block = page.locator('.exercise-block').first()
  const choose = () => page.getByRole('button', { name: /^Choose alternative for/ }).click()
  const choices = page.getByRole('dialog', { name: 'Choose an alternative: Alternative fixture squat', exact: true })
  await choose()
  page.removeAllListeners('dialog'); page.once('dialog', d => d.dismiss())
  await choices.getByRole('button', { name: /^Alternative fixture press/ }).click()
  ok(await block.getByLabel('Set 1 weight', { exact: true }).inputValue() === '80', 'alternatives: cancelling switch preserves unfinished weights')
  page.on('dialog', d => d.accept())
  await page.route('**/rest/v1/client_workouts*', route => {
    const req = route.request(), body = req.method() === 'PATCH' ? req.postDataJSON() : null
    return body?.log?.exercise_choices?.[item] ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Offline"}' }) : route.continue()
  })
  await choices.getByRole('button', { name: /^Alternative fixture press/ }).click()
  await choices.getByText('Could not change exercise. Your saved entries are preserved. Retry or reload to check the latest approval.', { exact: true }).waitFor()
  ok(await block.getByLabel('Set 1 weight', { exact: true }).inputValue() === '80', 'alternatives: failed switch preserves original saved entries')
  await page.unroute('**/rest/v1/client_workouts*')
  await choices.getByRole('button', { name: 'Close', exact: true }).click()
  // Hold an older autosave while the client starts a switch; it must finish first.
  await page.route('**/rest/v1/client_workouts*', async route => {
    const req = route.request(), body = req.method() === 'PATCH' ? req.postDataJSON() : null
    if (body?.log && !body.log.exercise_choices?.[item]) await new Promise(resolve => setTimeout(resolve, 350))
    return route.continue()
  })
  const older = page.waitForRequest(req => req.method() === 'PATCH' && req.url().includes('/client_workouts') && req.postDataJSON()?.log?.items?.[item]?.[0]?.kg === '85')
  await block.getByLabel('Set 1 weight', { exact: true }).fill('85'); await older
  await choose(); await choices.getByRole('button', { name: /^Alternative fixture bike/ }).click()
  await choices.waitFor({ state: 'hidden' })
  await block.getByRole('link', { name: 'Watch Alternative fixture bike demo', exact: true }).waitFor()
  ok(await block.getByLabel('Time', { exact: true }).count() === 1 && await block.getByLabel('Set 1 weight', { exact: true }).count() === 0, 'alternatives: cardio alternative uses cardio logging fields')
  await choose(); await choices.getByRole('button', { name: 'Use original: Alternative fixture squat', exact: true }).click()
  await choices.waitFor({ state: 'hidden' })
  ok(await block.getByLabel('Set 1 weight', { exact: true }).inputValue() === '80', 'alternatives: original can be restored with its own prescription')
  await choose(); await choices.getByRole('button', { name: /^Alternative fixture press/ }).click()
  await choices.waitFor({ state: 'hidden' })
  await block.getByRole('link', { name: 'Watch Alternative fixture press demo', exact: true }).waitFor()
  ok(await block.getByLabel('Set 1 weight', { exact: true }).inputValue() === '' && await block.getByLabel('Set 2 weight', { exact: true }).count() === 0, 'alternatives: selected prescription resets working weight and set count')
  const saved = (await sql('select log from client_workouts where id=$1', [cw]))[0].log
  ok(saved.exercise_choices[item].alternative_id === alt.id && saved.items[item][0].kg === '', 'alternatives: older autosave cannot overwrite chosen exercise')
  await page.unroute('**/rest/v1/client_workouts*')
  await block.getByLabel('Set 1 weight', { exact: true }).fill('20')
  await block.getByLabel('Set 1 reps', { exact: true }).fill('12')
  await block.getByRole('button', { name: 'Complete set 1', exact: true }).click()
  ok(await block.getByRole('button', { name: 'Choose alternative for Alternative fixture press', exact: true }).isDisabled(), 'alternatives: completed set locks switching')
  await block.getByRole('button', { name: 'Technique feedback for Alternative fixture press', exact: true }).click()
  const feedback = page.getByRole('dialog', { name: 'Technique feedback: Alternative fixture press', exact: true })
  await feedback.waitFor(); ok(true, 'alternatives: technique feedback uses performed exercise name')
  await feedback.getByRole('button', { name: 'Close', exact: true }).click()
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'alternatives: selected workout fits phone width')
  await shot(page, 'alternative-selected-client-phone')
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click()
  await page.getByRole('dialog', { name: 'Nice work', exact: true }).getByRole('button', { name: 'Save and finish', exact: true }).click()
  await page.waitForURL(BASE + '/')
  ok((await sql('select status,log from client_workouts where id=$1', [cw]))[0].status === 'done', 'alternatives: finishing flushes selected exercise and set log')
  // Withdraw approval and then remove the template item; performed history remains usable.
  await coach.page.getByRole('button', { name: 'Manage alternatives for Alternative fixture squat', exact: true }).click()
  await approvals.getByRole('article', { name: 'Approved alternative: Alternative fixture press', exact: true }).getByRole('button', { name: 'Remove approval', exact: true }).click()
  await approvals.getByRole('article', { name: 'Approved alternative: Alternative fixture press', exact: true }).waitFor({ state: 'hidden' })
  await sql('delete from workout_items where id=$1', [item])
  await page.goto(BASE + '/workout/' + cw, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Technique feedback for Alternative fixture press', exact: true }).waitFor()
  ok(await page.getByRole('button', { name: /^Choose alternative for/ }).count() === 0, 'alternatives: completed history keeps snapshot after approval/template removal')
  await page.goto(BASE + '/progress', { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Strength', exact: true }).click()
  const records = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Personal records', exact: true }) })
  await records.getByText('Alternative fixture press', { exact: true }).waitFor()
  ok(await records.getByText('Alternative fixture squat', { exact: true }).count() === 0, 'alternatives: strength records attribute sets to performed exercise even without template item')
  client.errors.splice(0, client.errors.length, ...client.errors.filter(e => !/503/.test(e)))
  clean('alternative client', client.errors); clean('alternative coach withdrawal', coach.errors)
  await client.ctx.close(); await coach.ctx.close()
  await sql('delete from workouts where id=$1', [w])
  await sql('delete from exercises where id=any($1::uuid[])', [ex])
  await sql('delete from client_health where client_id=$1', [IDS.ana])
}
