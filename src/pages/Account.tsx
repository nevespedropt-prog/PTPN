import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import { HealthForm } from '../components/Consent'
import HealthScreeningView from '../components/HealthScreeningView'
import type { ClientHealth, TasterSession } from '../types'
import { disablePush, enablePush, pushState, type PushState } from '../lib/push'

export default function Account() {
  const { session, profile } = useAuth()
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [health, setHealth] = useState<ClientHealth | null | undefined>(undefined)
  const [editHealth, setEditHealth] = useState(false)
  const [screening, setScreening] = useState<TasterSession | null>(null)
  useEffect(() => {
    if (profile?.role !== 'client') return
    supabase.from('client_health').select('*').eq('client_id', profile.id).maybeSingle().then(({ data }) => setHealth((data as ClientHealth) ?? null))
    supabase.from('taster_sessions').select('*').eq('client_id', profile.id).order('assessed_on', { ascending: false }).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => setScreening(((data ?? []) as TasterSession[])[0] ?? null))
  }, [profile])
  const [ps, setPs] = useState<PushState | null>(null)
  const [pushMsg, setPushMsg] = useState('')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushRetry, setPushRetry] = useState(0)
  const pushing = useRef(false)
  const pushCheckVersion = useRef(0)
  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let active = true
    async function check() {
      if (pushing.current) return
      const version = ++pushCheckVersion.current
      setPs(null); setPushMsg('')
      try { const state = await pushState(userId!); if (active && version === pushCheckVersion.current) setPs(state) }
      catch { if (active && version === pushCheckVersion.current) { setPs('error'); setPushMsg('Could not check notification settings. Please retry when connected.') } }
    }
    void check()
    const resume = () => { if (document.visibilityState === 'visible') void check() }
    document.addEventListener('visibilitychange', resume)
    return () => { active = false; document.removeEventListener('visibilitychange', resume) }
  }, [userId, pushRetry])
  async function togglePush() {
    if (!userId || pushing.current || (ps !== 'on' && ps !== 'off')) return
    pushing.current = true; pushCheckVersion.current++; setPushMsg(''); setPushBusy(true)
    try {
      const error = ps === 'on' ? await disablePush(userId) : await enablePush(userId)
      if (error) setPushMsg(error)
      setPs(await pushState(userId))
    } catch {
      setPs('error'); setPushMsg(previous => previous || 'Could not confirm notification settings. Please retry when connected.')
    } finally { pushing.current = false; setPushBusy(false) }
  }

  async function change(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    if (pw !== again) return setMsg({ ok: false, text: 'The two passwords do not match.' })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.message })
    setPw(''); setAgain(''); setMsg({ ok: true, text: 'Password updated.' })
  }

  return (
    <>
      <h1>Account</h1>
      <div className="card">
        <b>{profile?.full_name || 'Unnamed'}</b><br />
        <span className="mute">{session?.user.email}</span>
      </div>
      {profile?.role === 'client' && health !== undefined && (
        <div className="card col">
          <h2>Health information</h2>
          {!editHealth && health && <>
            <span className="small"><b>Allergies:</b> {health.allergies || 'Not given'}</span>
            <span className="small"><b>Health conditions or injuries:</b> {health.health_conditions || 'Not given'}</span>
            <span className="small"><b>Medication:</b> {health.medications || 'Not given'}</span>
            <span className="small"><b>Emergency contact:</b> {health.emergency_contact || 'Not given'}</span>
            {health.consented_at && <span className="mute small">Consent given {new Date(health.consented_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
          </>}
          {editHealth
            ? <HealthForm initial={health} submitLabel="Save changes" onSaved={h => { setHealth(h); setEditHealth(false) }} />
            : <button className="soft" onClick={() => setEditHealth(true)}>Update health information</button>}
        </div>
      )}
      {profile?.role === 'client' && screening && <HealthScreeningView taster={screening} />}
      {ps !== 'unsupported' && (
        <section className="card col" aria-label="Notifications">
          <h2>Notifications</h2>
          <span className="mute small">{profile?.role === 'coach' ? 'Get a message when a client writes to you.' : 'Get a message when your coach writes, a session starts in eight hours, a workout is due today, or there is a new announcement.'}</span>
          {ps === null && <span className="mute small" role="status">Checking notification settings...</span>}
          {ps === 'needs-install' && <span className="small">On iPhone and iPad, add the app to your Home Screen first (More page, Install the app), then open it from there to turn notifications on.</span>}
          {ps === 'denied' && <span className="small">Notifications are blocked for this app. Allow them in your phone or browser settings, then come back.</span>}
          {(ps === 'on' || ps === 'off') && <button className={ps === 'on' ? 'soft' : ''} disabled={pushBusy} onClick={togglePush}>{pushBusy ? 'Updating notifications...' : ps === 'on' ? 'Turn off on this device' : 'Turn on notifications'}</button>}
          {ps === 'error' && <button className="soft" disabled={pushBusy} onClick={() => setPushRetry(v => v + 1)}>Retry notification settings</button>}
          {ps === 'on' && <span className="ok small">Notifications are on for this device.</span>}
          {pushMsg && <span className="err" role="alert">{pushMsg}</span>}
        </section>
      )}
      <form className="card col" onSubmit={change}>
        <h2>Change password</h2>
        <input type="password" placeholder="New password (min 6)" minLength={6} autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} required />
        <input type="password" placeholder="Repeat new password" minLength={6} autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} required />
        <button disabled={busy}>{busy ? 'Saving...' : 'Update password'}</button>
        {msg && <span className={msg.ok ? 'ok' : 'err'}>{msg.text}</span>}
      </form>
      <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </>
  )
}

