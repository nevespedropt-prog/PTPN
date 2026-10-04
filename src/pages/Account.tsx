import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'

export default function Account() {
  const { session, profile } = useAuth()
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

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
