import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import { useReturnTo } from '../hooks'
import { demoUrl, fmtSeconds } from '../lib/util'
import { niceDate } from '../lib/dates'
import { CARDIO_FIELDS, FORMAT_LABEL, cardioPrescription, fillCardio, formatGroups, prescription, setsDone, volumeKg, workingLoad } from '../lib/training'
import type { ClientWorkout, OneRepMax, SetLog, Workout, WorkoutAlternative, WorkoutItem, WorkoutLog, WorkoutTimer } from '../types'
import { Empty, Sheet, Skeleton, Stars } from '../components/ui'
import Icon from '../components/Icon'
import ExerciseFeedback, { type FeedbackExercise } from '../components/ExerciseFeedback'
import AlternativePicker from '../components/AlternativePicker'
import WorkoutFormatGuide from '../components/WorkoutFormatGuide'
import WorkoutFormatTracker from '../components/WorkoutFormatTracker'
import { alternativeChoice, performedItems, samePreviousExercise } from '../lib/alternatives'

const emptySets = (it: WorkoutItem, load?: number | null): SetLog[] =>
  Array.from({ length: it.sets ?? 1 }, () => ({ reps: '', kg: load ? String(load) : '', done: false }))
// Cardio: one row per round when the style has rounds (intervals, EMOM), otherwise a single row.
const emptyCardio = (it: WorkoutItem, rounds: boolean): SetLog[] =>
  Array.from({ length: rounds ? it.sets ?? 1 : 1 }, () => ({ reps: '', kg: '', done: false, time: '', distance: '', speed: '' }))
const CARDIO_HEAD: Record<string, string> = { time: 'Time', distance: 'km', speed: 'km/h' }
const timerSeconds = (timer: WorkoutTimer | undefined, at: number) => {
  if (!timer) return 0
  const started = timer.running && timer.started_at ? Date.parse(timer.started_at) : NaN
  const extra = Number.isFinite(started) ? Math.max(0, (at - started) / 1000) : 0
  return Math.max(0, Math.floor((timer.elapsed_sec || 0) + extra))
}

