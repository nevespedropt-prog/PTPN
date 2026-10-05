// Minimal Supabase-compatible server on top of PGlite, enforcing the real schema + RLS.
// Implements the subset of PostgREST / Auth / Storage / Functions that supabase-js uses in PTPN.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'

const REPO = new URL('../supabase/', import.meta.url).pathname
export const IDS = { coach: '11111111-1111-1111-1111-111111111111', ana: '22222222-2222-2222-2222-222222222222', bo: '33333333-3333-3333-3333-333333333333' }

export async function createDb() {
  const db = new PGlite({ extensions: { uuid_ossp } })
  await db.exec(`
create schema extensions; create extension "uuid-ossp" schema extensions;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, encrypted_password text);
create function auth.uid() returns uuid language sql stable as $$ select nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
create publication supabase_realtime;`)
  await db.exec(fs.readFileSync(REPO + 'schema.sql', 'utf8'))
  await db.exec(fs.readFileSync(REPO + 'seed.sql', 'utf8'))
  await db.exec(fs.readFileSync(REPO + 'seed_meal_plans.sql', 'utf8'))
  await db.exec(fs.readFileSync(REPO + 'seed_common_meals.sql', 'utf8'))
  await db.exec(`
insert into auth.users (id, email, raw_user_meta_data) values
 ('${IDS.coach}','coach@x.com','{"full_name":"Pedro Neves"}'),
 ('${IDS.ana}','ana@x.com','{"full_name":"Ana Silva"}'),
 ('${IDS.bo}','bo@x.com','{"full_name":"Bo Jones"}');
update public.profiles set role = 'coach' where id = '${IDS.coach}';`)
  return db
}

const ident = s => { if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw Object.assign(new Error('bad identifier ' + s), { status: 400 }); return `"${s}"` }

function decodeJwt(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) } catch { return null }
}

