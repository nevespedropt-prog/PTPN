import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('')
    const { error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
    if (error) setMsg(error.message)
    else if (mode === 'up') setMsg('Check your email to confirm, then sign in.')
    setBusy(false)
  }

  function pick(m: 'in' | 'up') { setMode(m); setMsg('') }

  return (
    <main className="auth">
      <div className="hero">
        <Logo size={72} tagline />
      </div>
      <div className="card">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on' : ''} onClick={() => pick('in')}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on' : ''} onClick={() => pick('up')}>Create account</button>
        </div>
        <form className="col" onSubmit={submit}>
          {mode === 'up' && <input placeholder="Full name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required />}
          <input type="email" placeholder="Email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password (min 6)" minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password} onChange={e => setPassword(e.target.value)} required />
          <button disabled={busy}>{busy ? 'One moment...' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        </form>
        {msg && <p className={msg.startsWith('Check') ? 'ok' : 'err'}>{msg}</p>}
      </div>
      <p className="mute" style={{ textAlign: 'center' }}>Your coach may have already set up an account for you.</p>
      <p className="small" style={{ textAlign: 'center' }}><Link to="/get-app">Get the app for Android or iPhone</Link></p>
    </main>
  )
}
