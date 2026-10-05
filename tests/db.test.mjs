import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import fs from 'node:fs'

const repo = new URL('../supabase/', import.meta.url).pathname
const db = new PGlite({ extensions: { uuid_ossp } })
let pass = 0, fail = 0
const ok = (cond, label) => { if (cond) { pass++ } else { fail++; console.log('FAIL', label) } }

// --- minimal Supabase platform stubs ---
await db.exec(`
create schema extensions; create extension "uuid-ossp" schema extensions;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
create publication supabase_realtime;
`)
await db.exec(fs.readFileSync(repo + 'schema.sql', 'utf8'))
await db.exec(fs.readFileSync(repo + 'seed.sql', 'utf8'))
await db.exec(fs.readFileSync(repo + 'seed.sql', 'utf8')) // re-runnable
await db.exec(fs.readFileSync(repo + 'seed_meal_plans.sql', 'utf8'))
await db.exec(fs.readFileSync(repo + 'seed_meal_plans.sql', 'utf8')) // re-runnable
await db.exec(fs.readFileSync(repo + 'seed_common_meals.sql', 'utf8'))
await db.exec(fs.readFileSync(repo + 'seed_common_meals.sql', 'utf8')) // re-runnable
console.log('schema + seed loaded (twice)')
const sq = (await db.query(`select id from public.exercises where name = 'Back squat'`)).rows[0].id
ok(sq === '1801c6bd-da34-54f4-a8ed-a88850762e13', 'seed ids match python uuid5: ' + sq)

const C = '11111111-1111-1111-1111-111111111111', A = '22222222-2222-2222-2222-222222222222', B = '33333333-3333-3333-3333-333333333333'
await db.exec(`
insert into auth.users (id, email, raw_user_meta_data) values
 ('${C}','coach@x.com','{"full_name":"Coach Carter"}'),('${A}','ana@x.com','{"full_name":"Ana Silva"}'),('${B}','bo@x.com','{"full_name":"Bo Jones"}');
update public.profiles set role = 'coach' where id = '${C}';`)

async function as(who, sql, params = []) {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [who ? JSON.stringify({ sub: who, role: 'authenticated' }) : ''])
  await db.exec(who ? 'set role authenticated' : 'set role anon')
  try { return { rows: (await db.query(sql, params)).rows } } catch (e) { return { error: e.message } }
  finally { await db.exec('reset role') }
}
const count = async (who, sql) => { const r = await as(who, sql); return r.error ? `ERR ${r.error}` : r.rows.length }

// library counts
ok(await count(A, 'select id from exercises') === 104, 'client reads exercise library')
ok(await count(A, 'select id from workouts') === 16, 'client sees 16 built-in workouts')
ok(await count(A, 'select id from recipes') === 105, 'client reads recipes')
ok(await count(A, 'select id from foods') === 139, 'client reads foods')
ok(await count(A, 'select id from programs') === 6, 'client reads programs')
ok(await count(null, 'select id from exercises') === 0, 'anon reads nothing')
ok((await as(A, `insert into exercises (name, created_by) values ('X', '${A}')`)).error, 'client cannot add exercise')
ok(!(await as(C, `insert into exercises (name, created_by) values ('Coach move', '${C}')`)).error, 'coach adds exercise')
ok((await as(C, `delete from exercises where created_by is null returning id`)).rows?.length === 0, 'coach cannot delete built-in exercises')

