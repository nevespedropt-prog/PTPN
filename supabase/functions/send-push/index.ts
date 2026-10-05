// Sends web push notifications. Called by the database (pg_net) with a shared secret, never by browsers.
//   { kind: 'message', id }  a new chat message goes to the other side of the conversation
//   { kind: 'posts' }        announcements that are due and not yet pushed go to everyone else
//   { kind: 'reminders' }    clients with a workout scheduled today get a morning nudge
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
type Note = { title: string; body: string; path: string; tag: string }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: cfg } = await db.from('push_config').select('*').eq('id', 1).maybeSingle()
  if (!cfg || req.headers.get('x-push-secret') !== cfg.secret) return json({ error: 'Forbidden' }, 403)
  webpush.setVapidDetails(cfg.subject, cfg.vapid_public, cfg.vapid_private)
  const base: string = cfg.app_url.endsWith('/') ? cfg.app_url : cfg.app_url + '/'

  const body = await req.json().catch(() => ({}))
  const jobs: { userIds: string[]; note: Note }[] = []

  if (body.kind === 'message') {
    const { data: m } = await db.from('messages').select('id, client_id, sender_id, body').eq('id', body.id).maybeSingle()
    if (!m) return json({ sent: 0 })
    const { data: sender } = await db.from('profiles').select('full_name, role').eq('id', m.sender_id).single()
    if (sender?.role === 'coach') {
      jobs.push({ userIds: [m.client_id], note: { title: 'Message from your coach', body: clip(m.body, 140), path: 'chat', tag: 'chat' } })
    } else {
      const { data: coaches } = await db.from('profiles').select('id').eq('role', 'coach')
      jobs.push({ userIds: (coaches ?? []).map(c => c.id), note: { title: sender?.full_name || 'New message', body: clip(m.body, 140), path: `inbox/${m.client_id}`, tag: 'chat-' + m.client_id } })
    }
  } else if (body.kind === 'posts') {
    // Claim due posts first so two overlapping runs never announce the same post twice.
    const { data: due } = await db.from('posts').update({ pushed_at: new Date().toISOString() }).is('pushed_at', null).lte('publish_at', new Date().toISOString()).select('id, author_id, body')
    for (const p of due ?? []) {
      const { data: users } = await db.from('profiles').select('id').neq('id', p.author_id)
      jobs.push({ userIds: (users ?? []).map(u => u.id), note: { title: 'New announcement', body: clip(p.body, 140), path: 'community', tag: 'post-' + p.id } })
    }
  } else if (body.kind === 'reminders') {
    const today = new Date().toISOString().slice(0, 10)
    const { data: rows } = await db.from('client_workouts').select('client_id, workout_id').eq('date', today).eq('status', 'scheduled')
    const names = new Map<string, string>()
    const ids = [...new Set((rows ?? []).map(r => r.workout_id))]
    if (ids.length) for (const w of (await db.from('workouts').select('id, name').in('id', ids)).data ?? []) names.set(w.id, w.name)
    const byClient = new Map<string, string[]>()
    for (const r of rows ?? []) byClient.set(r.client_id, [...(byClient.get(r.client_id) ?? []), names.get(r.workout_id) ?? 'Workout'])
    for (const [client, list] of byClient) {
      jobs.push({ userIds: [client], note: { title: 'Workout today', body: list.length === 1 ? `${list[0]} is on your schedule today.` : `${list.length} workouts are on your schedule today.`, path: 'train', tag: 'reminder' } })
    }
  } else return json({ error: 'Unknown kind' }, 400)

  let sent = 0, removed = 0
  for (const job of jobs) {
    if (!job.userIds.length) continue
    const { data: subs } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', job.userIds)
    const payload = JSON.stringify({ title: job.note.title, body: job.note.body, url: base + job.note.path, tag: job.note.tag })
    await Promise.all(((subs ?? []) as Sub[]).map(async s => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12 })
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        // 404 and 410 mean the phone removed the subscription, so forget it.
        if (code === 404 || code === 410) { await db.from('push_subscriptions').delete().eq('id', s.id); removed++ }
      }
    }))
  }
  return json({ sent, removed })
})
