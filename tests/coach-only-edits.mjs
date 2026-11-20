// A client cannot edit a session the coach assigned; they can still log and finish it, and keep their own workouts.
export async function coachOnlyEditChecks({ db, ok, as, IDS }) {
  const A = IDS.ana, C = IDS.coach
  const mk = async (by, name) => (await db.query("insert into workouts(name, created_by) values($1,$2) returning id", [name, by])).rows[0].id
  const assigned = await mk(C, 'Coach plan v39'), own = await mk(A, 'Ana own v39')
  const cw = async (wid, date = 'current_date + 2') => (await db.query(`insert into client_workouts(client_id, workout_id, date) values($1,$2,${date}) returning id`, [A, wid])).rows[0].id
  const s1 = await cw(assigned), s2 = await cw(own), s3 = await cw(assigned, 'current_date + 3')
  const n = async (who, sql) => { const r = await as(who, sql + ' returning id'); return r.error ? 'ERR' : r.rows.length }
  ok(await n(A, `update client_workouts set date = current_date + 5 where id = '${s1}'`) === 'ERR', 'v39: a client cannot move an assigned session')
  ok(await n(A, `update client_workouts set status = 'skipped' where id = '${s1}'`) === 'ERR', 'v39: a client cannot mark an assigned session as skipped')
  ok(await n(A, `delete from client_workouts where id = '${s1}'`) === 'ERR', 'v39: a client cannot delete an assigned session')
  ok(await n(A, `update client_workouts set workout_id = '${own}' where id = '${s1}'`) === 'ERR', 'v39: a client cannot swap the workout of an assigned session')
  ok(await n(A, `update client_workouts set log = '{"items":{}}'::jsonb where id = '${s1}'`) === 1, 'v39: a client can still log an assigned session')
  ok(await n(A, `update client_workouts set status = 'done', completed_at = now(), rating = 4 where id = '${s1}'`) === 1, 'v39: a client can still finish an assigned session')
  ok(await n(A, `update client_workouts set status = 'scheduled' where id = '${s1}'`) === 'ERR', 'v39: a client cannot reopen a finished session')
  ok(await n(A, `update client_workouts set rating = 1 where id = '${s1}'`) === 'ERR', 'v39: a client cannot rewrite a finished session')
  ok(await n(A, `update client_workouts set date = current_date + 9 where id = '${s2}'`) === 1 && await n(A, `update client_workouts set status = 'skipped' where id = '${s2}'`) === 1, 'v39: a client keeps control of their own workout sessions')
  ok(await n(A, `delete from client_workouts where id = '${s2}'`) === 1, 'v39: a client can remove their own workout session')
  ok((await as(A, `insert into client_workouts(client_id, workout_id, date) values('${A}','${assigned}', current_date)`)).error, 'v39: a client cannot schedule a workout they did not build')
  ok(!(await as(A, `insert into client_workouts(client_id, workout_id, date) values('${A}','${own}', current_date + 4)`)).error, 'v39: a client can schedule a workout they built')
  ok(await n(C, `update client_workouts set status = 'scheduled', date = current_date + 6 where id = '${s1}'`) === 1, 'v39: the coach can reopen and move a finished session')
  ok(await n(C, `update client_workouts set status = 'skipped' where id = '${s3}'`) === 1 && await n(C, `delete from client_workouts where id = '${s3}'`) === 1, 'v39: the coach can mark missed and remove')
  ok(!(await as(C, `insert into client_workouts(client_id, workout_id, date) values('${A}','${assigned}', current_date + 7)`)).error, 'v39: the coach can assign any workout')
  await db.query("select set_config('request.jwt.claims', '', false)") // back to a server-side session for the clean-up
  await db.query('delete from client_workouts where client_id=$1 and workout_id = any($2)', [A, [assigned, own]])
  await db.query('delete from workouts where id = any($1)', [[assigned, own]])
}