// workouts + items
const wA = (await as(A, `insert into workouts (name, created_by) values ('Ana own', '${A}') returning id`)).rows[0].id
ok(!!wA, 'client creates own workout')
ok(!(await as(A, `insert into workout_items (workout_id, exercise_name) values ('${wA}', 'Push-up')`)).error, 'client adds item to own workout')
const builtin = (await as(A, `select id from workouts where created_by is null limit 1`)).rows[0].id
ok((await as(A, `insert into workout_items (workout_id, exercise_name) values ('${builtin}', 'Hack')`)).error, 'client cannot edit built-in workout')
ok(await count(B, `select id from workouts where id = '${wA}'`) === 0, 'other client cannot see Ana workout')
ok(await count(B, `select id from workout_items where workout_id = '${wA}'`) === 0, 'other client cannot see Ana items')
const wC = (await as(C, `insert into workouts (name, created_by) values ('Coach custom', '${C}') returning id`)).rows[0].id
ok(await count(A, `select id from workouts where id = '${wC}'`) === 0, 'client cannot see unassigned coach workout')
ok(!(await as(C, `insert into client_workouts (client_id, workout_id, date) values ('${A}', '${wC}', current_date)`)).error, 'coach schedules workout for client')
ok(await count(A, `select id from workouts where id = '${wC}'`) === 1, 'client sees workout once scheduled')
ok(await count(B, `select id from client_workouts`) === 0, 'other client sees no schedules')
const cw = (await as(A, `select id from client_workouts limit 1`)).rows[0].id
ok((await as(A, `update client_workouts set status='done', log='{"items":{}}' where id='${cw}' returning id`)).rows?.length === 1, 'client logs own workout')
ok((await as(B, `update client_workouts set status='skipped' where id='${cw}' returning id`)).rows?.length === 0, 'other client cannot touch it')
ok((await as(A, `insert into client_workouts (client_id, workout_id, date) values ('${B}', '${builtin}', current_date)`)).error, 'client cannot schedule for someone else')
ok((await as(A, `insert into programs (name) values ('x')`)).error, 'client cannot create programs')

// nutrition
ok(!(await as(A, `insert into food_logs (client_id, meal_type, name, kcal) values ('${A}','lunch','Soup',200)`)).error, 'client logs food')
ok((await as(A, `insert into food_logs (client_id, meal_type, name) values ('${B}','lunch','x')`)).error, 'client cannot log for others')
ok(await count(B, `select id from food_logs`) === 0, 'other client cannot read food logs')
ok(await count(C, `select id from food_logs`) === 1, 'coach reads food logs')
ok((await as(A, `insert into nutrition_targets (client_id, kcal) values ('${A}', 9999)`)).error, 'client cannot set own targets')
ok(!(await as(C, `insert into nutrition_targets (client_id, kcal, protein, carbs, fat) values ('${A}', 2200, 160, 230, 70)`)).error, 'coach sets targets')
ok(await count(A, `select * from nutrition_targets`) === 1 && await count(B, `select * from nutrition_targets`) === 0, 'targets visible only to that client')
const rec = (await as(C, `select id from recipes limit 1`)).rows[0].id
ok(!(await as(C, `insert into meal_plan_items (client_id, day, meal_type, recipe_id) values ('${A}', 1, 'lunch', '${rec}')`)).error, 'coach builds meal plan')
ok((await as(A, `insert into meal_plan_items (client_id, day, meal_type, recipe_id) values ('${A}', 2, 'lunch', '${rec}')`)).error, 'client cannot edit meal plan')
ok(!(await as(A, `insert into foods (name, kcal, created_by) values ('My bar', 200, '${A}')`)).error, 'client adds custom food')

// messages
ok(!(await as(A, `insert into messages (client_id, sender_id, body) values ('${A}','${A}','Hi coach')`)).error, 'client messages coach')
ok((await as(A, `insert into messages (client_id, sender_id, body) values ('${B}','${A}','sneaky')`)).error, 'client cannot post into another conversation')
ok((await as(A, `insert into messages (client_id, sender_id, body) values ('${A}','${C}','spoof')`)).error, 'client cannot spoof sender')
ok((await as(A, `insert into messages (client_id, sender_id, body, read_at) values ('${A}','${A}','x', now())`)).error, 'cannot pre-mark read')
ok(!(await as(C, `insert into messages (client_id, sender_id, body) values ('${A}','${C}','Welcome!')`)).error, 'coach replies')
ok(await count(B, `select id from messages`) === 0, 'other client reads no messages')
ok((await as(A, `update messages set body='edited' returning id`)).rows?.length === 0, 'messages cannot be edited')
await as(A, `select mark_conversation_read('${A}')`)
const reads = (await as(C, `select sender_id, read_at from messages order by created_at`)).rows
ok(reads.find(r => r.sender_id === C)?.read_at && !reads.find(r => r.sender_id === A)?.read_at, 'mark read only marks the other side')
await as(B, `select mark_conversation_read('${A}')`)
ok((await as(null, `select mark_conversation_read('${A}')`)).error, 'anon cannot call mark read')

