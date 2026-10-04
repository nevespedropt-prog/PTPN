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
  if (coachErr || isCoach !== true) return json({ error: 'Only the coach can add clients' }, 403)

  const { email, password, full_name } = await req.json().catch(() => ({}))
  if (typeof email !== 'string' || !email.includes('@')) return json({ error: 'A valid email is required' }, 400)
  if (typeof password !== 'string' || password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400)

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: typeof full_name === 'string' ? full_name.trim() : '' },
  })
  if (error) return json({ error: error.message }, 400)
  return json({ id: data.user.id })
})
