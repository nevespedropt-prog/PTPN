import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { addDays, localDate, longDay, niceDate, relDay, weekOf, DAY_NAMES } from '../../lib/dates'
import { FORMAT_LABEL, setsDone, volumeKg } from '../../lib/training'
import type { ClientWorkout, Workout } from '../../types'
import { Empty, PageHead, Seg, Skeleton } from '../../components/ui'
import Icon from '../../components/Icon'

export default function Train() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [today] = useState(() => localDate())
  const [sel, setSel] = useState(today)
  const [tab, setTab] = useState<'plan' | 'history'>('plan')
  const [cws, setCws] = useState<ClientWorkout[] | null>(null)
  const [workouts, setWorkouts] = useState<Record<string, Workout>>({})
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('client_workouts').select('*').eq('client_id', profile.id).order('date')
    const list = (data ?? []) as ClientWorkout[]
    setCws(list)
    const ids = [...new Set(list.map(c => c.workout_id))]
    if (ids.length) {
      const { data: w } = await supabase.from('workouts').select('*').in('id', ids)
      setWorkouts(Object.fromEntries(((w ?? []) as Workout[]).map(x => [x.id, x])))
    }
  }, [profile])
  useEffect(() => { load() }, [load])

  async function buildOwn() {
    if (!profile) return
    setBusy(true)
    const { data: w, error } = await supabase.from('workouts').insert({ name: 'My workout', created_by: profile.id }).select().single()
    if (error || !w) { setBusy(false); return alert(error?.message ?? 'Could not create workout') }
    const { data: cw } = await supabase.from('client_workouts').insert({ client_id: profile.id, workout_id: w.id, date: sel }).select().single()
    setBusy(false)
    nav(`/build/${w.id}${cw ? `?cw=${cw.id}` : ''}`)
  }

  const days = weekOf(sel)
  const byDate = (d: string) => (cws ?? []).filter(c => c.date === d)
  const selected = byDate(sel)
  const upcoming = (cws ?? []).filter(c => c.date > today && c.status === 'scheduled').slice(0, 5)
  const history = (cws ?? []).filter(c => c.status === 'done').sort((a, b) => b.date.localeCompare(a.date))
  const name = (c: ClientWorkout) => workouts[c.workout_id]?.name ?? 'Workout'

  return (
    <>
      <PageHead eyebrow="Training" title="Your plan" sub={`${history.length} workouts completed`}>
        <button className="soft sm" onClick={buildOwn} disabled={busy}><Icon name="plus" size={16} />Build my own</button>
      </PageHead>
      <Seg value={tab} onChange={setTab} options={[{ value: 'plan', label: 'Schedule' }, { value: 'history', label: 'History' }]} />

      {!cws && <Skeleton n={3} />}
      {cws && tab === 'plan' && (
        <>
          <div className="row between" style={{ marginBottom: 10 }}>
            <button className="icon" onClick={() => setSel(addDays(sel, -7))} aria-label="Previous week"><Icon name="back" size={18} /></button>
            <b>{niceDate(days[0])} to {niceDate(days[6])}</b>
            <button className="icon" onClick={() => setSel(addDays(sel, 7))} aria-label="Next week"><Icon name="chev" size={18} /></button>
          </div>
          <div className="week-strip">
            {days.map((d, i) => {
              const list = byDate(d)
              const dot = list.length ? (list.every(c => c.status === 'done') ? 'done' : 'has') : ''
              return (
                <button key={d} className={(d === sel ? 'on ' : '') + (d === today ? 'today' : '')} onClick={() => setSel(d)} aria-label={longDay(d)}>
                  <small>{DAY_NAMES[i]}</small><b>{Number(d.slice(8))}</b><i className={dot} />
                </button>
              )
            })}
          </div>

          <h2 style={{ marginTop: 18 }}>{relDay(sel) === shortLabel(sel) ? longDay(sel) : `${relDay(sel)} · ${longDay(sel)}`}</h2>
          {selected.length === 0 && <div className="card"><Empty icon="heart" title="Rest day">Nothing scheduled. Recovery is part of the plan.</Empty></div>}
          {selected.map(c => {
            const w = workouts[c.workout_id]
            return (
              <Link key={c.id} to={`/workout/${c.id}`} className="card click" style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--ink)' }}>
                <span className="avatar" style={{ width: 46, height: 46, borderRadius: 14, background: c.status === 'done' ? 'var(--green-soft)' : 'var(--red-soft)', color: c.status === 'done' ? 'var(--green)' : '#ff6b7c' }}>
                  <Icon name={c.status === 'done' ? 'check' : 'train'} />
                </span>
                <span className="grow">
                  <b>{name(c)}</b><br />
                  <span className="mute small">{w ? FORMAT_LABEL[w.format] : ''}{w?.duration_min ? ` · ${w.duration_min} min` : ''}{c.status === 'skipped' ? ' · Skipped' : ''}</span>
                </span>
                <span className={'badge ' + (c.status === 'done' ? 'green' : c.status === 'skipped' ? '' : 'red')}>{c.status === 'done' ? 'Done' : c.status === 'skipped' ? 'Skipped' : 'Start'}</span>
              </Link>
            )
          })}

          {upcoming.length > 0 && <>
            <h2 style={{ marginTop: 24 }}>Coming up</h2>
            <div className="card tight">
              <div className="list">
                {upcoming.map(c => (
                  <Link key={c.id} to={`/workout/${c.id}`} className="item">
                    <span className="grow"><span className="title">{name(c)}</span><br /><span className="meta">{relDay(c.date)}</span></span>
                    <Icon name="chev" />
                  </Link>
                ))}
              </div>
            </div>
          </>}
        </>
      )}

      {cws && tab === 'history' && (
        history.length === 0 ? <div className="card"><Empty icon="train" title="No workouts logged yet">Finish your first session and it will show here.</Empty></div> : (
          <div className="card tight">
            <div className="list">
              {history.map(c => (
                <Link key={c.id} to={`/workout/${c.id}`} className="item">
                  <span className="grow">
                    <span className="title">{name(c)}</span><br />
                    <span className="meta">{niceDate(c.date)} · {setsDone(c)} sets{volumeKg(c) ? ` · ${Math.round(volumeKg(c)).toLocaleString()} kg volume` : ''}</span>
                  </span>
                  {c.rating && <span className="badge amber">{'★'.repeat(c.rating)}</span>}
                  <Icon name="chev" />
                </Link>
              ))}
            </div>
          </div>
        )
      )}
    </>
  )
}

const shortLabel = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
