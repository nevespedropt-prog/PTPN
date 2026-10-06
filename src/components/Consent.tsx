import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import type { ClientHealth } from '../types'
import { Logo } from './Logo'

/** Bump when the consent wording changes, so every client is asked again. */
export const CONSENT_VERSION = 1

const NONE = 'None'

type Form = Pick<ClientHealth, 'allergies' | 'health_conditions' | 'medications' | 'emergency_contact' | 'consent_data' | 'consent_health' | 'consent_accurate'>
const blank: Form = { allergies: '', health_conditions: '', medications: '', emergency_contact: '', consent_data: false, consent_health: false, consent_accurate: false }

/** Health questions plus the three consent ticks. Used as the gate after login and on the Account page. */
export function HealthForm({ initial, onSaved, submitLabel }: { initial?: ClientHealth | null; onSaved: (h: ClientHealth) => void; submitLabel: string }) {
  const { profile } = useAuth()
  const [f, setF] = useState<Form>(initial ? { ...blank, ...initial } : blank)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (patch: Partial<Form>) => setF({ ...f, ...patch })
  const none = (k: 'allergies' | 'health_conditions' | 'medications') => (
    <label className="row small" style={{ gap: 8, marginBottom: 0 }}>
      <input type="checkbox" checked={f[k] === NONE} onChange={e => set({ [k]: e.target.checked ? NONE : '' })} /> None
    </label>
  )
  const answered = f.allergies.trim() !== '' && f.health_conditions.trim() !== ''
  const ticked = f.consent_data && f.consent_health && f.consent_accurate
  const ready = answered && ticked

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!ready) return
    setBusy(true); setErr('')
    const row = { ...f, client_id: profile!.id, consent_version: CONSENT_VERSION, consented_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from('client_health').upsert(row).select().single()
    setBusy(false)
    if (error) return setErr(error.message)
    onSaved(data as ClientHealth)
  }

  return (
    <form className="stack" onSubmit={save}>
      <label className="field">Allergies (food, medication or other)
        <textarea rows={2} placeholder="e.g. peanuts, penicillin" value={f.allergies === NONE ? '' : f.allergies} disabled={f.allergies === NONE} onChange={e => set({ allergies: e.target.value })} />
      </label>
      {none('allergies')}
      <label className="field">Health conditions or injuries
        <textarea rows={2} placeholder="e.g. asthma, lower back pain, pregnancy" value={f.health_conditions === NONE ? '' : f.health_conditions} disabled={f.health_conditions === NONE} onChange={e => set({ health_conditions: e.target.value })} />
      </label>
      {none('health_conditions')}
      <label className="field">Medication you take (optional)
        <input value={f.medications === NONE ? '' : f.medications} disabled={f.medications === NONE} onChange={e => set({ medications: e.target.value })} />
      </label>
      {none('medications')}
      <label className="field">Emergency contact (optional)
        <input placeholder="Name and phone number" value={f.emergency_contact} onChange={e => set({ emergency_contact: e.target.value })} />
      </label>

      <div className="consent-box">
        <b>Your consent</b>
        <label className="tick"><input type="checkbox" checked={f.consent_data} onChange={e => set({ consent_data: e.target.checked })} />
          <span>I agree that PTPN keeps my personal details (name, email, measurements, photos and training records) to coach me.</span></label>
        <label className="tick"><input type="checkbox" checked={f.consent_health} onChange={e => set({ consent_health: e.target.checked })} />
          <span>I agree that my coach keeps and uses the allergy and health information above to plan safe training and nutrition.</span></label>
        <label className="tick"><input type="checkbox" checked={f.consent_accurate} onChange={e => set({ consent_accurate: e.target.checked })} />
          <span>The information is correct, and I will tell my coach if anything changes.</span></label>
        <span className="mute small">Only you and your coach can see this. You can change it under Account, or ask your coach to delete your data at any time.</span>
      </div>

      <button disabled={!ready || busy}>{busy ? 'Saving...' : submitLabel}</button>
      {!answered && <span className="mute small">Answer the allergy and health questions, or tick None.</span>}
      {answered && !ticked && <span className="mute small">Tick all three boxes to continue.</span>}
      {err && <span className="err">{err}</span>}
    </form>
  )
}

/** Shown to clients after login until they have given the current consent. */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const [state, setState] = useState<'loading' | 'needed' | 'ok'>('loading')
  useEffect(() => {
    if (!profile) return
    // With no connection the check would retry for seconds; let them in and ask next time they are online.
    if (!navigator.onLine) { setState('ok'); return }
    supabase.from('client_health').select('consent_version, consented_at').eq('client_id', profile.id).maybeSingle()
      .then(({ data, error }) => {
        // If we cannot check (offline, server issue), let them in rather than lock them out.
        if (error) return setState('ok')
        const r = data as Pick<ClientHealth, 'consent_version' | 'consented_at'> | null
        setState(r && r.consented_at && r.consent_version >= CONSENT_VERSION ? 'ok' : 'needed')
      })
  }, [profile])
  if (state === 'loading') return <main className="auth"><div className="hero"><Logo size={56} /></div><p className="mute center">Loading...</p></main>
  if (state === 'ok') return <>{children}</>
  return (
    <main className="auth consent">
      <div className="hero"><Logo size={48} /></div>
      <div className="card consent-card">
        <span className="eyebrow">Before you start</span>
        <h1>Health and data consent</h1>
        <p className="mute">Your coach needs this to keep your training safe. It takes about a minute.</p>
        <HealthForm onSaved={() => setState('ok')} submitLabel="Save and continue" />
      </div>
      <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  )
}
