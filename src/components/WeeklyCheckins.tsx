import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { addDays, localDate, niceDate, startOfWeek } from '../lib/dates'
import { Sheet } from './ui'

interface Checkin {
  id: string; client_id: string; week_start: string; training: string; nutrition: string
  sleep_hours: number; energy: number; biggest_win: string; difficulties: string; submitted_at: string
}
interface Review { checkin_id: string; feedback: string; next_focus: string }
const questions = [
  ['training', 'How did training go?'], ['nutrition', 'How did nutrition go?'],
  ['biggest_win', 'Biggest win'], ['difficulties', 'Difficulties or support needed'],
] as const
const blank = { training: '', nutrition: '', biggest_win: '', difficulties: '', sleep_hours: '', energy: '3' }
const weekLabel = (week: string) => niceDate(week) + ' to ' + niceDate(addDays(week, 6))

export default function WeeklyCheckins({ clientId, coach = false }: { clientId: string; coach?: boolean }) {
  const [params] = useSearchParams()
  const requested = params.get('reviewWeek') ?? ''
  const currentWeek = startOfWeek(localDate())
  const initialWeek = /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= currentWeek && startOfWeek(requested) === requested ? requested : currentWeek
  const [week, setWeek] = useState(initialWeek)
  const [checkin, setCheckin] = useState<Checkin | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  const [draft, setDraft] = useState(blank)
  const [feedback, setFeedback] = useState('')
  const [focus, setFocus] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [retry, setRetry] = useState(0)
  const [summary, setSummary] = useState<{ done: number; due: number; foodDays: number; weights: string } | null>(null)
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(currentWeek, -7 * i))
  if (!weeks.includes(week)) weeks.push(week)

  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setCheckin(null); setReview(null); setSummary(null)
    setDraft(blank); setFeedback(''); setFocus(''); setSaved(false); setOpen(false)
    ;(async () => {
      try {
        const c = await supabase.from('weekly_checkins').select('*').eq('client_id', clientId).eq('week_start', week).maybeSingle()
        if (c.error) throw c.error
        const item = c.data as Checkin | null
        let reply: Review | null = null
        if (item) {
          const r = await supabase.from('weekly_reviews').select('*').eq('checkin_id', item.id).maybeSingle()
          if (r.error) throw r.error
          reply = r.data as Review | null
        }
        let stats = null
        if (coach && item) {
          const end = addDays(week, 6) < localDate() ? addDays(week, 6) : localDate()
          const [w, f, m] = await Promise.all([
            supabase.from('client_workouts').select('status').eq('client_id', clientId).gte('date', week).lte('date', end),
            supabase.from('food_logs').select('date').eq('client_id', clientId).gte('date', week).lte('date', end),
            supabase.from('measurements').select('date,weight_kg').eq('client_id', clientId).gte('date', week).lte('date', end).not('weight_kg', 'is', null).order('date'),
          ])
          if (w.error || f.error || m.error) throw w.error || f.error || m.error
          stats = { done: (w.data ?? []).filter(x => x.status === 'done').length, due: (w.data ?? []).length,
            foodDays: new Set((f.data ?? []).map(x => x.date)).size,
            weights: m.data?.length ? m.data.map(x => niceDate(x.date) + ': ' + Number(x.weight_kg) + ' kg').join('; ') : 'No weight entries this week' }
        }
        if (!active) return
        setCheckin(item); setReview(reply); setFeedback(reply?.feedback ?? ''); setFocus(reply?.next_focus ?? ''); setSummary(stats)
      } catch { if (active) setError('Could not load this weekly check-in. Please try again when connected.') }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [clientId, coach, week, retry])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      const { data, error: err } = await supabase.from('weekly_checkins').insert({
        client_id: clientId, week_start: week, training: draft.training.trim(), nutrition: draft.nutrition.trim(),
        biggest_win: draft.biggest_win.trim(), difficulties: draft.difficulties.trim(),
        sleep_hours: Number(draft.sleep_hours), energy: Number(draft.energy),
      }).select().single()
      if (err) throw err
      setCheckin(data as Checkin); setOpen(false)
    } catch { setError('Could not submit your check-in. Your answers are still here. Try again when connected. If already submitted on another device, close and reload.') }
    finally { setBusy(false) }
  }

  async function saveReview(e: React.FormEvent) {
    e.preventDefault(); if (!checkin) return
    setBusy(true); setError(''); setSaved(false)
    const value = { checkin_id: checkin.id, feedback: feedback.trim(), next_focus: focus.trim() }
    try {
      const { error: err } = await supabase.from('weekly_reviews').upsert(value, { onConflict: 'checkin_id' })
      if (err) throw err
      setReview(value); setSaved(true)
    } catch { setError('Could not save your review. Your feedback is still here. Please try again when connected.') }
    finally { setBusy(false) }
  }

  const status = !loading && checkin ? <span className={'badge ' + (review ? 'green' : 'amber')} style={{ justifySelf: 'start' }}>{review ? 'Reviewed by coach' : 'Awaiting coach review'}</span> : null
  return <details className="card collapsible-card" role="region" aria-label="Weekly check-in" open={coach ? undefined : true}>
    <summary><span>{coach ? <span className="eyebrow">Client review</span> : <span className="eyebrow">This week</span>}<b>Weekly check-in</b>{!coach && status}</span></summary>
    <p className="mute small">Monday to Sunday. Sunday is the suggested check-in day; you can submit any day.</p>
    <label className="field"><b>Review week</b><select value={week} disabled={busy} onChange={e => setWeek(e.target.value)}>
      {weeks.map(w => <option key={w} value={w}>{weekLabel(w)}</option>)}
    </select></label>
    {loading ? <p role="status">Loading weekly check-in...</p> : <>
      {error && !open && <p className="err" role="alert">{error}</p>}
      {error && !checkin && !open ? <button className="soft" onClick={() => setRetry(n => n + 1)}>Retry weekly check-in</button> : !checkin ? <>
        <p className="mute">{coach ? 'No weekly check-in submitted for this week.' : 'Share your wins, challenges and how you have been feeling.'}</p>
        {!coach && <button onClick={() => { setError(''); setOpen(true) }}>Complete weekly check-in</button>}
      </> : <>
        <span className={'badge ' + (review ? 'green' : 'amber')}>{review ? 'Reviewed by coach' : 'Awaiting coach review'}</span>
        <p className="mute small">Submitted {niceDate(localDate(new Date(checkin.submitted_at)))}</p>
        {summary && <div className="stack small">
          <p><b>Workouts:</b> {summary.done} of {summary.due} due completed</p>
          <p><b>Food diary:</b> {summary.foodDays} days with entries. This does not measure target adherence.</p>
          <p><b>Weight entries:</b> {summary.weights}</p>
        </div>}
        {questions.map(([key, label]) => <div key={key}><b>{label}</b><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{checkin[key]}</p></div>)}
        <p>Average sleep: {Number(checkin.sleep_hours)} hours. Energy: {checkin.energy}/5.</p>
        {coach ? <form className="col" onSubmit={saveReview}>
          <label className="field"><b>Coach feedback</b><textarea required maxLength={2000} rows={4} value={feedback} onChange={e => { setFeedback(e.target.value); setSaved(false) }} /></label>
          <label className="field"><b>Next week's focus</b><textarea required maxLength={1000} rows={3} value={focus} onChange={e => { setFocus(e.target.value); setSaved(false) }} /></label>
          <p className="mute small">Both fields will be visible to your client.</p>
          <button disabled={busy || !feedback.trim() || !focus.trim()}>{busy ? 'Saving...' : review ? 'Update weekly review' : 'Send weekly review'}</button>
          {saved && <p className="ok" role="status">Weekly review saved and visible to your client.</p>}
        </form> : review ? <div className="card tight">
          <h3>Coach feedback</h3><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{review.feedback}</p>
          <h3>Next week's focus</h3><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{review.next_focus}</p>
        </div> : <p className="mute">Your coach's feedback will appear here.</p>}
      </>}
    </>}
    <Sheet open={open} onClose={() => { if (!busy) setOpen(false) }} title="Complete weekly check-in">
      <form className="col" onSubmit={submit}>
        <p className="mute small">{weekLabel(week)}. Answers are final once submitted so your coach reviews a consistent record.</p>
        {questions.map(([key, label]) => <label key={key} className="field"><b>{label}</b>
          <textarea required maxLength={2000} rows={3} value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} />
        </label>)}
        <label className="field"><b>Average sleep (hours per night)</b><input type="number" inputMode="decimal" required min="0" max="24" step="0.25" value={draft.sleep_hours} onChange={e => setDraft(d => ({ ...d, sleep_hours: e.target.value }))} /></label>
        <label className="field"><b>Average energy</b><select value={draft.energy} onChange={e => setDraft(d => ({ ...d, energy: e.target.value }))}>
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} / 5{n === 1 ? ' - Drained' : n === 5 ? ' - Full of energy' : ''}</option>)}
        </select></label>
        {error && <p className="err" role="alert">{error}</p>}
        <button disabled={busy || questions.some(([key]) => !draft[key].trim())}>{busy ? 'Submitting...' : 'Submit weekly check-in'}</button>
      </form>
    </Sheet>
  </details>
}

