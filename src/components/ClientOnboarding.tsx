import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import { Sheet } from './ui'

type Experience = '' | 'beginner' | 'returning' | 'regular'
type Answers = { goals: string; experience: Experience; equipment: string; preferred_days: number[]; food_preferences: string }
type ChecklistKey = 'training_ready' | 'nutrition_ready' | 'contact_ready'
type Onboarding = Answers & { client_id: string; training_ready: boolean; nutrition_ready: boolean; contact_ready: boolean }
const blank: Answers = { goals: '', experience: '', equipment: '', preferred_days: [], food_preferences: '' }
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const levels = { beginner: 'New to training', returning: 'Returning to training', regular: 'Training regularly' }
const tasks: { key: ChecklistKey; label: string; link: string; action: string }[] = [
  { key: 'training_ready', label: 'I have reviewed my training page', link: '/train', action: 'View training' },
  { key: 'nutrition_ready', label: 'I have explored my food diary', link: '/nutrition', action: 'Explore nutrition' },
  { key: 'contact_ready', label: 'I know how to contact my coach', link: '/chat', action: 'Open coach chat' },
]

/** Optional onboarding alongside the existing health/consent gate. */
export default function ClientOnboarding({ clientId, coach = false }: { clientId: string; coach?: boolean }) {
  const { profile } = useAuth()
  const [row, setRow] = useState<Onboarding | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>(blank)
  const [busy, setBusy] = useState(false)
  const writing = useRef(false)
  const canEdit = !coach && profile?.role === 'client' && profile.id === clientId

  useEffect(() => {
    let active = true
    setLoading(true); setLoadError(''); setRow(null)
    supabase.from('client_onboarding').select('*').eq('client_id', clientId).maybeSingle()
      .then(({ data, error: err }) => {
        if (!active) return
        setLoading(false)
        if (err) { setLoadError('Could not load coaching setup. Please retry when connected.'); return }
        setRow(data as Onboarding | null)
      })
    return () => { active = false }
  }, [clientId, retry])

  const close = useCallback(() => { if (!writing.current) setOpen(false) }, [])
  function edit() {
    if (!canEdit || writing.current) return
    setAnswers(row ? { goals: row.goals, experience: row.experience, equipment: row.equipment, preferred_days: row.preferred_days, food_preferences: row.food_preferences } : { ...blank, preferred_days: [] })
    setStep(0); setError(''); setNotice(''); setOpen(true)
  }
  function next(e: React.FormEvent) {
    e.preventDefault()
    if (step === 0 && (!answers.goals.trim() || !answers.experience)) { setError('Add your goal and training experience.'); return }
    if (step === 1 && (!answers.equipment.trim() || !answers.preferred_days.length)) { setError('Describe your equipment and choose at least one preferred day.'); return }
    if (step < 2) { setError(''); setStep(step + 1); return }
    void save()
  }
  async function save() {
    if (!canEdit || writing.current) return
    writing.current = true; setBusy(true); setError('')
    try {
      const { data, error: err } = await supabase.from('client_onboarding').upsert({
        client_id: clientId, goals: answers.goals.trim(), experience: answers.experience,
        equipment: answers.equipment.trim(), preferred_days: [...answers.preferred_days].sort((a, b) => a - b),
        food_preferences: answers.food_preferences.trim(), updated_at: new Date().toISOString(),
      }).select('*').single()
      if (err || !data) throw new Error('save')
      setRow(data as Onboarding); setOpen(false)
      setNotice('Coaching profile saved. Your coach can now review it.')
    } catch { setError('Could not save your coaching profile. Your answers are still here. Please retry when connected.') }
    finally { writing.current = false; setBusy(false) }
  }
  async function tick(key: ChecklistKey, checked: boolean) {
    if (!canEdit || !row || writing.current) return
    writing.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const { data, error: err } = await supabase.from('client_onboarding').update({ [key]: checked, updated_at: new Date().toISOString() }).eq('client_id', clientId).select('*').single()
      if (err || !data) throw new Error('save')
      setRow(data as Onboarding)
    } catch { setError('Could not save checklist progress. Please retry when connected.') }
    finally { writing.current = false; setBusy(false) }
  }

  const completed = row ? tasks.filter(task => row[task.key]).length : 0
  return (
    <section className="card stack" aria-label="Coaching setup" style={{ overflowWrap: 'anywhere' }}>
      <span className="eyebrow">{coach ? 'Client onboarding' : 'Welcome to PTPN'}</span>
      <h2 style={{ margin: 0 }}>{coach ? 'Coaching profile' : 'Your coaching starts here'}</h2>
      {loading ? <p className="mute" role="status">Loading coaching setup...</p> : loadError ? <>
        <p className="err" role="alert">{loadError}</p>
        <button className="soft" onClick={() => setRetry(v => v + 1)}>Retry coaching setup</button>
      </> : <>
        {!row ? <p className="mute" style={{ margin: 0 }}>{coach ? 'This client has not completed their coaching setup yet.' : 'Tell me what you want to achieve and how training fits your life. I will review your answers before shaping your plan. Start with a few simple steps, at your own pace. Your coach, Pedro.'}</p> : <>
          <div className="stack small" style={{ gap: 8, whiteSpace: 'pre-wrap' }}>
            <span><b>Goals:</b> {row.goals}</span>
            <span><b>Experience:</b> {row.experience ? levels[row.experience] : ''}</span>
            <span><b>Equipment and location:</b> {row.equipment}</span>
            <span><b>Preferred days:</b> {row.preferred_days.map(d => days[d - 1]).join(', ')}</span>
            <span><b>Food preferences:</b> {row.food_preferences || 'None shared'}</span>
          </div>
          {!coach && <p className="mute small" style={{ margin: 0 }}>Your coach can review these answers. Your training plan and nutrition targets are set separately.</p>}
          {coach ? <p className="mute small" style={{ margin: 0 }}>First-week checklist: {completed}/3 completed by the client.</p> : <details open={completed < 3}>
            <summary style={{ cursor: 'pointer', padding: '12px 0', minHeight: 44 }}>Your first week · {completed}/3 complete</summary>
            <p className="mute small">Explore each page, then tick it off when you feel ready. If your plan is not available yet, ask your coach in Chat.</p>
            <div className="stack">
              {tasks.map(task => <div key={task.key} className="stack" style={{ gap: 0 }}>
                <label className="tick" style={{ minHeight: 44 }}><input type="checkbox" checked={row[task.key]} disabled={busy} onChange={e => void tick(task.key, e.target.checked)} /><span>{task.label}</span></label>
                <Link to={task.link} className="link" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>{task.action}</Link>
              </div>)}
            </div>
          </details>}
        </>}
        {canEdit && <button className={row ? 'soft' : ''} disabled={busy} onClick={edit}>{row ? 'Update coaching profile' : 'Start coaching setup'}</button>}
      </>}
      {notice && <p className="ok small" role="status">{notice}</p>}
      {error && !open && <p className="err" role="alert">{error}</p>}
      <Sheet open={open} onClose={close} title="Your coaching profile">
        <form className="stack" onSubmit={next}>
          <p className="mute small" role="status">Step {step + 1} of 3 · {['Your goals', 'Your routine', 'Food preferences'][step]}</p>
          {step === 0 && <>
            <label className="field">What would you like to achieve?<textarea rows={3} required maxLength={1200} value={answers.goals} onChange={e => setAnswers({ ...answers, goals: e.target.value })} placeholder="Your main goal and what success would feel like" /></label>
            <label className="field">Training experience<select required value={answers.experience} onChange={e => setAnswers({ ...answers, experience: e.target.value as Experience })}>
              <option value="">Choose your experience</option>
              {Object.entries(levels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select></label>
          </>}
          {step === 1 && <>
            <label className="field">Where will you train and what equipment is available?<textarea rows={3} required maxLength={1200} value={answers.equipment} onChange={e => setAnswers({ ...answers, equipment: e.target.value })} placeholder="Gym, home, outdoors, or no equipment" /></label>
            <fieldset className="stack" style={{ border: 0, margin: 0, padding: 0, gap: 0 }}>
              <legend>Preferred training days</legend>
              <p className="mute small">Choose at least one. These are preferences, not a fixed schedule.</p>
              {days.map((day, i) => <label className="tick" key={day} style={{ minHeight: 44 }}><input type="checkbox" checked={answers.preferred_days.includes(i + 1)} onChange={e => setAnswers({ ...answers, preferred_days: e.target.checked ? [...answers.preferred_days, i + 1] : answers.preferred_days.filter(d => d !== i + 1) })} /><span>{day}</span></label>)}
            </fieldset>
          </>}
          {step === 2 && <>
            <label className="field">Food preferences (optional)<textarea rows={4} maxLength={1200} disabled={busy} value={answers.food_preferences} onChange={e => setAnswers({ ...answers, food_preferences: e.target.value })} placeholder="Foods you enjoy or avoid, dietary preferences and time for cooking" /></label>
            <p className="mute small">Allergies and health conditions belong in your health and consent form under Account. Only you and your coach can read these answers.</p>
          </>}
          {error && <p className="err" role="alert">{error}</p>}
          <div className="row">
            {step > 0 && <button type="button" className="soft" disabled={busy} onClick={() => { setError(''); setStep(step - 1) }}>Back</button>}
            <button disabled={busy}>{busy ? 'Saving...' : step < 2 ? 'Continue' : 'Save coaching profile'}</button>
          </div>
          <p className="mute small">Your answers are saved when you finish step 3.</p>
        </form>
      </Sheet>
    </section>
  )
}