// photos + storage
ok(!(await as(A, `insert into progress_photos (client_id, path) values ('${A}', '${A}/a.jpg')`)).error, 'client saves own photo row')
ok((await as(A, `insert into progress_photos (client_id, path) values ('${A}', '${B}/a.jpg')`)).error, 'photo path must be own folder')
ok(!(await as(A, `insert into storage.objects (bucket_id, name) values ('progress-photos', '${A}/a.jpg')`)).error, 'client uploads to own folder')
ok((await as(A, `insert into storage.objects (bucket_id, name) values ('progress-photos', '${B}/a.jpg')`)).error, 'client cannot upload to others folder')
ok(await count(B, `select id from storage.objects`) === 0 && await count(C, `select id from storage.objects`) === 1, 'photo files private to client and coach')

// community
ok(!(await as(C, `insert into posts (author_id, body) values ('${C}', 'Welcome to PTPN')`)).error, 'coach posts')
ok(!(await as(C, `insert into posts (author_id, body, publish_at) values ('${C}', 'Future', now() + interval '1 day')`)).error, 'coach schedules post')
ok(await count(A, `select id from posts`) === 1 && await count(C, `select id from posts`) === 2, 'clients only see published posts')
ok((await as(A, `insert into posts (author_id, body) values ('${A}', 'x')`)).error, 'client cannot post')
const ch = (await as(C, `insert into challenges (name, unit, goal, end_date, created_by) values ('October steps','steps',300000, current_date + 30, '${C}') returning id`)).rows[0].id
ok(!(await as(A, `insert into challenge_entries (challenge_id, client_id, value) values ('${ch}','${A}', 12000)`)).error, 'client logs challenge entry')
ok(!(await as(B, `insert into challenge_entries (challenge_id, client_id, value) values ('${ch}','${B}', 9000)`)).error, 'second client logs entry')
ok(await count(A, `select id from challenge_entries`) === 1, 'entries private')
const lb = (await as(A, `select * from challenge_leaderboard('${ch}')`)).rows
ok(lb.length === 2 && lb[0].display_name === 'Ana' && Number(lb[0].total) === 12000 && lb[1].display_name === 'Bo', 'leaderboard shows first names and totals')
ok((await as(null, `select * from challenge_leaderboard('${ch}')`)).error, 'anon cannot read leaderboard')
ok(await count(A, `select id from profiles`) === 1, 'client still only reads own profile')
ok((await as(A, `insert into resources (title, url) values ('x','https://x.com')`)).error, 'client cannot add resources')
ok((await as(C, `insert into resources (title, url) values ('x','javascript:alert(1)')`)).error, 'resource url must be http(s)')

// meal plan library
ok(await count(A, 'select id from meal_plan_templates') === 10, 'client reads 10 meal plan templates')
ok(await count(A, 'select id from meal_plan_template_items') === 280, 'client reads template items')
{ const r = await count(null, 'select id from meal_plan_templates'); ok(r === 0 || String(r).startsWith('ERR'), 'anon reads no templates') }
ok((await as(null, 'select public.is_coach()')).error, 'anon cannot call is_coach directly')
ok((await as(A, 'select public.is_coach()')).rows?.[0]?.is_coach === false, 'client can still evaluate is_coach')
ok((await as(A, `insert into meal_plan_templates (name) values ('x')`)).error, 'client cannot add template')
ok(!(await as(C, `insert into meal_plan_templates (name) values ('x')`)).error, 'coach adds template')
ok(await count(A, `select id from recipes where image_url is not null`) === 88, 'recipes have photos')
const dk = (await as(A, `select min(kcal) lo, max(kcal) hi from recipes where meal_type='dinner'`)).rows[0]
ok(Number(dk.lo) > 300 && Number(dk.hi) < 900, 'dinner kcal sane')
ok(await count(A, `select 1 from meal_plan_template_items i left join recipes r on r.id=i.recipe_id where r.id is null`) === 0, 'all items resolve')

// deleting a client cascades everything
await db.exec(`delete from auth.users where id = '${A}'`)
const left = await db.query(`select (select count(*) from food_logs) f, (select count(*) from messages) m, (select count(*) from client_workouts) w, (select count(*) from workouts where created_by = '${A}') ow`)
ok(Object.values(left.rows[0]).every(v => Number(v) === 0), 'deleting a user removes their data')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
