import { useState } from 'react'
import { supabase } from '../lib/supabase'

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

  return (
    <main>
      <div className="card">
        <h1>MY GYM {mode === 'in' ? 'sign in' : 'sign up'}</h1>
        <form className="col" onSubmit={submit}>
          {mode === 'up' && <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password (min 6)" minLength={6} value={password} onChange={e => setPassword(e.target.value)} required />
          <button disabled={busy}>{mode === 'in' ? 'Sign in' : 'Create account'}</button>
        </form>
        {msg && <p className="err">{msg}</p>}
        <p className="mute">
          <a href="#" onClick={e => { e.preventDefault(); setMode(mode === 'in' ? 'up' : 'in'); setMsg('') }}>
            {mode === 'in' ? 'New client? Create an account' : 'Have an account? Sign in'}
          </a>
        </p>
      </div>
    </main>
  )
}
