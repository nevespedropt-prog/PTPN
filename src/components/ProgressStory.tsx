import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDays, localDate, niceDate, startOfWeek } from '../lib/dates'
import type { ClientWorkout, Measurement } from '../types'
import { Empty, Tile } from './ui'

type Review = { month_start: string; feedback: string; next_focus: string }
type StoryData = { workouts: ClientWorkout[]; measurements: Measurement[]; review: Review | null }

export default function ProgressStory({ clientId, coach }: { clientId: string; coach: boolean }) {
  const [data, setData] = useState<StoryData | null>(null)
  const [error, setError] = useState(false)
  const load = useCallback(async () => {
    setData(null); setError(false)
    const today = localDate()
    try {
      const [workouts, measurements, reviews] = await Promise.all([
        supabase.from('client_workouts').select('*').eq('client_id', clientId).eq('status', 'done').gte('date', addDays(today, -27)).lte('date', today).order('date', { ascending: false }).limit(1000),
        supabase.from('measurements').select('*').eq('client_id', clientId).order('date', { ascending: false }).limit(2),
        supabase.from('monthly_reviews').select('month_start,feedback,next_focus').eq('client_id', clientId).order('month_start', { ascending: false }).limit(1),
      ])
      if (workouts.error || measurements.error || reviews.error || (workouts.data?.length ?? 0) >= 1000) throw new Error('Progress unavailable')
      setData({ workouts: (workouts.data ?? []) as ClientWorkout[], measurements: (measurements.data ?? []) as Measurement[], review: ((reviews.data ?? [])[0] as Review | undefined) ?? null })
    } catch { setError(true) }
  }, [clientId])
  useEffect(() => { load() }, [load])

  if (error) return <section className="card" aria-label="Progress summary"><p className="err" role="alert">Could not load the progress summary.</p><button className="soft" onClick={load}>Retry progress summary</button></section>
  if (!data) return <section className="card" aria-label="Progress summary"><p role="status">Building the progress summary...</p></section>

  const today = localDate(), week = startOfWeek(today), previousStart = addDays(week, -7), previousEnd = addDays(week, -1)
  const current = data.workouts.filter(item => item.date >= week && item.date <= today)
  const previous = data.workouts.filter(item => item.date >= previousStart && item.date <= previousEnd)
  const activeDays = new Set(current.map(item => item.date)).size
  const latestWeight = data.measurements.find(item => item.weight_kg != null)
  const earlierWeight = data.measurements.find(item => item.id !== latestWeight?.id && item.weight_kg != null)
  const weightChange = latestWeight && earlierWeight ? Math.round((Number(latestWeight.weight_kg) - Number(earlierWeight.weight_kg)) * 10) / 10 : null
  const difference = current.length - previous.length
  const wins: string[] = []
  if (current.length >= 3) wins.push(`${current.length} workouts completed this week`)
  if (current.length > previous.length) wins.push(`${difference} more workout${difference === 1 ? '' : 's'} than last week`)
  if (data.workouts.length >= 8) wins.push(`${data.workouts.length} sessions completed in four weeks`)
  if (activeDays >= 3) wins.push(`Active on ${activeDays} different days this week`)

  return <section className="card hero" aria-label="Progress summary">
    <div className="row between" style={{ marginBottom: 10 }}><div><span className="eyebrow">Progress story</span><h2 style={{ margin: '3px 0' }}>{coach ? 'Recent client momentum' : 'Your recent momentum'}</h2><p className="mute small" style={{ margin: 0 }}>This week compared with the previous week.</p></div></div>
    <div className="grid g3" style={{ marginBottom: 14 }}>
      <Tile label="Workouts this week" value={current.length} foot={`${difference >= 0 ? '+' : ''}${difference} vs last week`} accent={difference > 0 ? 'var(--gold)' : undefined} />
      <Tile label="Active days" value={activeDays} foot="this week" />
      <Tile label="Latest weight" value={latestWeight?.weight_kg ?? '-'} unit={latestWeight ? 'kg' : ''} foot={weightChange == null ? 'Add two entries for a trend' : `${weightChange > 0 ? '+' : ''}${weightChange} kg since ${niceDate(earlierWeight!.date)}`} />
    </div>
    <div className="split">
      <div>
        <h3 style={{ marginTop: 0 }}>Recent wins</h3>
        {wins.length ? <div className="chips">{wins.map(win => <span className="chip on" key={win}>{win}</span>)}</div> : <Empty icon="trophy" title="The next win starts here">Complete workouts this week to build the progress story.</Empty>}
      </div>
      <div>
        <h3 style={{ marginTop: 0 }}>Coach guidance</h3>
        {data.review ? <div className="card tight" style={{ margin: 0 }}><p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{data.review.feedback}</p><b>Current focus</b><p style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{data.review.next_focus}</p><span className="mute small">Review from {niceDate(data.review.month_start)}</span></div> : <p className="mute">{coach ? 'Add a monthly review to give this client a clear focus.' : 'The latest coach summary and next focus will appear here.'}</p>}
      </div>
    </div>
  </section>
}