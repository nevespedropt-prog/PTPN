import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { supabase } from '../lib/supabase'
import { localDate, niceDate } from '../lib/dates'
import { monthWindow, monthlySummary, shiftMonth } from '../lib/monthly'
import { FORMAT_LABEL, personalRecords, type PR } from '../lib/training'
import type { ClientWorkout, Measurement, Workout, WorkoutItem } from '../types'
import { Chart } from './Chart'
import { Tile } from './ui'
import Icon from './Icon'

type Review = { client_id: string; month_start: string; feedback: string; next_focus: string }
type ReportData = { workouts: ClientWorkout[]; measurements: Measurement[]; items: WorkoutItem[]; library: Record<string, Workout> }
const TREND_MONTHS = 6
const shortMonth = (month: string) => new Date(month + '-01T12:00:00').toLocaleDateString('en-GB', { month: 'short' })
const dayOf = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const setsDone = (c: ClientWorkout) => Object.values(c.log?.items ?? {}).flat().filter(s => s.done).length
const secondsOf = (c: ClientWorkout) => c.log?.timer?.elapsed_sec ?? c.log?.seconds ?? 0
const hoursText = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`
const label = (month: string) => new Date(month + '-01T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
const change = (points: { y: number }[]) => points.length < 2 ? null : Math.round((points[points.length - 1].y - points[0].y) * 10) / 10
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`