export function startServer(db, { port = 4180, dist }) {
  let chain = Promise.resolve()
  const files = new Map() // storage bytes
  const serial = fn => (chain = chain.then(fn, fn))

  async function asRole(claims, fn) {
    return serial(async () => {
      await db.exec('reset role')
      await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims ? JSON.stringify(claims) : ''])
      await db.exec(claims ? 'set role authenticated' : 'set role anon')
      try { return await fn() } finally { await db.exec('reset role') }
    })
  }

  function filters(url, params) {
    const where = []
    for (const [k, v] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
      let m = /^(not\.)?(eq|neq|gt|gte|lt|lte|is|in|like|ilike)\.(.*)$/.exec(v)
      if (!m) throw Object.assign(new Error('unsupported filter ' + k + '=' + v), { status: 400 })
      const [, neg, op, val] = m
      const col = ident(k)
      let sql
      if (op === 'is') sql = `${col} is ${val === 'null' ? 'null' : val}`
      else if (op === 'in') {
        const vals = val.replace(/^\(|\)$/g, '').split(',').map(x => x.replace(/^"|"$/g, ''))
        sql = `${col} in (${vals.map(x => { params.push(x); return `$${params.length}` }).join(',') || 'null'})`
      } else {
        params.push(val)
        const o = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' }[op]
        sql = `${col} ${o} $${params.length}`
      }
      where.push(neg ? `not (${sql})` : sql)
    }
    return where.length ? ' where ' + where.join(' and ') : ''
  }

  async function rest(req, res, url, body, claims) {
    const parts = url.pathname.replace('/rest/v1/', '').split('/')
    if (parts[0] === 'rpc') {
      const fn = parts[1], args = body && typeof body === 'object' ? Object.entries(body) : []
      const params = args.map(([, v]) => v)
      const call = `public.${ident(fn)}(${args.map(([k], i) => `${ident(k)} := $${i + 1}`).join(', ')})`
      const meta = (await serial(() => db.query(`select proretset, prorettype::regtype::text as rt from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace`, [fn]))).rows[0]
      if (!meta) return [404, { code: 'PGRST202', message: `function ${fn} not found` }]
      let out
      if (meta.proretset) out = (await asRole(claims, () => db.query(`select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as j from ${call} t`, params))).rows[0].j
      else if (meta.rt === 'void') { await asRole(claims, () => db.query(`select ${call}`, params)); out = null }
      else out = (await asRole(claims, () => db.query(`select to_jsonb(${call}) as v`, params))).rows[0].v
      return [200, out]
    }
    const table = ident(parts[0]), t = `public.${table}`
    const accept = req.headers['accept'] || ''
    const prefer = req.headers['prefer'] || ''
    const params = []
    if (req.method === 'GET' || req.method === 'HEAD') {
      const sel = url.searchParams.get('select') || '*'
      const cols = sel === '*' ? '*' : sel.split(',').map(ident).join(', ')
      let q = ` from ${t}${filters(url, params)}`
      if (req.method === 'HEAD') {
        const r = await asRole(claims, () => db.query(`select count(*)::int as n${q}`, params))
        return [200, null, { 'content-range': `0-0/${r.rows[0].n}` }]
      }
      let order = ''
      for (const o of url.searchParams.getAll('order')) order += (order ? ', ' : ' order by ') + o.split(',').map(x => { const [c, d, n] = x.split('.'); return `${ident(c)} ${d === 'desc' ? 'desc' : 'asc'}${n ? (n === 'nullsfirst' ? ' nulls first' : ' nulls last') : ''}` }).join(', ')
      const lim = url.searchParams.get('limit') ? ` limit ${Number(url.searchParams.get('limit'))}` : ''
      const r = await asRole(claims, () => db.query(`select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) as j from (select ${cols}${q}${order}${lim}) s`, params))
      const rows = r.rows[0].j
      if (accept.includes('pgrst.object')) {
        if (rows.length !== 1) return [406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null }]
        return [200, rows[0]]
      }
      return [200, rows]
    }
    const wantRows = prefer.includes('return=representation')
    const wrap = (stmt) => `with r as (${stmt} returning *) select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) as j from r`
    if (req.method === 'POST') {
      const rows = Array.isArray(body) ? body : [body]
      const keys = [...new Set(rows.flatMap(Object.keys))]
      params.push(JSON.stringify(rows))
      let stmt = `insert into ${t} (${keys.map(ident).join(', ')}) select ${keys.map(ident).join(', ')} from jsonb_populate_recordset(null::${t}, $1::jsonb)`
      if (prefer.includes('resolution=merge-duplicates') || prefer.includes('resolution=ignore-duplicates')) {
        let conflict = url.searchParams.get('on_conflict')
        if (!conflict) {
          const pk = await serial(() => db.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = '${t}'::regclass and i.indisprimary`))
          conflict = pk.rows.map(x => x.attname).join(',')
        }
        const set = keys.filter(k => !conflict.split(',').includes(k)).map(k => `${ident(k)} = excluded.${ident(k)}`)
        stmt += prefer.includes('ignore') || !set.length ? ` on conflict (${conflict.split(',').map(ident).join(',')}) do nothing` : ` on conflict (${conflict.split(',').map(ident).join(',')}) do update set ${set.join(', ')}`
      }
      const r = await asRole(claims, () => db.query(wantRows ? wrap(stmt) : stmt, params))
      if (!wantRows) return [201, null]
      const out = r.rows[0].j
      return [201, accept.includes('pgrst.object') ? out[0] : out]
    }
    if (req.method === 'PATCH') {
      const keys = Object.keys(body)
      params.push(JSON.stringify(body))
      const set = keys.map(k => `${ident(k)} = (jsonb_populate_record(null::${t}, $1::jsonb)).${ident(k)}`).join(', ')
      const stmt = `update ${t} set ${set}${filters(url, params)}`
      const r = await asRole(claims, () => db.query(wantRows ? wrap(stmt) : stmt, params))
      return wantRows ? [200, r.rows[0].j] : [204, null]
    }
    if (req.method === 'DELETE') {
      const stmt = `delete from ${t}${filters(url, params)}`
      const r = await asRole(claims, () => db.query(wantRows ? wrap(stmt) : stmt, params))
      return wantRows ? [200, r.rows[0].j] : [204, null]
    }
    return [405, { message: 'method not allowed' }]
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...headers })
      res.end(body === null || body === undefined ? '' : JSON.stringify(body))
    }
    try {
      if (req.method === 'OPTIONS') return send(204, null, { 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' })
      const chunks = []; for await (const c of req) chunks.push(c)
      const raw = Buffer.concat(chunks)
      const tok = (req.headers['authorization'] || '').replace(/^Bearer /, '')
      const jwt = decodeJwt(tok)
      const claims = jwt?.sub ? { sub: jwt.sub, role: 'authenticated' } : null

      if (url.pathname.startsWith('/rest/v1/')) {
        const body = raw.length && (req.headers['content-type'] || '').includes('json') ? JSON.parse(raw.toString()) : undefined
        const [status, out, headers] = await rest(req, res, url, body, claims)
        return send(status, out, headers)
      }
      if (url.pathname === '/auth/v1/user') return send(200, { id: claims?.sub, email: 'x@x.com' })
      if (url.pathname.startsWith('/auth/v1/')) return send(200, {})
      if (url.pathname.startsWith('/functions/v1/create-client')) {
        const isCoach = claims && (await asRole(claims, () => db.query('select public.is_coach() as c'))).rows[0].c
        if (!isCoach) return send(403, { error: 'Only the coach can add clients' })
        const b = JSON.parse(raw.toString())
        const id = crypto.randomUUID()
        await serial(() => db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`, [id, b.email, JSON.stringify({ full_name: b.full_name })]))
        return send(200, { id })
      }
      if (url.pathname.startsWith('/storage/v1/object/sign/')) {
        const bucket = url.pathname.split('/')[5]
        const b = JSON.parse(raw.toString())
        return send(200, b.paths.map(p => ({ path: p, signedURL: `/storage/v1/object/sign/${bucket}/${p}?token=t`, error: null })))
      }
      if (req.method === 'GET' && url.pathname.startsWith('/storage/v1/object/sign/')) { /* unreachable, handled below */ }
      if (url.pathname.startsWith('/storage/v1/object/') && req.method === 'POST') {
        const [, , , , bucket, ...rest] = url.pathname.split('/')
        const name = decodeURIComponent(rest.join('/'))
        await asRole(claims, () => db.query(`insert into storage.objects (bucket_id, name, owner) values ($1, $2, auth.uid())`, [bucket, name]))
        files.set(`${bucket}/${name}`, raw)
        return send(200, { Key: `${bucket}/${name}`, Id: crypto.randomUUID() })
      }
      if (url.pathname.startsWith('/storage/v1/object/') && req.method === 'DELETE') {
        const b = JSON.parse(raw.toString())
        for (const n of b.prefixes ?? []) await asRole(claims, () => db.query(`delete from storage.objects where bucket_id = $1 and name = $2`, [url.pathname.split('/')[4], n]))
        return send(200, [])
      }
      if (url.pathname.startsWith('/realtime')) return send(404, {})

      // static app with SPA fallback
      let file = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname)
      if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
      const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html', '.webmanifest': 'application/manifest+json', '.png': 'image/png' }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' })
      res.end(fs.readFileSync(file))
    } catch (e) {
      const code = e.code || ''
      const status = e.status || (code === '42501' ? 403 : code === '23505' ? 409 : 400)
      send(status, { code, message: e.message, details: null, hint: null })
    }
  })
  return new Promise(resolve => server.listen(port, () => resolve({ server, files })))
}
