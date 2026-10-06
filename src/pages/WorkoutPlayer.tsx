import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import { demoUrl, fmtSeconds } from '../lib/util'
import { niceDate } from '../lib/dates'
import { CARDIO_FIELDS, FORMAT_LABEL, cardioPrescription, fillCardio, groupItems, prescription, setsDone, volumeKg, workingLoad } from '../lib/training'
import type { ClientWorkout, OneRepMax, SetLog, Workout, WorkoutItem, WorkoutLog } from '../types'
import { Empty, Sheet, Skeleton, Stars } from '../components/ui'
import Icon from '../components/Icon'

const emptySets = (it: WorkoutItem, load?: number | null): SetLog[] =>
  Array.from({ length: it.sets ?? 1 }, () => ({ reps: '', kg: load ? String(load) : '', done: false }))
// Cardio: one row per round when the style has rounds (intervals, EMOM), otherwise a single row.
const emptyCardio = (it: WorkoutItem, rounds: boolean): SetLog[] =>
  Array.from({ length: rounds ? it.sets ?? 1 : 1 }, () => ({ reps: '', kg: '', done: false, time: '', distance: '', speed: '' }))
const CARDIO_HEAD: Record<string, string> = { time: 'Time', distance: 'km', speed: 'km/h' }

export default function WorkoutPlayer() {
  const { id } = useParams()
  const { profile } = useAuth()
  const nav = useNavigate()
  const [cw, setCw] = useState<ClientWorkout | null | undefined>(undefined)
  const [w, setW] = useState<Workout | null>(null)
  const [items, setItems] = useState<WorkoutItem[]>([])
  const [maxes, setMaxes] = useState<OneRepMax[]>([])
  const [cardio, setCardio] = useState<Set<string>>(new Set())
  const [prev, setPrev] = useState<WorkoutLog | null>(null)
  const [log, setLog] = useState<WorkoutLog>({ items: {} })
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [rest, setRest] = useState<{ end: number; total: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [start] = useState(() => Date.now())
  const [finishing, setFinishing] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)

  const readOnly = profile?.role === 'coach' || cw?.status !== 'scheduled'

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { data: c } = await supabase.from('client_workouts').select('*').eq('id', id).maybeSingle()
      const row = c as ClientWorkout | null
      setCw(row)
      if (!row) return
      const [wk, it, mx, pv] = await Promise.all([
        supabase.from('workouts').select('*').eq('id', row.workout_id).maybeSingle(),
        supabase.from('workout_items').select('*').eq('workout_id', row.workout_id).order('sort'),
        supabase.from('one_rep_maxes').select('*').eq('client_id', row.client_id).order('date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('client_workouts').select('log').eq('client_id', row.client_id).eq('workout_id', row.workout_id).eq('status', 'done').neq('id', row.id).order('date', { ascending: false }).limit(1),
      ])
      const list = (it.data ?? []) as WorkoutItem[]
      const maxList = (mx.data ?? []) as OneRepMax[]
      setW(wk.data as Workout | null); setItems(list); setMaxes(maxList)
      setPrev(((pv.data ?? []) as { log: WorkoutLog }[])[0]?.log ?? null)
      const exIds = [...new Set(list.map(i => i.exercise_id).filter(Boolean))] as string[]
      const cats = new Map<string, string>()
      if (exIds.length) for (const e of (await supabase.from('exercises').select('id, category').in('id', exIds)).data ?? []) cats.set(e.id as string, e.category as string)
      const cardioItems = new Set(list.filter(i => i.exercise_id && cats.get(i.exercise_id) === 'cardio').map(i => i.id))
      setCardio(cardioItems)
      const rounds = CARDIO_FIELDS[(wk.data as Workout | null)?.format ?? 'standard'].includes('sets')
      const have = row.log?.items ?? {}
      const init: Record<string, SetLog[]> = {}
      for (const i of list) {
        const wl = workingLoad(i, maxList)
        init[i.id] = have[i.id]?.length ? have[i.id] : cardioItems.has(i.id) ? emptyCardio(i, rounds) : emptySets(i, wl)
      }
      setLog({ ...row.log, items: init })
    })()
  }, [id])

  // Keep the screen on during a session (the lock is released when the tab is hidden, so ask again on return).
  useEffect(() => {
    type Lock = { release: () => Promise<void> }
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }).wakeLock
    if (!wl) return
    let lock: Lock | null = null
    const ask = () => { if (document.visibilityState === 'visible') wl.request('screen').then(l => { lock = l }).catch(() => {}) }
    ask()
    document.addEventListener('visibilitychange', ask)
    return () => { document.removeEventListener('visibilitychange', ask); lock?.release().catch(() => {}) }
  }, [])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (rest && now >= rest.end) { setRest(null); try { navigator.vibrate?.([200, 100, 200]) } catch { /* unsupported */ } }
  }, [now, rest])

  const persist = useCallback(async (next: WorkoutLog) => {
    if (!cw || readOnly) return
    setSaved('saving')
    const { error } = await supabase.from('client_workouts').update({ log: next }).eq('id', cw.id)
    setSaved(error ? 'idle' : 'saved')
  }, [cw, readOnly])

  function change(next: WorkoutLog) {
    setLog(next); dirty.current = true; setSaved('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => persist(next), 700)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function setField(itemId: string, idx: number, patch: Partial<SetLog>, restSec?: number | null) {
    const sets = [...(log.items?.[itemId] ?? [])]
    sets[idx] = { ...sets[idx], ...patch }
    change({ ...log, items: { ...log.items, [itemId]: sets } })
    if (patch.done && restSec && restSec > 0) setRest({ end: Date.now() + restSec * 1000, total: restSec })
    if (patch.done === false) setRest(null)
  }
  const addSet = (it: WorkoutItem) => {
    const sets = log.items?.[it.id] ?? []
    const last = sets[sets.length - 1]
    change({ ...log, items: { ...log.items, [it.id]: [...sets, cardio.has(it.id) ? { reps: '', kg: '', done: false, time: '', distance: '', speed: '' } : { reps: '', kg: last?.kg ?? '', done: false }] } })
  }

  async function finish(status: 'done' | 'skipped') {
    if (!cw) return
    const final: WorkoutLog = { ...log, seconds: Math.round((Date.now() - start) / 1000) }
    const { error } = await supabase.from('client_workouts').update({
      status, log: final, rating: status === 'done' ? rating : null, client_note: note, completed_at: status === 'done' ? new Date().toISOString() : null,
    }).eq('id', cw.id)
    if (error) return alert(error.message)
    nav('/', { replace: true })
  }

  if (cw === undefined) return <Skeleton n={4} />
  if (!cw || !w) return <div className="card"><Empty icon="train" title="Workout not found"><Link to="/">Back to home</Link></Empty></div>

  const groups = groupItems(items)
  const totalSets = Object.values(log.items ?? {}).reduce((n, s) => n + s.length, 0)
  const done = setsDone({ ...cw, log })
  const isRounds = w.format !== 'standard' && w.format !== 'intervals'
  const elapsed = Math.round((now - start) / 1000)
  const prevOf = (it: WorkoutItem, i: number) => prev?.items?.[it.id]?.[i]

  return (
    <>
      <div className="row between" style={{ marginBottom: 6 }}>
        <button className="icon" onClick={() => nav(-1)} aria-label="Back"><Icon name="back" size={18} /></button>
        <span className="mute small">{readOnly ? (cw.status === 'done' ? `Completed ${niceDate(cw.date)}` : 'Read only') : saved === 'saving' ? 'Saving...' : saved === 'saved' ? 'Saved' : ' '}</span>
      </div>
      <div className="page-head" style={{ marginTop: 0 }}>
        <div>
          <div className="eyebrow">{FORMAT_LABEL[w.format]}{w.duration_min ? ` · ${w.duration_min} min` : ''}</div>
          <h1>{w.name}</h1>
          {w.description && <div className="sub">{w.description}</div>}
        </div>
        {!readOnly && <div className="clock" aria-label="Elapsed time">{fmtSeconds(elapsed)}</div>}
      </div>

      {totalSets > 0 && <div className="bar" aria-hidden="true"><i style={{ width: `${(done / totalSets) * 100}%` }} /></div>}

      {isRounds && (
        <div className="card row between nowrap">
          <div><b>{w.format === 'amrap' ? 'Rounds completed' : 'Rounds'}</b><br /><span className="mute small">{w.rounds ? `Target: ${w.rounds}` : 'Log how many you finished'}</span></div>
          <input type="number" min="0" inputMode="numeric" style={{ width: 90, textAlign: 'center' }} disabled={readOnly}
            value={log.rounds ?? ''} onChange={e => change({ ...log, rounds: e.target.value === '' ? undefined : Number(e.target.value) })} aria-label="Rounds completed" />
        </div>
      )}

      <div className="card">
        {groups.map((g, gi) => (
          <div key={gi} style={g.label ? { borderLeft: '3px solid var(--violet)', paddingLeft: 12, margin: '4px 0' } : undefined}>
            {g.label && g.items.length > 1 && <div className="group-label"><Icon name="link" size={13} />{g.items.length === 2 ? 'Superset' : 'Circuit'} {g.label}</div>}
            {g.items.map(it => {
              const isCardio = cardio.has(it.id)
              const load = isCardio ? null : workingLoad(it, maxes)
              const sets = log.items?.[it.id] ?? []
              const simple = !it.sets && !isCardio
              const cf = CARDIO_FIELDS[w.format].filter(f => f === 'time' || f === 'distance' || f === 'speed')
              const target = (f: string) => f === 'time' ? it.cardio_time : f === 'distance' ? (it.cardio_distance_km ? String(Number(it.cardio_distance_km)) : '') : (it.cardio_speed_kmh ? String(Number(it.cardio_speed_kmh)) : '')
              const fieldKey = (f: string) => (f === 'time' ? 'time' : f === 'distance' ? 'distance' : 'speed') as 'time' | 'distance' | 'speed'
              return (
                <div key={it.id} className="exercise-block">
                  <div className="row between nowrap" style={{ marginBottom: 2 }}>
                    <div className="grow">
                      <b style={{ fontSize: '1.02rem' }}>{it.exercise_name}</b>
                      <div className="presc">{isCardio ? cardioPrescription(it, w.format) : prescription(it)}{load ? <> · <span className="load">{load} kg</span></> : load === undefined ? <span className="mute"> · no max yet</span> : null}</div>
                      {it.notes && <div className="mute small">{it.notes}</div>}
                    </div>
                    <a className="btn icon" href={demoUrl(it.exercise_name)} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${it.exercise_name} demo`}><Icon name="play" size={16} /></a>
                  </div>
                  {simple ? (
                    <div className="row between nowrap" style={{ marginTop: 8 }}>
                      <span className="mute">{it.reps}</span>
                      <button className={'set-check' + (sets[0]?.done ? ' on' : '')} disabled={readOnly} onClick={() => setField(it.id, 0, { done: !sets[0]?.done }, it.rest_sec)} aria-pressed={!!sets[0]?.done} aria-label="Mark done"><Icon name="check" size={20} /></button>
                    </div>
                  ) : isCardio ? (
                    <div className="set-grid" style={{ gridTemplateColumns: `34px repeat(${cf.length}, 1fr) 52px` }}>
                      <span className="h">{CARDIO_FIELDS[w.format].includes('sets') ? 'Set' : ''}</span>
                      {cf.map(f => <span key={f} className="h">{CARDIO_HEAD[f]}</span>)}
                      <span className="h" />
                      {sets.map((s, i) => {
                        const p = prevOf(it, i)
                        return (
                          <div key={i} style={{ display: 'contents' }}>
                            <span className="n">{CARDIO_FIELDS[w.format].includes('sets') ? i + 1 : ''}</span>
                            {cf.map(f => {
                              const k = fieldKey(f)
                              return <input key={f} type={f === 'time' ? 'text' : 'number'} inputMode={f === 'time' ? 'numeric' : 'decimal'} step="any" min="0" placeholder={p?.[k] || target(f) || '–'} value={s[k] ?? ''} disabled={readOnly}
                                onChange={e => setField(it.id, i, { [k]: e.target.value })}
                                onBlur={() => { const filled = fillCardio(s); const patch: Partial<SetLog> = {}; for (const key of ['time', 'distance', 'speed'] as const) if (filled[key] !== s[key]) patch[key] = filled[key]; if (Object.keys(patch).length) setField(it.id, i, patch) }}
                                aria-label={`${CARDIO_HEAD[f] === 'Time' ? 'Time' : f === 'distance' ? 'Distance in kilometres' : 'Speed in kilometres per hour'}${CARDIO_FIELDS[w.format].includes('sets') ? `, round ${i + 1}` : ''}`} />
                            })}
                            <button className={'set-check' + (s.done ? ' on' : '')} disabled={readOnly}
                              onClick={() => {
                                // Marking done keeps what was typed and fills the rest from the plan, then works out the missing one.
                                const base = s.done ? s : fillCardio({ ...s, time: s.time || (cf.includes('time') ? it.cardio_time : ''), distance: s.distance || (cf.includes('distance') ? target('distance') : ''), speed: s.speed || (cf.includes('speed') ? target('speed') : '') })
                                setField(it.id, i, { time: base.time, distance: base.distance, speed: base.speed, done: !s.done }, it.rest_sec)
                              }} aria-pressed={s.done} aria-label={`Complete ${CARDIO_FIELDS[w.format].includes('sets') ? `round ${i + 1}` : 'cardio'}`}><Icon name="check" size={20} /></button>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="set-grid">
                      <span className="h">Set</span><span className="h">kg</span><span className="h">Reps</span><span className="h" />
                      {sets.map((s, i) => {
                        const p = prevOf(it, i)
                        return (
                          <div key={i} style={{ display: 'contents' }}>
                            <span className="n">{i + 1}</span>
                            <input type="number" inputMode="decimal" step="any" min="0" placeholder={p?.kg || '–'} value={s.kg} disabled={readOnly} onChange={e => setField(it.id, i, { kg: e.target.value })} aria-label={`Set ${i + 1} weight`} />
                            <input type="number" inputMode="numeric" min="0" placeholder={p?.reps || it.reps || '–'} value={s.reps} disabled={readOnly} onChange={e => setField(it.id, i, { reps: e.target.value })} aria-label={`Set ${i + 1} reps`} />
                            <button className={'set-check' + (s.done ? ' on' : '')} disabled={readOnly} onClick={() => setField(it.id, i, { done: !s.done, reps: s.reps || (!s.done ? (it.reps.match(/^\d+/)?.[0] ?? '') : s.reps) }, it.rest_sec)} aria-pressed={s.done} aria-label={`Complete set ${i + 1}`}><Icon name="check" size={20} /></button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {!simple && !readOnly && (!isCardio || CARDIO_FIELDS[w.format].includes('sets')) && <button className="link" style={{ marginTop: 8 }} onClick={() => addSet(it)}>{isCardio ? '+ Add round' : '+ Add set'}</button>}
                  {prev?.items?.[it.id]?.some(s => s.done) && !simple && <div className="mute small" style={{ marginTop: 6 }}>Last time: {prev.items[it.id].filter(s => s.done).map(s => isCardio ? [s.time, s.distance && `${s.distance} km`, s.speed && `${s.speed} km/h`].filter(Boolean).join(' · ') || '–' : `${s.kg || '–'}×${s.reps || '–'}`).join(isCardio ? ' | ' : ', ')}</div>}
                </div>
              )
            })}
          </div>
        ))}
        {items.length === 0 && <Empty icon="train" title="This workout has no exercises yet" />}
      </div>

      {cw.status === 'done' && (
        <div className="card">
          <div className="grid g3">
            <div className="tile"><div className="label">Sets</div><div className="value">{setsDone(cw)}</div></div>
            <div className="tile"><div className="label">Volume</div><div className="value">{Math.round(volumeKg(cw)).toLocaleString()}<small>kg</small></div></div>
            <div className="tile"><div className="label">Time</div><div className="value">{cw.log?.seconds ? fmtSeconds(cw.log.seconds) : '–'}</div></div>
          </div>
          {cw.rating && <p style={{ marginBottom: 0 }}><span className="badge amber">{'★'.repeat(cw.rating)}</span> {cw.client_note && <span className="mute">"{cw.client_note}"</span>}</p>}
        </div>
      )}

      {!readOnly && cw.status === 'scheduled' && (
        <div className="row" style={{ marginTop: 6 }}>
          <button className="grow" style={{ minHeight: 52 }} onClick={() => setFinishing(true)}><Icon name="check" size={18} />Finish workout</button>
          <button className="ghost" onClick={() => { if (confirm('Mark this workout as skipped?')) finish('skipped') }}>Skip</button>
        </div>
      )}

      {rest && (
        <div className="timer-pill" role="timer" aria-live="off">
          <span className="mute small" style={{ color: '#55555f' }}>Rest</span>
          <span className="num">{fmtSeconds(Math.max(0, Math.ceil((rest.end - now) / 1000)))}</span>
          <button className="sm" style={{ background: '#0b0b0d', boxShadow: 'none' }} onClick={() => setRest({ ...rest, end: rest.end + 30000 })}>+30s</button>
          <button className="sm ghost" style={{ color: '#0b0b0d', borderColor: '#d4d4d8' }} onClick={() => setRest(null)}>Skip</button>
        </div>
      )}

      <Sheet open={finishing} onClose={() => setFinishing(false)} title="Nice work">
        <div className="stack">
          <p className="mute" style={{ margin: 0 }}>{done} of {totalSets} sets logged · {fmtSeconds(elapsed)}</p>
          <b>How did it feel?</b>
          <Stars value={rating} onChange={setRating} />
          <textarea rows={3} placeholder="Notes for your coach (optional)" value={note} onChange={e => setNote(e.target.value)} />
          <button className="block" style={{ minHeight: 52 }} onClick={() => finish('done')}>Save and finish</button>
        </div>
      </Sheet>
    </>
  )
}
