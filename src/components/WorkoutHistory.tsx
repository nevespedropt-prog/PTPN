import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FORMAT_LABEL } from '../lib/training'
import type { ClientWorkout, Workout } from '../types'
import { Empty, Skeleton } from './ui'
import Icon from './Icon'

const LIMIT = 300
const monthOf = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
const dayOf = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const setsDone = (c: ClientWorkout) => Object.values(c.log?.items ?? {}).flat().filter(s => s.done).length
const minutesOf = (c: ClientWorkout) => { const sec = c.log?.timer?.elapsed_sec ?? c.log?.seconds; return sec ? Math.max(1, Math.round(sec / 60)) : 0 }

// Every finished workout, newest first, in one box per month so a long history stays tidy.
export default function WorkoutHistory({ clientId, coach }: { clientId: string; coach: boolean }) {
  const here = useLocation()
  const back = here.pathname + here.search
  const [done, setDone] = useState<ClientWorkout[] | null>(null)
  const [workouts, setWorkouts] = useState<Record<string, Workout>>({})
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    try {
      const result = await supabase.from('client_workouts').select('*').eq('client_id', clientId).eq('status', 'done').order('date', { ascending: false }).order('completed_at', { ascending: false }).limit(LIMIT)
      if (result.error) throw result.error
      const list = (result.data ?? []) as ClientWorkout[]
      const ids = [...new Set(list.map(c => c.workout_id))]
      const found: Record<string, Workout> = {}
      for (let i = 0; i < ids.length; i += 40) {
        const batch = await supabase.from('workouts').select('*').in('id', ids.slice(i, i + 40))
        if (batch.error) throw batch.error
        for (const w of (batch.data ?? []) as Workout[]) found[w.id] = w
      }
      setWorkouts(found); setDone(list)
    } catch { setError(true) }
  }, [clientId])
  useEffect(() => { setDone(null); void load() }, [load])

  if (error) return <div className="card" role="alert"><p>Could not load the workouts. Please try again when connected.</p><button className="soft" onClick={() => void load()}>Retry workouts</button></div>
  if (!done) return <Skeleton n={3} />
  if (done.length === 0) return <div className="card"><Empty icon="train" title="No finished workouts yet">Workouts appear here once they are completed.</Empty></div>

  const own = (c: ClientWorkout) => workouts[c.workout_id]?.created_by === clientId
  const ownCount = done.filter(own).length
  const months = new Map<string, ClientWorkout[]>()
  for (const c of done) { const key = monthOf(c.date); months.set(key, [...(months.get(key) ?? []), c]) }

  return <>
    <div className="card" role="status">
      <b>{done.length} workout{done.length === 1 ? '' : 's'} done</b><br />
      <span className="mute small">{done.length - ownCount} from the coach plan · {ownCount} {coach ? 'built by the client' : 'built by you'}{done.length >= LIMIT ? ` · latest ${LIMIT} shown` : ''}</span>
    </div>
    {[...months].map(([month, list]) => <details key={month} className="card collapsible-card" aria-label={month}>
      <summary><span><span className="eyebrow">{list.length} workout{list.length === 1 ? '' : 's'}</span><b>{month}</b></span></summary>
      <div className="list">
        {list.map(c => {
          const w = workouts[c.workout_id]
          const minutes = minutesOf(c), sets = setsDone(c)
          return <Link key={c.id} to={`/workout/${c.id}?returnTo=${encodeURIComponent(back)}`} className="item">
            <span className="grow">
              <span className="title">{w?.name ?? 'Workout'}</span><br />
              <span className="meta">{dayOf(c.date)}{w ? ` · ${FORMAT_LABEL[w.format]}` : ''}{minutes ? ` · ${minutes} min` : ''}{sets ? ` · ${sets} sets` : ''}{c.rating ? ` · ${'★'.repeat(c.rating)}` : ''}</span>
            </span>
            <span className={'badge ' + (own(c) ? 'amber' : 'green')}>{own(c) ? 'Own' : 'Coach plan'}</span>
            <Icon name="chev" />
          </Link>
        })}
      </div>
    </details>)}
  </>
}
