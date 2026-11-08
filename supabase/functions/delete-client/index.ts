import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const authHeader = req.headers.get('Authorization') ?? ''

  // Act as the caller to find out whether they are a coach.
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: isCoach, error: coachErr } = await asCaller.rpc('is_coach')
  if (coachErr || isCoach !== true) return json({ error: 'Only the coach can delete clients' }, 403)

  const { client_id } = await req.json().catch(() => ({}))
  if (typeof client_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(client_id)) return json({ error: 'A client id is required' }, 400)

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Only ever delete a client account, never a coach.
  const { data: profile, error: profileErr } = await admin.from('profiles').select('id, role').eq('id', client_id).maybeSingle()
  if (profileErr) return json({ error: 'Could not look up the client' }, 500)
  if (!profile) return json({ error: 'Client not found' }, 404)
  if (profile.role !== 'client') return json({ error: 'Only client accounts can be deleted' }, 403)

  // Progress photos live in storage, outside the database cascade.
  const bucket = admin.storage.from('progress-photos')
  const { data: files } = await bucket.list(client_id, { limit: 1000 })
  if (files && files.length) await bucket.remove(files.map(f => `${client_id}/${f.name}`))

  // Deleting the login removes the profile and everything linked to it.
  const { error } = await admin.auth.admin.deleteUser(client_id)
  if (error) return json({ error: error.message }, 400)
  return json({ ok: true })
})