export function WeeklyReviewQueue({ clients, onCount }: { clients: { id: string; full_name: string }[]; onCount?: (count: number, ids?: string[]) => void }) {
  const [pending, setPending] = useState<Checkin[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true); setError(false)
      try {
        const c = await supabase.from('weekly_checkins').select('*').order('week_start', { ascending: false }).limit(100)
        if (c.error) throw c.error
        const items = (c.data ?? []) as Checkin[]
        const [r, a] = await Promise.all([
          items.length ? supabase.from('weekly_reviews').select('checkin_id').in('checkin_id', items.map(x => x.id)) : Promise.resolve({ data: [], error: null }),
          supabase.from('client_archives').select('client_id'),
        ])
        if (r.error || a.error) throw r.error || a.error
        const reviewed = new Set((r.data ?? []).map(x => x.checkin_id))
        const archived = new Set((a.data ?? []).map(x => x.client_id))
        if (active) { const next = items.filter(x => !reviewed.has(x.id) && !archived.has(x.client_id)); setPending(next); onCount?.(next.length, next.map(x => x.id)) }
      } catch { if (active) { setError(true); onCount?.(-1) } }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [retry])
  return <section className="card tight" aria-label="Weekly reviews">
    <h2>Weekly reviews</h2>
    {loading ? <p role="status">Loading reviews...</p> : error ? <>
      <p className="err" role="alert">Could not load weekly reviews.</p><button className="soft" onClick={() => setRetry(n => n + 1)}>Retry weekly reviews</button>
    </> : <>
      <p className="mute small">{pending.length ? pending.length + ' awaiting your feedback' : 'No pending reviews among the latest 100 check-ins.'}</p>
      <div className="list">{pending.map(c => <Link className="item" key={c.id} to={'/clients/' + c.client_id + '?reviewWeek=' + c.week_start}>
        <span className="grow"><span className="title">{clients.find(x => x.id === c.client_id)?.full_name ?? 'Client'}</span><br /><span className="meta">Week of {niceDate(c.week_start)}</span></span>
        <span className="badge amber">Review</span>
      </Link>)}</div>
    </>}
  </section>
}

