import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useClients, usePageTab } from '../../hooks'
import { useAuth } from '../../auth'
import { addDays, DAY_NAMES, daysBetween, localDate, niceDate, relDay, startOfWeek, weekOf } from '../../lib/dates'
import { MEAL_LABEL, MEALS, forServings, generateWeek, suggestTargets, sum } from '../../lib/nutrition'
import { setsDone } from '../../lib/training'
import { parqAlerts } from '../../lib/parq'
import type { ClientHealth, Checkin, ClientWorkout, FoodLog, MealPlanItem, Measurement, Program, ProgramDay, Recipe, Targets, TasterSession, Workout } from '../../types'
import { Avatar, Empty, MacroBar, MacroChips, Seg, Sheet, Skeleton, Tile } from '../../components/ui'
import Icon from '../../components/Icon'
import WeeklyCheckins from '../../components/WeeklyCheckins'
import ClientOnboarding from '../../components/ClientOnboarding'
import { RecipePicker, WorkoutPicker } from '../../components/Pickers'
import CoachHabits from '../CoachHabits'
import Progress from '../Progress'
import { AssignProgram, AssignWorkout } from './Assign'
import TasterSessionForm from '../../components/TasterSession'
import SessionBalance from '../../components/SessionBalance'
import ClientSessions from '../../components/ClientSessions'

type Tab = 'overview' | 'taster' | 'training' | 'nutrition' | 'habits' | 'progress'

/** What the coach sees for a workout session: unfinished sessions in the past read as Missed. */
const sessionLabel = (c: Pick<ClientWorkout, 'status' | 'date'>, today: string) => c.status === 'skipped' || (c.status === 'scheduled' && c.date < today) ? 'Missed' : c.status === 'done' ? 'Done' : 'Scheduled'

const flagged = (v?: string) => !!v && v.trim() !== '' && v.trim().toLowerCase() !== 'none'

