import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import { disablePush, enablePush, pushState, type PushState } from '../lib/push'

export default function Account() {
  const { session, profile } = useAuth()
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [ps, setPs] = useState<PushState | null>(null)
  const [pushMsg, setPushMsg] = useState('')
  useEffect(() => { pushState().then(setPs) }, [])
  async function togglePush() {
    setPushMsg(''); setBusy(true)
    if (ps === 'on') await disablePush()
    else { const err = await enablePush(session!.user.id); if (err) setPushMsg(err) }
    setPs(await pushState()); setBusy(false)
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
      {ps && ps !== 'unsupported' && (
        <div className="card col">
          <h2>Notifications</h2>
          <span className="mute small">{profile?.role === 'coach' ? 'Get a message when a client writes to you.' : 'Get a message when your coach writes, a workout is due today, or there is a new announcement.'}</span>
          {ps === 'needs-install' && <span className="small">On iPhone and iPad, add the app to your Home Screen first (More page, Install the app), then open it from there to turn notifications on.</span>}
          {ps === 'denied' && <span className="small">Notifications are blocked for this app. Allow them in your phone or browser settings, then come back.</span>}
          {(ps === 'on' || ps === 'off') && <button className={ps === 'on' ? 'soft' : ''} disabled={busy} onClick={togglePush}>{ps === 'on' ? 'Turn off on this device' : 'Turn on notifications'}</button>}
          {ps === 'on' && <span className="ok small">Notifications are on for this device.</span>}
          {pushMsg && <span className="err">{pushMsg}</span>}
        </div>
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