export default function MonthlyReport({ clientId, coach, onPhotos }: { clientId: string; coach: boolean; onPhotos: () => void }) {
  const { profile } = useAuth()
  const here = useLocation()
  const back = here.pathname + here.search
  const [today] = useState(() => localDate())
  const currentMonth = today.slice(0, 7)
  const [month, setMonth] = useState(currentMonth)
  const [data, setData] = useState<ReportData | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  const [feedback, setFeedback] = useState('')
  const [focus, setFocus] = useState('')
  const [trend, setTrend] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  const writing = useRef(false)
  const canReview = coach && profile?.role === 'coach'
  const window = monthWindow(month, today)
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(currentMonth, -i))

  // Finished workouts per month for the last few months, so the bars show the trend whichever month is open.
  useEffect(() => {
    let active = true
    setTrend(null)
    supabase.from('client_workouts').select('date').eq('client_id', clientId).eq('status', 'done').gte('date', shiftMonth(currentMonth, 1 - TREND_MONTHS) + '-01').lte('date', today).limit(1000)
      .then(r => {
        if (!active || r.error) return
        const counts: Record<string, number> = {}
        for (const row of (r.data ?? []) as { date: string }[]) counts[row.date.slice(0, 7)] = (counts[row.date.slice(0, 7)] ?? 0) + 1
        setTrend(counts)
      })
    return () => { active = false }
  }, [clientId, currentMonth, today, retry])

  useEffect(() => {
    let active = true
    setLoading(true); setLoadError(''); setData(null); setReview(null)
    setFeedback(''); setFocus(''); setSaved(false); setSaveError('')
    ;(async () => {
      try {
        const range = monthWindow(month, today)
        const [w, m, r] = await Promise.all([
          supabase.from('client_workouts').select('*').eq('client_id', clientId).gte('date', range.previous).lte('date', range.end).order('date').limit(1000),
          supabase.from('measurements').select('*').eq('client_id', clientId).gte('date', range.previous).lte('date', range.end).order('date').limit(1000),
          supabase.from('monthly_reviews').select('*').eq('client_id', clientId).eq('month_start', range.start).maybeSingle(),
        ])
        if (w.error || m.error || r.error) throw new Error('load')
        if ((w.data?.length ?? 0) >= 1000 || (m.data?.length ?? 0) >= 1000) throw new Error('limit')
        const workouts = (w.data ?? []) as ClientWorkout[]
        const ids = [...new Set(workouts.filter(w => w.status === 'done').map(w => w.workout_id))]
        let items: WorkoutItem[] = []
        const library: Record<string, Workout> = {}
        if (ids.length) {
          const result = await supabase.from('workout_items').select('*').in('workout_id', ids).limit(1000)
          if (result.error || (result.data?.length ?? 0) >= 1000) throw new Error('items')
          items = (result.data ?? []) as WorkoutItem[]
          for (let i = 0; i < ids.length; i += 40) {
            const batch = await supabase.from('workouts').select('*').in('id', ids.slice(i, i + 40))
            if (batch.error) throw new Error('workouts')
            for (const w of (batch.data ?? []) as Workout[]) library[w.id] = w
          }
        }
        if (!active) return
        const reply = r.data as Review | null
        setData({ workouts, measurements: (m.data ?? []) as Measurement[], items, library })
        setReview(reply); setFeedback(reply?.feedback ?? ''); setFocus(reply?.next_focus ?? '')
      } catch { if (active) setLoadError('Could not load the complete workouts report. Please retry when connected. If this continues, contact your coach.') }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [clientId, month, today, retry])

  function choose(value: string) {
    if (writing.current) return
    const dirty = canReview && (feedback !== (review?.feedback ?? '') || focus !== (review?.next_focus ?? ''))
    if (dirty && !confirm('Changing months will discard unsaved review edits. Continue?')) return
    setMonth(value)
  }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!canReview || writing.current || !data || loading || loadError) return
    setSaveError(''); setSaved(false)
    if (!feedback.trim() || !focus.trim()) { setSaveError('Add feedback and a focus for next month.'); return }
    writing.current = true; setBusy(true)
    const value: Review = { client_id: clientId, month_start: window.start, feedback: feedback.trim(), next_focus: focus.trim() }
    try {
      const result = await supabase.from('monthly_reviews').upsert({ ...value, updated_at: new Date().toISOString() }, { onConflict: 'client_id,month_start' }).select('*').single()
      if (result.error || !result.data) throw new Error('save')
      setReview(value); setFeedback(value.feedback); setFocus(value.next_focus); setSaved(true)
    } catch { setSaveError('Could not save the monthly review. Your feedback is still here. Please retry when connected.') }
    finally { writing.current = false; setBusy(false) }
  }

  const summary = data ? monthlySummary(data.workouts, data.measurements, window.start, window.end) : null
  let strength: { now: PR; previous: PR | undefined }[] = []
  if (data) {
    const items = new Map(data.items.map(i => [i.id, i]))
    const completed = data.workouts.filter(w => w.status === 'done')
    const previous = new Map(personalRecords(completed.filter(w => w.date < window.start), items).map(p => [p.exercise.trim().toLowerCase(), p]))
    strength = personalRecords(completed.filter(w => w.date >= window.start), items).map(now => ({ now, previous: previous.get(now.exercise.trim().toLowerCase()) }))
  }
  const monthDone = data ? data.workouts.filter(w => w.status === 'done' && w.date >= window.start && w.date <= window.end).sort((a, b) => b.date.localeCompare(a.date) || (b.completed_at ?? '').localeCompare(a.completed_at ?? '')) : []
  const previousDone = data ? data.workouts.filter(w => w.status === 'done' && w.date >= window.previous && w.date < window.start).length : 0
  const minutes = Math.round(monthDone.reduce((n, c) => n + secondsOf(c), 0) / 60)
  const sets = monthDone.reduce((n, c) => n + setsDone(c), 0)
  const own = (c: ClientWorkout) => data?.library[c.workout_id]?.created_by === clientId
  const ownCount = monthDone.filter(own).length
  const bars = Array.from({ length: TREND_MONTHS }, (_, i) => shiftMonth(currentMonth, i + 1 - TREND_MONTHS))
  const peak = Math.max(1, ...bars.map(m => trend?.[m] ?? 0))
  const lastWeight = summary?.trend.at(-1), lastFat = summary?.fat.at(-1)
  const weightChange = summary ? change(summary.trend) : null, fatChange = summary ? change(summary.fat) : null

  return <section aria-label="Workouts report" className="stack" style={{ overflowWrap: 'anywhere' }}>
    <div className="card stack">
      <span className="eyebrow">Workouts and progress</span>
      <h2 style={{ margin: 0 }}>{label(month)}{window.partial ? ' so far' : ''}</h2>
      <label className="field">Month<select aria-label="Report month" value={month} disabled={busy} onChange={e => choose(e.target.value)}>
        {months.map(m => <option key={m} value={m}>{label(m)}{m === currentMonth ? ' so far' : ''}</option>)}
      </select></label>
      <p className="mute small" style={{ margin: 0 }}>{niceDate(window.start)} to {niceDate(window.end)}. Figures use current records for this period; your coach's review is saved separately.</p>
    </div>
    {loading ? <p role="status">Loading workouts report...</p> : loadError ? <div className="card stack">
      <p className="err" role="alert">{loadError}</p><button className="soft" onClick={() => setRetry(v => v + 1)}>Retry monthly report</button>
    </div> : summary && <>
      <div className="grid g2">
        <Tile label="Workouts completed" value={`${summary.done}/${summary.due}`} foot={summary.due ? `${Math.round(summary.done / summary.due * 100)}% of sessions due` : 'No sessions due in this period'} />
        <Tile label="Training days" value={summary.trainingDays} foot="days with a completed workout" />
        <Tile label="Time trained" value={minutes ? hoursText(minutes) : '-'} foot={minutes ? 'from workouts with a timer' : 'No timed workouts this month'} />
        <Tile label="Sets done" value={sets || '-'} foot={sets ? 'ticked in finished workouts' : 'No sets ticked this month'} />
        <Tile label="Weight average" value={lastWeight?.y ?? '-'} unit={lastWeight ? 'kg' : ''} foot={lastWeight ? `7-day average at ${niceDate(lastWeight.x)}` : 'No weight entries this month'} />
        <Tile label="Body fat" value={lastFat?.y ?? '-'} unit={lastFat ? '%' : ''} foot={lastFat ? `Latest daily average, ${niceDate(lastFat.x)}` : 'No body-fat entries this month'} />
      </div>
      <p className="mute small">Workouts are grouped by their scheduled date. Skipped and missed sessions remain in the total; future sessions are excluded.</p>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Workouts per month</h3>
        {trend ? <>
          <div className="bars" role="group" aria-label="Workouts per month">
            {bars.map(m => <button key={m} type="button" className={'bar' + (m === month ? ' on' : '')} aria-pressed={m === month} aria-label={`${label(m)}: ${trend[m] ?? 0} workouts`} disabled={busy} onClick={() => choose(m)}>
              <span className="n">{trend[m] ?? 0}</span>
              <span className="track"><span className="fill" style={{ height: `${Math.round(((trend[m] ?? 0) / peak) * 100)}%` }} /></span>
              <span className="m">{shortMonth(m)}</span>
            </button>)}
          </div>
          <p className="small" style={{ margin: 0 }}>{summary.done} finished in {label(month)}{previousDone || summary.done ? `, ${summary.done === previousDone ? 'the same as' : `${signed(summary.done - previousDone)} compared with`} the month before (${previousDone}).` : '.'} Tap a bar to open that month.</p>
        </> : <p className="mute small" role="status">Loading the trend...</p>}
      </div>
      <details className="card collapsible-card" aria-label={`Workouts in ${label(month)}`}>
        <summary><span><span className="eyebrow">{monthDone.length} finished{ownCount || monthDone.length ? ` · ${monthDone.length - ownCount} coach plan · ${ownCount} ${coach ? 'built by the client' : 'built by you'}` : ''}</span><b>Workouts in {label(month)}</b></span></summary>
        {monthDone.length === 0 ? <p className="mute">No finished workouts in this month.</p> : <div className="list">
          {monthDone.map(c => {
            const w = data?.library[c.workout_id], min = Math.round(secondsOf(c) / 60), n = setsDone(c)
            return <Link key={c.id} to={`/workout/${c.id}?returnTo=${encodeURIComponent(back)}`} className="item">
              <span className="grow">
                <span className="title">{w?.name ?? 'Workout'}</span><br />
                <span className="meta">{dayOf(c.date)}{w ? ` · ${FORMAT_LABEL[w.format]}` : ''}{min ? ` · ${min} min` : ''}{n ? ` · ${n} sets` : ''}{c.rating ? ` · ${'★'.repeat(c.rating)}` : ''}</span>
              </span>
              <span className={'badge ' + (own(c) ? 'amber' : 'green')}>{own(c) ? 'Own' : 'Coach plan'}</span>
              <Icon name="chev" />
            </Link>
          })}
        </div>}
      </details>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Weight trend</h3>
        <p className="mute small" style={{ margin: 0 }}>Seven-day rolling average of recorded daily weights. Multiple entries on one day are averaged first. Missing days are not estimated.</p>
        {summary.trend.length ? <>
          <Chart points={summary.trend} unit="kg" />
          <p className="small" style={{ margin: 0 }}>{summary.weights.length} days with weight entries.{weightChange != null ? ` Change between first and latest rolling average: ${signed(weightChange)} kg.` : ' More entries are needed to show change.'}</p>
          <p className="mute small" style={{ margin: 0 }}>First: {niceDate(summary.trend[0].x)}. Latest: {niceDate(summary.trend[summary.trend.length - 1].x)}. Each average includes recorded days in its seven-day window, including the previous month where available.</p>
        </> : <p className="mute">No weight entries this month.</p>}
        <h3 style={{ marginBottom: 0 }}>Body measurements</h3>
        <p className="small" style={{ margin: 0 }}>{fatChange != null ? `Body-fat change between first and latest daily average: ${signed(fatChange)} percentage points.` : lastFat ? 'One day with body-fat data. More entries are needed to show change.' : 'No body-fat entries this month.'}</p>
        <p className="mute small" style={{ margin: 0 }}>Only weight and body-fat measurements currently recorded in PTPN are included.</p>
      </div>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Strength progress</h3>
        <p className="mute small" style={{ margin: 0 }}>Best estimated 1RM from completed weighted sets this month, compared with the previous calendar month. Estimates are not tested maximums.{window.partial ? ' This month is still in progress.' : ''}</p>
        {!strength.length && <p className="mute">No comparable weighted sets logged this month.</p>}
        {strength.slice(0, 8).map(({ now, previous }) => <div key={now.exercise} className="stack" style={{ gap: 4 }}>
          <b>{now.exercise}</b><span className="small">{now.kg} kg x {now.reps} reps. Estimated 1RM: {now.e1rm} kg.</span>
          <span className="mute small">{previous ? `Previous month: ${previous.e1rm} kg. Change: ${signed(Math.round((now.e1rm - previous.e1rm) * 10) / 10)} kg.` : 'No previous-month comparison for this exercise.'}</span>
        </div>)}
        {strength.length > 8 && <p className="mute small">Showing the eight highest estimated lifts.</p>}
      </div>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Progress photos</h3>
        <p className="mute small" style={{ margin: 0 }}>Optional photos stay private to you and your coach. Open Photos to compare the first and latest photo of the same pose across your history.</p>
        <button className="soft" onClick={onPhotos}>View private photo comparisons</button>
      </div>
      <div className="card stack">
        <h3 style={{ margin: 0 }}>Coach review</h3>
        {canReview ? <form className="stack" onSubmit={save}>
          <label className="field">Monthly feedback<textarea aria-label="Monthly feedback" rows={4} required maxLength={2000} value={feedback} disabled={busy} onChange={e => { setFeedback(e.target.value); setSaved(false) }} /></label>
          <label className="field">Next month's focus<textarea aria-label="Next month's focus" rows={3} required maxLength={1000} value={focus} disabled={busy} onChange={e => { setFocus(e.target.value); setSaved(false) }} /></label>
          {saveError && <p className="err" role="alert">{saveError}</p>}
          {saved && <p className="ok" role="status">Monthly review saved and visible to your client.</p>}
          <button disabled={busy}>{busy ? 'Saving...' : review ? 'Update monthly review' : 'Save monthly review'}</button>
        </form> : review ? <div className="stack" style={{ whiteSpace: 'pre-wrap' }}>
          <p style={{ margin: 0 }}>{review.feedback}</p><b>Next month's focus</b><p style={{ margin: 0 }}>{review.next_focus}</p>
        </div> : <p className="mute">No coach review for this month yet.</p>}
      </div>
    </>}
  </section>
}