function Overview({ id, go }: { id: string; go: (t: Tab) => void }) {
  const [cws, setCws] = useState<ClientWorkout[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [checkin, setCheckin] = useState<Checkin | null>(null)
  const [health, setHealth] = useState<ClientHealth | null | undefined>(undefined)
  useEffect(() => { supabase.from('client_health').select('*').eq('client_id', id).maybeSingle().then(({ data }) => setHealth((data as ClientHealth) ?? null)) }, [id])
  const [weight, setWeight] = useState<Measurement | null>(null)
  const [kcal, setKcal] = useState<number | null>(null)
  const [taster, setTaster] = useState<TasterSession | null>(null)
  const today = localDate()

  useEffect(() => {
    ;(async () => {
      const [a, b, c, d, e] = await Promise.all([
        supabase.from('client_workouts').select('*').eq('client_id', id).order('date', { ascending: false }).limit(30),
        supabase.from('checkins').select('*').eq('client_id', id).order('date', { ascending: false }).limit(1),
        supabase.from('measurements').select('*').eq('client_id', id).not('weight_kg', 'is', null).order('date', { ascending: false }).limit(1),
        supabase.from('food_logs').select('*').eq('client_id', id).gte('date', addDays(today, -6)),
        supabase.from('taster_sessions').select('*').eq('client_id', id).order('assessed_on', { ascending: false }).order('created_at', { ascending: false }).limit(1),
      ])
      const list = (a.data ?? []) as ClientWorkout[]
      setCws(list); setCheckin(((b.data ?? []) as Checkin[])[0] ?? null); setWeight(((c.data ?? []) as Measurement[])[0] ?? null)
      const logs = (d.data ?? []) as FoodLog[]
      const daysLogged = new Set(logs.map(l => l.date)).size
      setKcal(daysLogged ? Math.round(sum(logs).kcal / daysLogged) : null)
      setTaster(((e.data ?? []) as TasterSession[])[0] ?? null)
      const ids = [...new Set(list.map(x => x.workout_id))]
      if (ids.length) {
        const { data } = await supabase.from('workouts').select('id, name').in('id', ids)
        setNames(Object.fromEntries(((data ?? []) as Workout[]).map(w => [w.id, w.name])))
      }
    })()
  }, [id, today])

  const recent = cws.filter(c => c.date >= addDays(today, -14) && c.date <= today)
  const done = recent.filter(c => c.status === 'done').length
  const tasterAlerts = parqAlerts(taster?.parq_answers)
  const tasterDetails = taster ? [taster.parq_health_details, taster.parq_injury_details, taster.parq_medication_details, taster.parq_allergy_details].filter(Boolean) : []
  return (
    <>
      {taster ? <div className="card goal-card">
        <span className="eyebrow">Current fitness goal</span><h2>{taster.goal}</h2>
        <div className="row"><span className="badge red">Target {niceDate(taster.target_date)}</span><span className="badge">{taster.target_kcal} kcal/day</span></div>
      </div> : <button className="card click goal-card empty-goal" onClick={() => go('taster')}><span><span className="eyebrow">Fitness goal</span><b>No taster session completed</b></span><span className="link red">Set up</span></button>}
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <Tile label="Compliance" value={recent.length ? `${Math.round((done / recent.length) * 100)}%` : '-'} foot="last 14 days" />
        <Tile label="Weight" value={weight ? Number(weight.weight_kg) : '-'} unit={weight ? 'kg' : ''} foot={weight ? niceDate(weight.date) : 'Not logged'} />
        <Tile label="Avg calories" value={kcal ?? '-'} foot="logged days, last 7" />
        <SessionBalance clientId={id} coach />
      </div>
      <ClientSessions clientId={id} />
      <ClientOnboarding key={`onboarding-${id}`} clientId={id} coach />
      {health !== undefined && (
        <div className={'card tight' + ((health && (flagged(health.allergies) || flagged(health.health_conditions))) || tasterAlerts.length ? ' consent-card' : '')}>
          <span className="eyebrow">Health and consent</span>
          {!health || !health.consented_at
            ? <p style={{ margin: 0 }} className="health-alert">Has not completed the health and consent form yet. They will be asked when they next sign in.</p>
            : <div className="stack" style={{ gap: 4 }}>
                <span className={'small' + (flagged(health.allergies) ? ' health-alert' : '')}><b>Allergies:</b> {health.allergies}</span>
                <span className={'small' + (flagged(health.health_conditions) ? ' health-alert' : '')}><b>Health conditions or injuries:</b> {health.health_conditions}</span>
                {health.medications && <span className="small"><b>Medication:</b> {health.medications}</span>}
                {health.emergency_contact && <span className="small"><b>Emergency contact:</b> {health.emergency_contact}</span>}
                <span className="mute small">Consent given {new Date(health.consented_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>}
          {taster && <><hr className="sep" /><div className="stack" style={{ gap: 6 }}>
            <b className="small">Taster-session health screening</b>
            {tasterAlerts.length ? <div className="health-alert-list">{tasterAlerts.map(alert => <div className="health-alert-item" key={alert}>{alert}</div>)}</div> : <span className="small">No exercise-safety concerns recorded.</span>}
            {tasterDetails.map(detail => <span className="small" key={detail}>{detail}</span>)}
            <span className="mute small">Health-information storage consent {taster.parq_health_storage_consent ? 'recorded' : 'not recorded'}.</span>
            <span className="mute small">Personal-training and exercise consent {taster.parq_exercise_consent ? 'recorded' : 'not recorded'}.</span>
          </div></>}
        </div>
      )}
      {checkin?.note && <div className="card tight"><span className="eyebrow">Latest check-in note</span><p style={{ margin: 0 }}>{checkin.note}</p></div>}
      <WeeklyCheckins key={id} clientId={id} coach />
      <div className="section-title"><h2>Recent workouts</h2><button className="link red" onClick={() => go('training')}>Manage</button></div>
      <div className="card tight">
        {cws.length === 0 && <Empty icon="train" title="No workouts assigned">Open Training to schedule one.</Empty>}
        <div className="list">
          {cws.filter(c => c.date <= addDays(today, 3)).slice(0, 8).map(c => (
            <Link key={c.id} to={`/workout/${c.id}`} className="item">
              <span className="grow"><span className="title">{names[c.workout_id] ?? 'Workout'}</span><br /><span className="meta">{relDay(c.date)}{c.status === 'done' ? ` · ${setsDone(c)} sets` : ''}</span></span>
              <span className={'badge ' + (c.status === 'done' ? 'green' : sessionLabel(c, today) === 'Missed' ? 'amber' : 'blue')}>{sessionLabel(c, today)}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}

function Training({ id }: { id: string }) {
  const { clients } = useClients()
  const client = clients?.find(c => c.id === id)
  const [cws, setCws] = useState<ClientWorkout[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [programs, setPrograms] = useState<Program[]>([])
  const { profile } = useAuth()
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const [pick, setPick] = useState(false)
  const [wk, setWk] = useState<Workout | null>(null)
  const [prog, setProg] = useState<{ p: Program; days: ProgramDay[] } | null>(null)
  const [progList, setProgList] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<ClientWorkout | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState('')
  const removeBusy = useRef(false)
  const [allHistory, setAllHistory] = useState(false)
  const [cal, setCal] = useState(localDate())
  const [edit, setEdit] = useState<ClientWorkout | null>(null)
  const [eDate, setEDate] = useState('')
  const [eStatus, setEStatus] = useState<ClientWorkout['status']>('scheduled')
  const [eWorkout, setEWorkout] = useState<{ id: string; name: string } | null>(null)
  const [swap, setSwap] = useState(false)
  // Repeat: copy sessions the client already has onto new dates.
  const [rep, setRep] = useState(false)
  const [repSel, setRepSel] = useState<string[]>([])
  const [repStart, setRepStart] = useState('')
  const [repCycles, setRepCycles] = useState(1)
  const [repBusy, setRepBusy] = useState(false)
  const [repMsg, setRepMsg] = useState('')
  const [oneDate, setOneDate] = useState('')
  const [oneWeeks, setOneWeeks] = useState(1)
  const [eBusy, setEBusy] = useState(false)
  const [eErr, setEErr] = useState('')
  const today = localDate()

  const load = useCallback(async () => {
    const { data } = await supabase.from('client_workouts').select('*').eq('client_id', id).order('date').limit(1000)
    const list = (data ?? []) as ClientWorkout[]
    setCws(list)
    const ids = [...new Set(list.map(x => x.workout_id))]
    if (ids.length) {
      const { data: w } = await supabase.from('workouts').select('id, name').in('id', ids)
      setNames(Object.fromEntries(((w ?? []) as Workout[]).map(x => [x.id, x.name])))
    }
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { supabase.from('programs').select('*').order('name').then(({ data }) => setPrograms((data ?? []) as Program[])) }, [])

  async function custom() {
    setCreating(true)
    const first = (client?.full_name ?? '').split(' ')[0]
    const { data, error } = await supabase.from('workouts').insert({ name: first ? `${first}'s workout` : 'Custom workout', created_by: profile!.id }).select().single()
    setCreating(false)
    if (error || !data) return alert(error?.message ?? 'Could not create the workout')
    nav(`/library/workouts/${data.id}?assignTo=${id}`)
  }
  async function remove() {
    if (!removeTarget || removeTarget.status === 'done' || removeBusy.current) return
    removeBusy.current = true; setRemoving(true); setRemoveError('')
    try {
      const clips = await supabase.from('exercise_videos').select('id').eq('client_workout_id', removeTarget.id).limit(1)
      if (clips.error) throw clips.error
      if (clips.data?.length) {
        setRemoveError('This session has technique feedback. It cannot be removed here.')
        return
      }
      const result = await supabase.from('client_workouts').delete().eq('id', removeTarget.id).eq('client_id', id).neq('status', 'done').select('id')
      if (result.error) throw result.error
      if (!result.data?.length) {
        setRemoveError('This session has changed or is no longer available. Close and refresh the page.')
        return
      }
      setCws(list => list.filter(c => c.id !== removeTarget.id))
      setRemoveTarget(null)
    } catch { setRemoveError('Could not remove this workout. Please check your connection and try again.') }
    finally { removeBusy.current = false; setRemoving(false) }
  }
  function startEdit(c: ClientWorkout) {
    setEdit(c); setOneDate(addDays(c.date < today ? today : c.date, 7)); setOneWeeks(1); setEDate(c.date); setEStatus(c.status); setEWorkout({ id: c.workout_id, name: names[c.workout_id] ?? 'Workout' }); setEErr('')
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!edit || !eWorkout) return
    if (!eDate) return setEErr('Choose a date.')
    setEBusy(true); setEErr('')
    const patch: Partial<ClientWorkout> = { date: eDate, status: eStatus, workout_id: eWorkout.id }
    // Done sessions keep their original finish time; a session the coach marks done gets noon on its day.
    patch.completed_at = eStatus === 'done' ? (edit.completed_at ?? new Date(eDate + 'T12:00:00').toISOString()) : null
    const { data, error } = await supabase.from('client_workouts').update(patch).eq('id', edit.id).eq('client_id', id).select('id')
    setEBusy(false)
    if (error) return setEErr(/exercise choices cannot change template/i.test(error.message) ? 'This session has a swapped exercise, so its workout cannot be changed. Remove it and assign the new workout instead.' : 'Could not save the changes. Please try again.')
    if (!data?.length) return setEErr('This session is no longer available. Refresh the page.')
    setEdit(null); load()
  }
  /** What a repeat would create: the chosen sessions keep their spacing, starting on repStart, once per cycle (each cycle a whole number of weeks long). */
  function repeatPlan(sel: ClientWorkout[], start: string, cycles: number) {
    if (!sel.length || !start) return []
    const sorted = [...sel].sort((a, b) => a.date.localeCompare(b.date))
    const first = sorted[0].date
    const span = Math.max(1, Math.ceil((daysBetween(first, sorted[sorted.length - 1].date) + 1) / 7)) * 7
    return Array.from({ length: cycles }, (_, k) => sorted.map(c => ({ workout_id: c.workout_id, date: addDays(start, daysBetween(first, c.date) + k * span) }))).flat()
  }
  function openRepeat() {
    const from = addDays(today, -14)
    setRepSel(cws.filter(c => c.date >= from && c.date <= today).map(c => c.id))
    setRepStart(addDays(startOfWeek(today), 7)); setRepCycles(1); setRepMsg(''); setRep(true)
  }
  async function insertCopies(rows: { workout_id: string; date: string }[]) {
    // Skip a workout that is already scheduled on that date, so repeating twice never doubles a day.
    const have = new Set(cws.map(c => c.workout_id + '|' + c.date))
    const fresh = rows.filter(r => !have.has(r.workout_id + '|' + r.date))
    if (!fresh.length) return { added: 0, skipped: rows.length }
    const { error } = await supabase.from('client_workouts').insert(fresh.map(r => ({ client_id: id, workout_id: r.workout_id, date: r.date })))
    if (error) return { error: 'Could not add the sessions. Please try again.' }
    return { added: fresh.length, skipped: rows.length - fresh.length }
  }
  async function saveRepeat() {
    const plan = repeatPlan(cws.filter(c => repSel.includes(c.id)), repStart, repCycles)
    if (!plan.length) return setRepMsg('Choose at least one session and a start date.')
    setRepBusy(true); setRepMsg('')
    const r = await insertCopies(plan)
    setRepBusy(false)
    if ('error' in r && r.error) return setRepMsg(r.error)
    setCal(plan[0].date); setRep(false); load()
  }
  async function repeatOne() {
    if (!edit || !oneDate) return setEErr('Choose the date to repeat it on.')
    setEBusy(true); setEErr('')
    const r = await insertCopies(Array.from({ length: oneWeeks }, (_, i) => ({ workout_id: eWorkout?.id ?? edit.workout_id, date: addDays(oneDate, i * 7) })))
    setEBusy(false)
    if ('error' in r && r.error) return setEErr(r.error)
    setCal(oneDate); setEdit(null); load()
  }
  async function choose(p: Program) {
    const { data } = await supabase.from('program_days').select('*').eq('program_id', p.id)
    setProgList(false); setProg({ p, days: (data ?? []) as ProgramDay[] })
  }

  const upcoming = cws.filter(c => c.date >= today)
  const past = cws.filter(c => c.date < today && (allHistory || c.date >= addDays(today, -14))).reverse()
  const calDays = weekOf(cal)
  const chip = (c: ClientWorkout) => (
    <button key={c.id} type="button" className={'cal-chip ' + (c.status === 'done' ? 'done' : sessionLabel(c, today) === 'Missed' ? 'missed' : 'planned')} onClick={() => startEdit(c)} aria-label={`Open ${names[c.workout_id] ?? 'workout'} on ${niceDate(c.date)}`}>
      <b>{names[c.workout_id] ?? 'Workout'}</b><small>{sessionLabel(c, today)}</small>
    </button>
  )
  const row = (c: ClientWorkout) => (
    <div key={c.id} className="item">
      <Link to={`/workout/${c.id}`} className="grow" style={{ color: 'var(--ink)' }}><span className="title">{names[c.workout_id] ?? 'Workout'}</span><br /><span className="meta">{relDay(c.date)} · {niceDate(c.date)}{c.status === 'done' ? ` · ${setsDone(c)} sets logged` : ''}</span></Link>
      <span className={'badge ' + (c.status === 'done' ? 'green' : sessionLabel(c, today) === 'Missed' ? 'amber' : 'blue')}>{sessionLabel(c, today)}</span>
      <button className="link" onClick={() => startEdit(c)} aria-label={`Edit ${names[c.workout_id] ?? 'workout'} on ${niceDate(c.date)}`}>Edit</button>
      {c.status !== 'done' && <button className="link" disabled={removing} onClick={() => { setRemoveError(''); setRemoveTarget(c) }} aria-label="Remove from schedule">Remove</button>}
    </div>
  )
  return (
    <>
      <div className="row">
        <button onClick={() => setPick(true)}><Icon name="plus" size={16} />Assign workout</button>
        <button className="soft" onClick={openRepeat} disabled={cws.length === 0}><Icon name="copy" size={16} />Repeat sessions</button>
        <button className="soft" onClick={custom} disabled={creating}><Icon name="edit" size={16} />{creating ? 'Creating...' : 'Custom workout'}</button>
        <button className="soft" onClick={() => setProgList(true)}><Icon name="library" size={16} />Assign programme</button>
      </div>
      <section className="card" aria-label="Workout calendar">
        <div className="row between" style={{ marginBottom: 10 }}>
          <button className="icon" onClick={() => setCal(addDays(cal, -7))} aria-label="Previous week"><Icon name="back" size={18} /></button>
          <b>{niceDate(calDays[0])} to {niceDate(calDays[6])}</b>
          <button className="icon" onClick={() => setCal(addDays(cal, 7))} aria-label="Next week"><Icon name="chev" size={18} /></button>
        </div>
        {!calDays.includes(today) && <div style={{ marginBottom: 10 }}><button className="soft sm" onClick={() => setCal(today)}>Back to this week</button></div>}
        <div className="cal-week">
          {calDays.map((d, i) => {
            const day = cws.filter(c => c.date === d)
            return <div key={d} className={'cal-day' + (d === today ? ' today' : '')}>
              <div className="cal-head"><small>{DAY_NAMES[i]}</small><b>{Number(d.slice(8))}</b></div>
              {day.map(chip)}
              {day.length === 0 && <span className="mute small">Rest</span>}
            </div>
          })}
        </div>
        <div className="calendar-legend"><span><i className="booked" />Done</span><span><i className="open" />Planned</span><span><i className="missed" />Missed</span></div>
      </section>
      <div className="section-title"><h2>Upcoming</h2><span className="mute small">{upcoming.length} scheduled</span></div>
      <div className="card tight">{upcoming.length === 0 && <Empty icon="calendar" title="Nothing scheduled" />}<div className="list">{upcoming.map(row)}</div></div>
      <div className="section-title"><h2>{allHistory ? 'All past sessions' : 'Past two weeks'}</h2><button className="link red" onClick={() => setAllHistory(v => !v)}>{allHistory ? 'Show last two weeks' : 'Show earlier'}</button></div>
      <div className="card tight">{past.length === 0 && <Empty icon="calendar" title="No past sessions" />}<div className="list">{past.map(row)}</div></div>
      <ClientSessions clientId={id} />

      <Sheet open={!!edit} onClose={() => { if (!eBusy) setEdit(null) }} title="Edit session">
        {edit && eWorkout && <form className="stack" onSubmit={saveEdit}>
          <div className="item" style={{ cursor: 'default' }}><span className="grow"><span className="title">{eWorkout.name}</span></span><button type="button" className="ghost sm" onClick={() => setSwap(true)}>Change workout</button></div>
          <label className="field">Date<input type="date" value={eDate} onChange={e => setEDate(e.target.value)} required /></label>
          <label className="field">Status
            <select value={eStatus} onChange={e => setEStatus(e.target.value as ClientWorkout['status'])}>
              <option value="done">Done</option>
              <option value="skipped">Missed</option>
              <option value="scheduled">Scheduled (not done yet)</option>
            </select>
          </label>
          <Link className="btn soft" to={`/workout/${edit.id}?returnTo=${encodeURIComponent(`/clients/${id}?tab=training`)}`}>Edit sets, reps and weights</Link>
          {edit.status !== 'done' && eStatus === 'done' && <span className="mute small">No sets are logged for this session. It will count as done.</span>}
          {edit.status === 'done' && eStatus !== 'done' && <span className="mute small">The sets the client logged are kept.</span>}
          <button disabled={eBusy}>{eBusy ? 'Saving...' : 'Save changes'}</button>{eErr && <span className="err" role="alert">{eErr}</span>}
          <details>
            <summary className="mute small" style={{ cursor: 'pointer' }}>Repeat this session</summary>
            <div className="stack" style={{ marginTop: 8 }}>
              <label className="field">Repeat on<input type="date" value={oneDate} onChange={e => setOneDate(e.target.value)} aria-label="Repeat on date" /></label>
              <label className="field">How many times
                <select value={oneWeeks} onChange={e => setOneWeeks(Number(e.target.value))} aria-label="Repeat how many times">
                  <option value={1}>Just that date</option>
                  {[2, 3, 4, 6, 8, 12].map(n => <option key={n} value={n}>{n} weeks, same weekday</option>)}
                </select>
              </label>
              <button type="button" className="soft" disabled={eBusy} onClick={repeatOne}>Add repeats</button>
            </div>
          </details>
        </form>}
      </Sheet>
      <Sheet open={rep} onClose={() => { if (!repBusy) setRep(false) }} title="Repeat sessions">
        <div className="stack">
          <p className="mute small" style={{ margin: 0 }}>Tick the sessions to repeat. They keep the same spacing, starting on the date you choose.</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="soft sm" onClick={() => setRepSel(cws.filter(c => c.date >= addDays(today, -14) && c.date <= today).map(c => c.id))}>Last 2 weeks</button>
            <button type="button" className="soft sm" onClick={() => setRepSel(cws.filter(c => c.date >= addDays(today, -28) && c.date <= today).map(c => c.id))}>Last 4 weeks</button>
            <button type="button" className="soft sm" onClick={() => setRepSel([])}>Clear</button>
          </div>
          <div className="list" style={{ maxHeight: 260, overflowY: 'auto' }}>
            {cws.filter(c => c.date >= addDays(today, -56) && c.date <= addDays(today, 56)).map(c => (
              <label key={c.id} className="item" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={repSel.includes(c.id)} onChange={e => setRepSel(e.target.checked ? [...repSel, c.id] : repSel.filter(x => x !== c.id))} aria-label={`Repeat ${names[c.workout_id] ?? 'workout'} from ${niceDate(c.date)}`} />
                <span className="grow"><span className="title">{names[c.workout_id] ?? 'Workout'}</span><br /><span className="meta">{niceDate(c.date)} · {sessionLabel(c, today)}</span></span>
              </label>
            ))}
            {cws.filter(c => c.date >= addDays(today, -56) && c.date <= addDays(today, 56)).length === 0 && <Empty icon="calendar" title="No sessions in the last two months" />}
          </div>
          <label className="field">First repeated session goes on<input type="date" value={repStart} onChange={e => setRepStart(e.target.value)} /></label>
          <label className="field">Repeat the block
            <select value={repCycles} onChange={e => setRepCycles(Number(e.target.value))}>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n === 1 ? 'Once' : `${n} times in a row`}</option>)}
            </select>
          </label>
          {(() => { const plan = repeatPlan(cws.filter(c => repSel.includes(c.id)), repStart, repCycles); return plan.length ? <span className="mute small">{plan.length} session{plan.length === 1 ? '' : 's'} will be added, {niceDate(plan[0].date)} to {niceDate(plan[plan.length - 1].date)}.</span> : null })()}
          <button disabled={repBusy || repSel.length === 0 || !repStart} onClick={saveRepeat}>{repBusy ? 'Adding...' : 'Add to schedule'}</button>
          {repMsg && <span className="err" role="alert">{repMsg}</span>}
        </div>
      </Sheet>
      <WorkoutPicker open={swap} onClose={() => setSwap(false)} onPick={w => { setEWorkout({ id: w.id, name: w.name }); setSwap(false) }} />

      <Sheet open={!!removeTarget} onClose={() => { if (!removeBusy.current) setRemoveTarget(null) }} title="Remove workout">
        {removeTarget && <div className="stack">
          <p>Remove <b>{names[removeTarget.workout_id] ?? 'Workout'}</b> on {niceDate(removeTarget.date)} from this client's schedule? Unfinished entries for this session will be removed. The saved workout and other sessions will stay.</p>
          {removeError && <p className="err" role="alert">{removeError}</p>}
          <div className="row">
            <button className="soft" disabled={removing} onClick={() => setRemoveTarget(null)}>Cancel</button>
            <button disabled={removing} onClick={remove}>{removing ? 'Removing...' : 'Confirm removal'}</button>
          </div>
        </div>}
      </Sheet>
      <WorkoutPicker open={pick} onClose={() => setPick(false)} onPick={w => { setPick(false); setWk(w) }} />
      <Sheet open={!!wk} onClose={() => { setWk(null); load() }} title={`Assign ${wk?.name ?? ''}`}>{wk && client && <AssignWorkout workout={wk} clients={[client]} presetClient={id} onClose={() => { setWk(null); load() }} />}</Sheet>
      <Sheet open={progList} onClose={() => setProgList(false)} title="Choose a programme">
        <div className="list">{programs.map(p => (
          <button key={p.id} className="item" onClick={() => choose(p)}><span className="grow"><span className="title">{p.name}</span><br /><span className="meta">{p.goal} · {p.level} · {p.weeks} weeks</span></span><Icon name="chev" /></button>
        ))}</div>
      </Sheet>
      <Sheet open={!!prog} onClose={() => { setProg(null); load() }} title={prog ? `Assign ${prog.p.name}` : ''}>{prog && client && <AssignProgram program={prog.p} days={prog.days} clients={[client]} presetClient={id} onClose={() => { setProg(null); load() }} />}</Sheet>
    </>
  )
}

function Nutrition({ id }: { id: string }) {
  const [t, setT] = useState({ kcal: '', protein: '', carbs: '', fat: '', notes: '' })
  const [weight, setWeight] = useState<number | null>(null)
  const [plan, setPlan] = useState<(MealPlanItem & { recipe?: Recipe })[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [day, setDay] = useState(1)
  const [pickFor, setPickFor] = useState<(typeof MEALS)[number] | null>(null)
  const [msg, setMsg] = useState('')
  const [logs, setLogs] = useState<FoodLog[]>([])

  const load = useCallback(async () => {
    const [a, b, c, d, e] = await Promise.all([
      supabase.from('nutrition_targets').select('*').eq('client_id', id).maybeSingle(),
      supabase.from('meal_plan_items').select('*').eq('client_id', id).order('sort'),
      supabase.from('recipes').select('*'),
      supabase.from('measurements').select('weight_kg').eq('client_id', id).not('weight_kg', 'is', null).order('date', { ascending: false }).limit(1),
      supabase.from('food_logs').select('*').eq('client_id', id).gte('date', addDays(localDate(), -6)),
    ])
    const tg = a.data as Targets | null
    if (tg) setT({ kcal: String(tg.kcal ?? ''), protein: String(tg.protein ?? ''), carbs: String(tg.carbs ?? ''), fat: String(tg.fat ?? ''), notes: tg.notes })
    const r = (c.data ?? []) as Recipe[]
    setRecipes(r)
    setPlan(((b.data ?? []) as MealPlanItem[]).map(i => ({ ...i, recipe: r.find(x => x.id === i.recipe_id) })))
    setWeight(((d.data ?? []) as { weight_kg: number }[])[0] ? Number((d.data as { weight_kg: number }[])[0].weight_kg) : null)
    setLogs((e.data ?? []) as FoodLog[])
  }, [id])
  useEffect(() => { load() }, [load])

  async function saveTargets(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    const { error } = await supabase.from('nutrition_targets').upsert({
      client_id: id, kcal: Number(t.kcal) || null, protein: Number(t.protein) || null, carbs: Number(t.carbs) || null, fat: Number(t.fat) || null, notes: t.notes, updated_at: new Date().toISOString(),
    })
    setMsg(error ? error.message : 'Targets saved')
  }
  function suggest() {
    const kcal = Number(t.kcal)
    if (!kcal) return setMsg('Enter calories first.')
    const s = suggestTargets(kcal, weight ?? 75)
    setT({ ...t, protein: String(s.protein), carbs: String(s.carbs), fat: String(s.fat) })
    setMsg(weight ? `Split from their ${weight} kg bodyweight: 2 g/kg protein, 0.8 g/kg fat, carbs fill the rest.` : 'No weight logged, used 75 kg. Adjust as needed.')
  }
  async function addMeal(r: Recipe) {
    const meal = pickFor!; setPickFor(null)
    await supabase.from('meal_plan_items').insert({ client_id: id, day, meal_type: meal, recipe_id: r.id, servings: 1, sort: plan.filter(p => p.day === day && p.meal_type === meal).length })
    load()
  }
  async function setServings(i: MealPlanItem, servings: number) {
    if (!(servings > 0)) return
    await supabase.from('meal_plan_items').update({ servings }).eq('id', i.id); load()
  }
  async function removeMeal(i: MealPlanItem) { await supabase.from('meal_plan_items').delete().eq('id', i.id); load() }
  async function generate() {
    if (plan.length && !confirm('Replace the current weekly plan with a new generated one?')) return
    const tg: Targets = { client_id: id, kcal: Number(t.kcal) || null, protein: null, carbs: null, fat: null, notes: '' }
    const rows = generateWeek(recipes, tg, id)
    if (!rows.length) return setMsg('Add some recipes first.')
    await supabase.from('meal_plan_items').delete().eq('client_id', id)
    const { error } = await supabase.from('meal_plan_items').insert(rows)
    setMsg(error ? error.message : `Generated a 7-day plan around ${tg.kcal ?? 2000} kcal.`); load()
  }
  async function clearPlan() { if (confirm('Clear the whole weekly plan?')) { await supabase.from('meal_plan_items').delete().eq('client_id', id); load() } }

  const dayItems = plan.filter(p => p.day === day)
  const dayTotal = sum(dayItems.filter(p => p.recipe).map(p => forServings(p.recipe!, Number(p.servings))))
  const byDate = new Map<string, FoodLog[]>()
  for (const l of logs) byDate.set(l.date, [...(byDate.get(l.date) ?? []), l])

  return (
    <>
      <form className="card stack" onSubmit={saveTargets}>
        <h2 style={{ margin: 0 }}>Daily targets</h2>
        <div className="inline-inputs">
          <label className="field">Calories<input type="number" min="0" value={t.kcal} onChange={e => setT({ ...t, kcal: e.target.value })} /></label>
          <label className="field">Protein g<input type="number" min="0" value={t.protein} onChange={e => setT({ ...t, protein: e.target.value })} /></label>
          <label className="field">Carbs g<input type="number" min="0" value={t.carbs} onChange={e => setT({ ...t, carbs: e.target.value })} /></label>
          <label className="field">Fat g<input type="number" min="0" value={t.fat} onChange={e => setT({ ...t, fat: e.target.value })} /></label>
        </div>
        <textarea rows={2} placeholder="Note for the client (optional)" value={t.notes} onChange={e => setT({ ...t, notes: e.target.value })} />
        <div className="row" style={{ marginBottom: 0 }}><button>Save targets</button><button type="button" className="soft" onClick={suggest}><Icon name="sparkle" size={16} />Suggest split</button></div>
      </form>
      {msg && <p className={/saved|Generated|Split/.test(msg) ? 'ok small' : 'mute small'}>{msg}</p>}

      <div className="section-title"><h2>Weekly meal plan</h2>
        <div className="row" style={{ marginBottom: 0 }}><button className="soft sm" onClick={generate}><Icon name="sparkle" size={15} />Generate week</button><Link className="btn soft sm" to={`/meal-plans?client=${id}`}>Meal plan library</Link>{plan.length > 0 && <button className="link" onClick={clearPlan}>Clear</button>}</div>
      </div>
      <div className="week-strip">
        {DAY_NAMES.map((n, i) => <button key={n} className={day === i + 1 ? 'on' : ''} onClick={() => setDay(i + 1)}><small>{n}</small><b>{plan.filter(p => p.day === i + 1).length || '-'}</b><i className={plan.some(p => p.day === i + 1) ? 'has' : ''} /></button>)}
      </div>
      <div className="card">
        {dayItems.length > 0 && <><MacroChips m={dayTotal} /><hr className="sep" /></>}
        {MEALS.map(meal => (
          <div key={meal} style={{ marginBottom: 14 }}>
            <div className="meal-head"><h3>{MEAL_LABEL[meal]}</h3><button className="soft sm" onClick={() => setPickFor(meal)}><Icon name="plus" size={14} />Add</button></div>
            {dayItems.filter(p => p.meal_type === meal).map(p => (
              <div key={p.id} className="food-row">
                <span className="grow"><b style={{ fontWeight: 600 }}>{p.recipe?.name ?? 'Recipe'}</b>{p.recipe && <><br /><span className="mute small">{Math.round(p.recipe.kcal * Number(p.servings))} kcal</span></>}</span>
                <input type="number" min="0.25" step="0.25" value={Number(p.servings)} onChange={e => setServings(p, Number(e.target.value))} style={{ width: 76, minHeight: 38, padding: 6, textAlign: 'center' }} aria-label="Servings" />
                <button className="link" onClick={() => removeMeal(p)}>Remove</button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <RecipePicker open={!!pickFor} meal={pickFor ?? undefined} onClose={() => setPickFor(null)} onPick={addMeal} />

      <div className="section-title"><h2>What they actually ate</h2></div>
      <div className="card tight">
        {byDate.size === 0 && <Empty icon="nutrition" title="No food logged in the last 7 days" />}
        <div className="list">
          {[...byDate].sort((a, b) => b[0].localeCompare(a[0])).map(([date, ls]) => {
            const s = sum(ls)
            return <div key={date} className="item"><span className="grow"><span className="title">{relDay(date)}</span><br /><span className="meta">{ls.length} entries</span></span><MacroChips m={s} /></div>
          })}
        </div>
        {byDate.size > 0 && Number(t.kcal) > 0 && <><hr className="sep" /><MacroBar label="Average vs target" value={sum(logs).kcal / byDate.size} target={Number(t.kcal)} color="var(--gold)" unit="kcal" /></>}
      </div>
    </>
  )
}

function DeleteClient({ client }: { client: { id: string; full_name: string } }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const name = (client.full_name || 'Unnamed').trim()
  const matches = typed.trim().toLowerCase() === name.toLowerCase()

  function close() { if (!busy) { setOpen(false); setTyped(''); setErr('') } }
  async function remove(e: React.FormEvent) {
    e.preventDefault()
    if (!matches || busy) return
    setErr(''); setBusy(true)
    const { data, error } = await supabase.functions.invoke('delete-client', { body: { client_id: client.id } })
    if (error || data?.error) {
      let msg = data?.error ?? error?.message ?? 'Could not delete the client'
      const res = (error as { context?: Response } | null)?.context
      if (res && typeof res.json === 'function') msg = (await res.json().catch(() => null))?.error ?? msg
      setBusy(false); return setErr(msg)
    }
    navigate('/clients', { replace: true })
  }

  return (
    <>
      <div className="card" style={{ marginTop: 22 }}>
        <h3>Delete client</h3>
        <p className="mute small">Use this for a client added by mistake or who never joined. It permanently removes their login and all their data. To keep their history, archive them from the Clients list instead.</p>
        <button type="button" className="danger" onClick={() => setOpen(true)}>Delete client</button>
      </div>
      <Sheet open={open} onClose={close} title="Delete client">
        <form className="stack" onSubmit={remove}>
          <p>This permanently deletes <b>{name}</b>: their login, workouts, check-ins, food logs, measurements, photos, messages, bookings and balance. It cannot be undone.</p>
          <label className="field">Type their name to confirm<input value={typed} onChange={e => setTyped(e.target.value)} placeholder={name} autoComplete="off" autoFocus /></label>
          {err && <p className="mute small" style={{ color: 'var(--danger)' }}>{err}</p>}
          <div className="row" style={{ marginBottom: 0 }}>
            <button type="submit" className="danger" disabled={!matches || busy}>{busy ? 'Deleting...' : 'Delete permanently'}</button>
            <button type="button" className="soft" onClick={close} disabled={busy}>Cancel</button>
          </div>
        </form>
      </Sheet>
    </>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const { clients } = useClients()
  const [sp] = useSearchParams()
  const [tab, setTab] = usePageTab<Tab>('client', ['overview', 'taster', 'training', 'nutrition', 'habits', 'progress'], 'overview', 'tab', sp.has('reviewWeek'))
  if (!id) return null
  if (!clients) return <Skeleton n={3} />
  const c = clients.find(x => x.id === id)
  if (!c) return <div className="card"><Empty icon="clients" title="Client not found"><Link to="/clients">Back to clients</Link></Empty></div>
  return (
    <>
      <div className="row nowrap" style={{ marginBottom: 14 }}>
        <Link to="/clients" className="btn icon" aria-label="Back to clients"><Icon name="back" size={18} /></Link>
        <Avatar name={c.full_name} size={46} />
        <div className="grow"><h1 style={{ fontSize: '1.35rem' }}>{c.full_name || 'Unnamed'}</h1><span className="mute small">Client{c.created_at ? ` since ${niceDate(c.created_at.slice(0, 10))}` : ''}</span></div>
        <Link to={`/inbox/${id}`} className="btn soft sm"><Icon name="chat" size={16} />Message</Link>
      </div>
      <Seg value={tab} onChange={setTab} options={[
        { value: 'overview', label: 'Overview' }, { value: 'taster', label: 'Taster session' }, { value: 'training', label: 'Training' }, { value: 'nutrition', label: 'Nutrition' },
        { value: 'habits', label: 'Habits' }, { value: 'progress', label: 'Progress' },
      ]} />
      {tab === 'overview' && <Overview id={id} go={setTab} />}
      {tab === 'taster' && <TasterSessionForm clientId={id} />}
      {tab === 'training' && <Training id={id} />}
      {tab === 'nutrition' && <Nutrition id={id} />}
      {tab === 'habits' && <CoachHabits clientId={id} />}
      {tab === 'progress' && <Progress clientId={id} readOnly />}
      <DeleteClient client={c} />
    </>
  )
}