export default function WorkoutPlayer() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const feedbackId = search.get('feedback')
  const [feedbackExercise, setFeedbackExercise] = useState<FeedbackExercise | null>(null)
  useEffect(() => {
    if (!id || !feedbackId) return
    let active = true
    supabase.from('exercise_videos').select('workout_item_id,exercise_name').eq('id', feedbackId).eq('client_workout_id', id).maybeSingle().then(({ data }) => {
      if (active && data) setFeedbackExercise({ id: data.workout_item_id, exercise_name: data.exercise_name })
    })
    return () => { active = false }
  }, [id, feedbackId])
  const { profile } = useAuth()
  const nav = useNavigate()
  const returnTo = useReturnTo('')
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
  const [finishing, setFinishing] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const saveVersion = useRef(0)
  const changingExercise = useRef(false)
  const finishingWrite = useRef(false)
  const [switchItem, setSwitchItem] = useState<WorkoutItem | null>(null)
  const [switchBusy, setSwitchBusy] = useState(false)
  const [switchError, setSwitchError] = useState('')
  const [uncertainChoice, setUncertainChoice] = useState(false)
  const [finishBusy, setFinishBusy] = useState(false)
  const [saveError, setSaveError] = useState('')

  const readOnly = profile?.role === 'coach' || cw?.status !== 'scheduled'
  const locked = readOnly || switchBusy || finishBusy || uncertainChoice

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
      for (const i of performedItems(list, row.log ?? {})) {
        const wl = workingLoad(i, maxList)
        const isCardio = row.log?.exercise_choices?.[i.id]?.is_cardio ?? cardioItems.has(i.id)
        init[i.id] = have[i.id]?.length ? have[i.id] : isCardio ? emptyCardio(i, rounds) : emptySets(i, wl)
      }
      setLog({ ...row.log, items: init })
    })()
  }, [id])

  // Keep the screen awake only while the client has deliberately started the session timer.
  useEffect(() => {
    if (!log.timer?.running) return
    type Lock = { release: () => Promise<void> }
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }).wakeLock
    if (!wl) return
    let lock: Lock | null = null
    const ask = () => { if (document.visibilityState === 'visible') wl.request('screen').then(l => { lock = l }).catch(() => {}) }
    ask()
    document.addEventListener('visibilitychange', ask)
    return () => { document.removeEventListener('visibilitychange', ask); lock?.release().catch(() => {}) }
  }, [log.timer?.running])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (rest && now >= rest.end) { setRest(null); try { navigator.vibrate?.([200, 100, 200]) } catch { /* unsupported */ } }
  }, [now, rest])

  const persist = useCallback((next: WorkoutLog): Promise<boolean> => {
    if (!cw || readOnly) return Promise.resolve(false)
    const version = ++saveVersion.current
    setSaved('saving'); setSaveError('')
    const task = saveQueue.current.then(async () => {
      try {
        const result = await supabase.from('client_workouts').update({ log: next }).eq('id', cw.id).eq('status', 'scheduled').select('id')
        if (result.error || !result.data?.length) throw new Error('save')
        if (version === saveVersion.current) setSaved('saved')
        return true
      } catch {
        if (version === saveVersion.current) { setSaved('idle'); setSaveError('Could not save workout changes. Retry before leaving this workout.') }
        return false
      }
    })
    saveQueue.current = task
    return task
  }, [cw, readOnly])

  function change(next: WorkoutLog) {
    if (readOnly || changingExercise.current || finishingWrite.current || uncertainChoice) return
    setLog(next); dirty.current = true; setSaved('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => persist(next), 700)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const setSessionTimer = (nextTimer: WorkoutTimer) => {
    setRest(null)
    change({ ...log, timer: nextTimer })
  }
  const startSessionTimer = () => { const at = Date.now(); setSessionTimer({ elapsed_sec: timerSeconds(log.timer, at), started_at: new Date(at).toISOString(), running: true }) }
  const pauseSessionTimer = () => setSessionTimer({ elapsed_sec: timerSeconds(log.timer, Date.now()), started_at: null, running: false })
  const resetSessionTimer = () => {
    if (timerSeconds(log.timer, Date.now()) > 0 && !confirm('Reset the session timer to 00:00?')) return
    setSessionTimer({ elapsed_sec: 0, started_at: null, running: false })
  }

  const restAfter = (item: WorkoutItem) => {
    const ordered = performedItems(items, log)
    const position = ordered.findIndex(candidate => candidate.id === item.id)
    if (w?.format === 'standard') return item.rest_sec
    if (w?.format === 'circuit') return position === ordered.length - 1 ? item.rest_sec : 0
    if (w?.format === 'intervals') return item.rest_sec
    return 0
  }

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
    change({ ...log, items: { ...log.items, [it.id]: [...sets, (log.exercise_choices?.[it.id]?.is_cardio ?? cardio.has(it.id)) ? { reps: '', kg: '', done: false, time: '', distance: '', speed: '' } : { reps: '', kg: last?.kg ?? '', done: false }] } })
  }

  async function chooseAlternative(alternative: WorkoutAlternative | null) {
    if (!cw || !switchItem || readOnly || changingExercise.current || finishingWrite.current || uncertainChoice) return
    if (log.items?.[switchItem.id]?.some(s => s.done)) { setSwitchError('This exercise already has completed sets.'); return }
    if (!confirm('Change exercise and clear unfinished entries in this block? Other exercises are preserved.')) return
    changingExercise.current = true; setSwitchBusy(true); setSwitchError('')
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    try {
      // Flush edits first, then queue the choice after all older autosaves.
      if (!(await persist(log))) { setSwitchError('Could not save your current entries. Please retry before switching.'); return }
      const choices = { ...log.exercise_choices }
      if (alternative) choices[switchItem.id] = alternativeChoice(switchItem, alternative)
      else delete choices[switchItem.id]
      const effective = choices[switchItem.id]?.item ?? switchItem
      const isCardio = choices[switchItem.id]?.is_cardio ?? cardio.has(switchItem.id)
      const sets = isCardio ? emptyCardio(effective, CARDIO_FIELDS[w?.format ?? 'standard'].includes('sets')) : emptySets(effective, alternative ? null : workingLoad(effective, maxes))
      const next: WorkoutLog = { ...log, exercise_choices: choices, items: { ...log.items, [switchItem.id]: sets } }
      if (await persist(next)) { setLog(next); setRest(null); setSwitchItem(null); return }
      // Interrupted responses may follow a committed write. Confirm before allowing more edits.
      const check = await supabase.from('client_workouts').select('log,status').eq('id', cw.id).maybeSingle()
      if (check.error || !check.data) { setUncertainChoice(true); setSwitchError('Could not confirm the exercise change. Reload this workout before continuing.'); return }
      const confirmed = check.data.log as WorkoutLog
      setLog(confirmed); setCw({ ...cw, log: confirmed, status: check.data.status as ClientWorkout['status'] })
      if ((confirmed.exercise_choices?.[switchItem.id]?.alternative_id ?? null) === (alternative?.id ?? null)) { setSwitchItem(null); setSaveError(''); setSaved('saved') }
      else setSwitchError('Could not change exercise. Your saved entries are preserved. Retry or reload to check the latest approval.')
    } catch { setUncertainChoice(true); setSwitchError('Could not confirm the exercise change. Reload this workout before continuing.') }
    finally { changingExercise.current = false; setSwitchBusy(false) }
  }

  async function finish(status: 'done' | 'skipped') {
    if (!cw || readOnly || changingExercise.current || finishingWrite.current || uncertainChoice) return
    finishingWrite.current = true; setFinishBusy(true); setSaveError('')
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    try {
      await saveQueue.current
      const seconds = timerSeconds(log.timer, Date.now())
      const final: WorkoutLog = { ...log, seconds, timer: { elapsed_sec: seconds, started_at: null, running: false } }
      const result = await supabase.from('client_workouts').update({
        status, log: final, rating: status === 'done' ? rating : null, client_note: note, completed_at: status === 'done' ? new Date().toISOString() : null,
      }).eq('id', cw.id).eq('status', 'scheduled').select('id')
      if (result.error || !result.data?.length) throw new Error('finish')
      nav('/', { replace: true })
    } catch { setSaveError('Could not finish this workout. Your entries are still here. Please retry when connected.') }
    finally { finishingWrite.current = false; setFinishBusy(false) }
  }

  if (cw === undefined) return <Skeleton n={4} />
  if (!cw || !w) return <div className="card"><Empty icon="train" title="Workout not found"><Link to={returnTo || '/'}>Back</Link></Empty></div>

  const performed = performedItems(items, log)
  const groups = formatGroups(performed, w.format)
  const totalSets = Object.values(log.items ?? {}).reduce((n, s) => n + s.length, 0)
  const done = setsDone({ ...cw, log })
  const isRounds = w.format !== 'standard' && w.format !== 'intervals'
  const elapsed = timerSeconds(log.timer, now)
  const timerStarted = elapsed > 0 || !!log.timer?.started_at
  const prevOf = (it: WorkoutItem, i: number) => samePreviousExercise(it, items.find(original => original.id === it.id), prev) ? prev?.items?.[it.id]?.[i] : undefined

  return (
    <>
      <div className="row between" style={{ marginBottom: 6 }}>
        <button className="icon" onClick={() => returnTo ? nav(returnTo, { replace: true }) : nav(-1)} aria-label="Back"><Icon name="back" size={18} /></button>
        <span className="mute small">{readOnly ? (cw.status === 'done' ? `Completed ${niceDate(cw.date)}` : 'Read only') : saved === 'saving' ? 'Saving...' : saved === 'saved' ? 'Saved' : ' '}</span>
      </div>
      <div className="page-head" style={{ marginTop: 0 }}>
        <div>
          <div className="eyebrow">{FORMAT_LABEL[w.format]}{w.duration_min ? ` � ${w.duration_min} min` : ''}</div>
          <h1>{w.name}</h1>
          {w.description && <div className="sub">{w.description}</div>}
        </div>
        {!readOnly && <div style={{ textAlign: 'right' }}>
          <div className="clock" aria-label="Elapsed time">{fmtSeconds(elapsed)}</div>
          <span className="mute small">{log.timer?.running ? 'Running' : timerStarted ? 'Paused' : 'Ready to start'}</span>
        </div>}
      </div>

      {!readOnly && <div className="row" role="group" aria-label="Session timer controls">
        {!log.timer?.running && <button type="button" onClick={startSessionTimer}><Icon name="play" size={16} />{timerStarted ? 'Resume' : 'Start'}</button>}
        {log.timer?.running && <button type="button" onClick={pauseSessionTimer}>Pause</button>}
        <button type="button" className="soft" onClick={resetSessionTimer} disabled={!timerStarted && !log.timer?.running}>Reset</button>
      </div>}

      <WorkoutFormatGuide format={w.format} minutes={w.duration_min} rounds={w.rounds} />
      {!readOnly && <WorkoutFormatTracker workout={w} items={performed} log={log} elapsed={elapsed} />}

      {saveError && <div className="card tight"><p className="err" role="alert">{saveError}</p><button className="soft" disabled={locked} onClick={() => void persist(log)}>Retry workout save</button></div>}

      {totalSets > 0 && <div className="bar" aria-hidden="true"><i style={{ width: `${(done / totalSets) * 100}%` }} /></div>}

      {isRounds && (
        <div className="card row between nowrap">
          <div><b>{w.format === 'amrap' ? 'Rounds completed' : 'Rounds'}</b><br /><span className="mute small">{w.rounds ? `Target: ${w.rounds}` : 'Log how many you finished'}</span></div>
          <input type="number" min="0" inputMode="numeric" style={{ width: 90, textAlign: 'center' }} disabled={locked}
            value={log.rounds ?? ''} onChange={e => change({ ...log, rounds: e.target.value === '' ? undefined : Number(e.target.value) })} aria-label="Rounds completed" />
        </div>
      )}

      <div className="card">
        {groups.map((g, gi) => (
          <div key={gi} style={g.label ? { borderLeft: '3px solid var(--violet)', paddingLeft: 12, margin: '4px 0' } : undefined}>
            {g.label && <div className="group-label"><Icon name="link" size={13} />{g.label}</div>}
            {g.items.map(it => {
              const isCardio = log.exercise_choices?.[it.id]?.is_cardio ?? cardio.has(it.id)
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
                      <div className="presc">{isCardio ? cardioPrescription(it, w.format) : prescription(it)}{load ? <> � <span className="load">{load} kg</span></> : load === undefined ? <span className="mute"> � no max yet</span> : null}</div>
                      {it.notes && <div className="mute small">{it.notes}</div>}
                    </div>
                    <a className="btn icon" href={demoUrl(it.exercise_name)} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${it.exercise_name} demo`}><Icon name="play" size={16} /></a>
                  </div>
                  {log.exercise_choices?.[it.id] && <p className="mute small">Selected alternative for this session. Original: {items.find(original => original.id === it.id)?.exercise_name ?? 'Retired exercise'}.</p>}
                  {!readOnly && items.some(original => original.id === it.id) && <button className="soft sm" style={{ marginTop: 8 }} disabled={locked || sets.some(s => s.done)} onClick={() => { setSwitchError(''); setSwitchItem(items.find(original => original.id === it.id) ?? null) }} aria-label={`Choose alternative for ${it.exercise_name}`}>Choose alternative</button>}
                  {simple ? (
                    <div className="row between nowrap" style={{ marginTop: 8 }}>
                      <span className="mute">{it.reps}</span>
                      <button className={'set-check' + (sets[0]?.done ? ' on' : '')} disabled={locked} onClick={() => setField(it.id, 0, { done: !sets[0]?.done }, restAfter(it))} aria-pressed={!!sets[0]?.done} aria-label="Mark done"><Icon name="check" size={20} /></button>
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
                              return <input key={f} type={f === 'time' ? 'text' : 'number'} inputMode={f === 'time' ? 'numeric' : 'decimal'} step="any" min="0" placeholder={p?.[k] || target(f) || '-'} value={s[k] ?? ''} disabled={locked}
                                onChange={e => setField(it.id, i, { [k]: e.target.value })}
                                onBlur={() => { const filled = fillCardio(s); const patch: Partial<SetLog> = {}; for (const key of ['time', 'distance', 'speed'] as const) if (filled[key] !== s[key]) patch[key] = filled[key]; if (Object.keys(patch).length) setField(it.id, i, patch) }}
                                aria-label={`${CARDIO_HEAD[f] === 'Time' ? 'Time' : f === 'distance' ? 'Distance in kilometres' : 'Speed in kilometres per hour'}${CARDIO_FIELDS[w.format].includes('sets') ? `, round ${i + 1}` : ''}`} />
                            })}
                            <button className={'set-check' + (s.done ? ' on' : '')} disabled={locked}
                              onClick={() => {
                                // Marking done keeps what was typed and fills the rest from the plan, then works out the missing one.
                                const base = s.done ? s : fillCardio({ ...s, time: s.time || (cf.includes('time') ? it.cardio_time : ''), distance: s.distance || (cf.includes('distance') ? target('distance') : ''), speed: s.speed || (cf.includes('speed') ? target('speed') : '') })
                                setField(it.id, i, { time: base.time, distance: base.distance, speed: base.speed, done: !s.done }, restAfter(it))
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
                            <input type="number" inputMode="decimal" step="any" min="0" placeholder={p?.kg || '-'} value={s.kg} disabled={locked} onChange={e => setField(it.id, i, { kg: e.target.value })} aria-label={`Set ${i + 1} weight`} />
                            <input type="number" inputMode="numeric" min="0" placeholder={p?.reps || it.reps || '-'} value={s.reps} disabled={locked} onChange={e => setField(it.id, i, { reps: e.target.value })} aria-label={`Set ${i + 1} reps`} />
                            <button className={'set-check' + (s.done ? ' on' : '')} disabled={locked} onClick={() => setField(it.id, i, { done: !s.done, reps: s.reps || (!s.done ? (it.reps.match(/^\d+/)?.[0] ?? '') : s.reps) }, restAfter(it))} aria-pressed={s.done} aria-label={`Complete set ${i + 1}`}><Icon name="check" size={20} /></button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {!simple && !locked && (!isCardio || CARDIO_FIELDS[w.format].includes('sets')) && <button className="link" style={{ marginTop: 8 }} onClick={() => addSet(it)}>{isCardio ? '+ Add round' : '+ Add set'}</button>}
                  <button className="soft sm" disabled={switchBusy || finishBusy || uncertainChoice} style={{ marginTop: 8 }} onClick={() => setFeedbackExercise(it)} aria-label={`Technique feedback for ${it.exercise_name}`}>Technique feedback</button>
                  {samePreviousExercise(it, items.find(original => original.id === it.id), prev) && prev?.items?.[it.id]?.some(s => s.done) && !simple && <div className="mute small" style={{ marginTop: 6 }}>Last time: {prev.items[it.id].filter(s => s.done).map(s => isCardio ? [s.time, s.distance && `${s.distance} km`, s.speed && `${s.speed} km/h`].filter(Boolean).join(' � ') || '-' : `${s.kg || '-'}x${s.reps || '-'}`).join(isCardio ? ' | ' : ', ')}</div>}
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
            <div className="tile"><div className="label">Time</div><div className="value">{cw.log?.seconds ? fmtSeconds(cw.log.seconds) : '-'}</div></div>
          </div>
          {cw.rating && <p style={{ marginBottom: 0 }}><span className="badge amber">{'?'.repeat(cw.rating)}</span> {cw.client_note && <span className="mute">"{cw.client_note}"</span>}</p>}
        </div>
      )}

      {!readOnly && cw.status === 'scheduled' && (
        <div className="row" style={{ marginTop: 6 }}>
          <button className="grow" disabled={locked} style={{ minHeight: 52 }} onClick={() => setFinishing(true)}><Icon name="check" size={18} />Finish workout</button>
          <button className="ghost" disabled={locked} onClick={() => { if (confirm('Mark this workout as skipped?')) finish('skipped') }}>Skip</button>
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

      {switchItem && <AlternativePicker key={switchItem.id} item={switchItem} selectedId={log.exercise_choices?.[switchItem.id]?.alternative_id} busy={switchBusy} error={switchError} uncertain={uncertainChoice} onChoose={a => { void chooseAlternative(a) }} onClose={() => { if (!changingExercise.current && !uncertainChoice) setSwitchItem(null) }} />}

      {cw && feedbackExercise && <ExerciseFeedback key={cw.id + feedbackExercise.id} clientId={cw.client_id} workoutId={cw.id} exercise={feedbackExercise} initialVideoId={feedbackId ?? undefined} coach={profile?.role === 'coach'} onClose={() => setFeedbackExercise(null)} />}

      <Sheet open={finishing} onClose={() => { if (!finishingWrite.current) setFinishing(false) }} title="Nice work">
        <div className="stack">
          <p className="mute" style={{ margin: 0 }}>{done} of {totalSets} sets logged � {fmtSeconds(elapsed)}</p>
          <b>How did it feel?</b>
          <Stars value={rating} onChange={setRating} />
          <textarea rows={3} placeholder="Notes for your coach (optional)" value={note} onChange={e => setNote(e.target.value)} />
          {saveError && <p className="err" role="alert">{saveError}</p>}
          <button className="block" disabled={locked} style={{ minHeight: 52 }} onClick={() => finish('done')}>{finishBusy ? 'Saving...' : 'Save and finish'}</button>
        </div>
      </Sheet>
    </>
  )
}

