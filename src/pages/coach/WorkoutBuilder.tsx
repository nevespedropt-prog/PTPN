import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { CARDIO_FIELDS, CARDIO_STYLE_HINT, FORMAT_LABEL, SET_STYLE_LABEL, SET_STYLE_SIZE, normaliseSetRests, parseWeight, setStyleValidation, weightOf } from '../../lib/training'
import type { SetStyle, Workout, WorkoutFormat, WorkoutItem } from '../../types'
import { Empty, PageHead, Sheet, Skeleton } from '../../components/ui'
import { useClients, useReturnTo } from '../../hooks'
import { AssignWorkout } from './Assign'
import Icon from '../../components/Icon'
import { ExercisePicker } from '../../components/Pickers'
import AlternativeEditor from '../../components/AlternativeEditor'
import WorkoutFormatGuide from '../../components/WorkoutFormatGuide'

type Row = Omit<WorkoutItem, 'workout_id' | 'load' | 'tempo'> & { load: string; tempo: string; isNew?: boolean; cardio?: boolean }

export default function WorkoutBuilder() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const { profile } = useAuth()
  const nav = useNavigate()
  const [w, setW] = useState<Workout | null | undefined>(undefined)
  const [rows, setRows] = useState<Row[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [dirty, setDirty] = useState(false)
  const [sched, setSched] = useState(false)
  const [alternativeItem, setAlternativeItem] = useState<Row | null>(null)
  const [compact, setCompact] = useState(false)
  const [addStyle, setAddStyle] = useState<SetStyle>('single')
  const { clients } = useClients()
  const coach = profile?.role === 'coach'
  const assignTo = coach ? sp.get('assignTo') : null
  const target = clients?.find(c => c.id === assignTo)
  const back = useReturnTo(assignTo ? `/clients/${assignTo}?tab=training` : coach ? '/library?tab=workouts' : '/train?tab=plan')

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const [a, b] = await Promise.all([
        supabase.from('workouts').select('*').eq('id', id).maybeSingle(),
        supabase.from('workout_items').select('*').eq('workout_id', id).order('sort'),
      ])
      const items = (b.data ?? []) as Row[]
      // Cardio exercises get time, distance and speed instead of sets, reps and weight.
      const ids = [...new Set(items.map(r => r.exercise_id).filter(Boolean))] as string[]
      const cats = new Map<string, string>()
      if (ids.length) for (const e of (await supabase.from('exercises').select('id, category').in('id', ids)).data ?? []) cats.set(e.id as string, e.category as string)
      setW(a.data as Workout | null)
      setRows(items.map(r => ({ ...r, weight: weightOf(r), cardio: !!r.exercise_id && cats.get(r.exercise_id) === 'cardio' })))
    })()
  }, [id])

  if (w === undefined) return <Skeleton n={3} />
  if (!w) return <div className="card"><Empty icon="train" title="Workout not found"><Link to={back}>Back</Link></Empty></div>
  const editable = coach || w.created_by === profile?.id

  const upd = (patch: Partial<Workout>) => { setW({ ...w, ...patch }); setDirty(true) }
  const changeFormat = (format: WorkoutFormat) => upd({ format })
  const updRow = (i: number, patch: Partial<Row>) => { setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r))); setDirty(true) }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= rows.length) return
    const next = [...rows]; [next[i], next[j]] = [next[j], next[i]]
    setRows(w.format === 'standard' ? normaliseSetRests(next) : next); setDirty(true)
  }
  const drop = (i: number) => {
    const r = rows[i]
    if (!r.isNew) setRemoved([...removed, r.id])
    const next = rows.filter((_, k) => k !== i)
    setRows(w.format === 'standard' ? normaliseSetRests(next) : next); setDirty(true)
  }
  const add = (e: { id: string | null; name: string; category?: string }) => {
    const cardio = e.category === 'cardio'
    const style: SetStyle = w.format === 'standard' ? addStyle : 'single'
    const required = SET_STYLE_SIZE[style]
    const last = rows[rows.length - 1]
    const lastCount = last ? rows.filter(r => r.group_label === last.group_label).length : 0
    const continueLast = style !== 'single' && last?.set_style === style && lastCount < required
    const group = continueLast ? last.group_label : crypto.randomUUID()
    const position = continueLast ? lastCount : 0
    const rest = style === 'single' ? (cardio ? 0 : 90) : position === required - 1 ? 75 : 0
    const next = [...rows, { id: crypto.randomUUID(), exercise_id: e.id, exercise_name: e.name, sort: rows.length, group_label: group, set_style: style, sets: cardio ? 1 : 3, reps: cardio ? '' : '10', load: '', weight: '', percent_1rm: null, cardio_time: '', cardio_distance_km: null, cardio_speed_kmh: null, rest_sec: rest, tempo: '', notes: '', isNew: true, cardio }]
    setRows(w.format === 'standard' ? normaliseSetRests(next) : next)
    setPicker(false); setDirty(true)
  }

  async function save(): Promise<boolean> {
    const setIssue = w!.format === 'standard' ? setStyleValidation(rows) : ''
    if (setIssue) { setMsg(setIssue); return false }
    setBusy(true); setMsg('')
    const { error: e1 } = await supabase.from('workouts').update({
      name: w!.name.trim() || 'Untitled workout', description: w!.description, format: w!.format,
      duration_min: w!.duration_min || null, rounds: w!.rounds || null,
    }).eq('id', w!.id)
    if (e1) { setBusy(false); setMsg(e1.message); return false }
    if (removed.length) await supabase.from('workout_items').delete().in('id', removed)
    if (rows.length) {
      const saveRows = w!.format === 'standard' ? normaliseSetRests(rows) : rows
      const payload = saveRows.map(({ isNew: _n, cardio: _c, ...r }, i) => {
        // Weight is typed once: "80" for kilos, "75%" for a percent of the client's max, or text. The percent is kept in its own column for the working-load maths.
        const pw = parseWeight(r.weight)
        return { ...r, workout_id: w!.id, sort: i, weight: r.weight.trim(), percent_1rm: pw.kind === 'percent' ? pw.percent : null, sets: r.sets || null, rest_sec: r.rest_sec ?? null }
      })
      const { error } = await supabase.from('workout_items').upsert(payload)
      if (error) { setBusy(false); setMsg(error.message); return false }
    }
    const savedRows = w!.format === 'standard' ? normaliseSetRests(rows) : rows
    setRemoved([]); setRows(savedRows.map(r => ({ ...r, isNew: false }))); setDirty(false); setBusy(false); setMsg('Saved')
    const cw = sp.get('cw')
    if (cw && !coach) nav(`/workout/${cw}?returnTo=${encodeURIComponent(back)}`)
    return true
  }
  async function saveAndSchedule() { if (!dirty || (await save())) setSched(true) }

  const num = (v: string) => (v === '' ? null : Number(v))
  const setIssue = w.format === 'standard' ? setStyleValidation(rows) : ''
  const blockPosition = (i: number) => rows.filter(r => r.group_label === rows[i].group_label).findIndex(r => r.id === rows[i].id)
  const restLocked = (i: number) => w.format === 'standard' && rows[i].set_style !== 'single' && blockPosition(i) < SET_STYLE_SIZE[rows[i].set_style] - 1
  const finalBlockExercise = (i: number) => w.format === 'standard' && rows[i].set_style !== 'single' && blockPosition(i) === SET_STYLE_SIZE[rows[i].set_style] - 1
  const blockBadge = (i: number) => {
    const style = rows[i].set_style
    if (style === 'single') return 'Single set · rest as prescribed'
    const position = blockPosition(i) + 1
    return `${SET_STYLE_LABEL[style]} · exercise ${position} of ${SET_STYLE_SIZE[style]} · ${position === SET_STYLE_SIZE[style] ? 'rest 60–90 s' : 'no rest'}`
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 6 }}>
        <Link to={back} className="btn icon" aria-label="Back"><Icon name="back" size={18} /></Link>
        <span className={msg === 'Saved' ? 'ok small' : 'err small'}>{msg}</span>
      </div>
      <PageHead eyebrow={coach ? 'Workout template' : 'My workout'} title={w.name || 'Untitled workout'} sub={editable ? undefined : 'Read only'} />
      <WorkoutFormatGuide format={w.format} minutes={w.duration_min} rounds={w.rounds} />
      <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="card stack">
          <label className="field">Name<input value={w.name} onChange={e => upd({ name: e.target.value })} /></label>
          <label className="field">Description<textarea aria-label="Description" rows={2} value={w.description} onChange={e => upd({ description: e.target.value })} placeholder="What is this session for?" /></label>
          <div className="inline-inputs">
            <label className="field">Format
              <select aria-label="Format" value={w.format} onChange={e => changeFormat(e.target.value as WorkoutFormat)}>
                {(Object.keys(FORMAT_LABEL) as WorkoutFormat[]).map(f => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
              </select>
            </label>
            <label className="field">Minutes<input type="number" inputMode="numeric" min="1" value={w.duration_min ?? ''} onChange={e => upd({ duration_min: num(e.target.value) })} /></label>
            {w.format !== 'standard' && <label className="field">Rounds<input type="number" inputMode="numeric" min="1" value={w.rounds ?? ''} onChange={e => upd({ rounds: num(e.target.value) })} /></label>}
          </div>
        </div>

        <div className="section-title"><h2>Exercises</h2><div className="row" style={{ margin: 0 }}><span className="mute small">{rows.length} added</span>{rows.length > 0 && <button type="button" className="link sm" onClick={() => setCompact(!compact)}>{compact ? 'Show details' : 'Collapse details'}</button>}</div></div>
        {w.format === 'standard' && <div className="card tight stack" role="status" style={{ borderColor: setIssue ? 'var(--gold)' : 'var(--line)' }}><label className="field">Style for the next exercise block<select aria-label="Set style" value={addStyle} onChange={e => setAddStyle(e.target.value as SetStyle)}>{(Object.keys(SET_STYLE_LABEL) as SetStyle[]).map(style => <option key={style} value={style}>{SET_STYLE_LABEL[style]}</option>)}</select></label><p className="mute small" style={{ margin: 0 }}>Single set: one exercise. Superset: two back-to-back, then 60–90 s rest. Tri-set: three back-to-back, then 60–90 s rest. Change this before starting the next block to mix styles.</p>{setIssue && <p className="err small" style={{ margin: 0 }}>{setIssue}</p>}</div>}
        {rows.length === 0 && <div className="card"><Empty icon="train" title="No exercises yet">Add exercises from the library of 100+ moves or type your own.</Empty></div>}
        {rows.map((r, i) => (
          <div key={r.id} className="card" role="group" aria-label={`Exercise ${i + 1}: ${r.exercise_name}`}>
            <div className="row between nowrap" style={{ marginBottom: 8 }}>
              <b className="grow truncate">{i + 1}. {r.exercise_name}</b>
              <button type="button" className="icon sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><Icon name="up" size={16} /></button>
              <button type="button" className="icon sm" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down"><Icon name="down" size={16} /></button>
              <button type="button" className="icon sm" onClick={() => drop(i)} aria-label={`Remove ${r.exercise_name}`}><Icon name="trash" size={16} /></button>
            </div>
            {w.format === 'standard' && <div className="badge" style={{ marginBottom: 8 }}>{blockBadge(i)}</div>}
            {!compact && (r.cardio ? (
              <>
                <div className="mute small" style={{ marginBottom: 8 }}>Cardio. {CARDIO_STYLE_HINT[w.format]}</div>
                <div className="inline-inputs">
                  {CARDIO_FIELDS[w.format].includes('sets') && <label className="field">Rounds<input type="number" inputMode="numeric" min="1" value={r.sets ?? ''} onChange={e => updRow(i, { sets: num(e.target.value) })} /></label>}
                  {CARDIO_FIELDS[w.format].includes('time') && <label className="field">Time<input value={r.cardio_time} onChange={e => updRow(i, { cardio_time: e.target.value })} placeholder="20:00 or 1:00" /></label>}
                  {CARDIO_FIELDS[w.format].includes('distance') && <label className="field">Distance (km)<input type="number" inputMode="decimal" min="0" step="any" value={r.cardio_distance_km ?? ''} onChange={e => updRow(i, { cardio_distance_km: num(e.target.value) })} /></label>}
                  {CARDIO_FIELDS[w.format].includes('speed') && <label className="field">Speed (km/h)<input type="number" inputMode="decimal" min="0" step="any" value={r.cardio_speed_kmh ?? ''} onChange={e => updRow(i, { cardio_speed_kmh: num(e.target.value) })} /></label>}
                  {CARDIO_FIELDS[w.format].includes('rest') && <label className="field">Rest (s)<input type="number" inputMode="numeric" min={finalBlockExercise(i) ? 60 : 0} max={finalBlockExercise(i) ? 90 : undefined} step="15" disabled={restLocked(i)} value={restLocked(i) ? 0 : r.rest_sec ?? ''} onChange={e => updRow(i, { rest_sec: num(e.target.value) })} /></label>}
                  <label className="field">Details<input value={r.reps} onChange={e => updRow(i, { reps: e.target.value })} placeholder="60 s hard / 60 s easy" /></label>
                </div>
              </>
            ) : (
              <div className="inline-inputs">
                <label className="field">Sets<input type="number" inputMode="numeric" min="1" value={r.sets ?? ''} onChange={e => updRow(i, { sets: num(e.target.value) })} /></label>
                <label className="field">Reps<input value={r.reps} onChange={e => updRow(i, { reps: e.target.value })} placeholder="10 or 30 s" /></label>
                <label className="field">Weight<input value={r.weight} onChange={e => updRow(i, { weight: e.target.value })} placeholder="kg, or 75%" /></label>
                <label className="field">Rest (s)<input type="number" inputMode="numeric" min={finalBlockExercise(i) ? 60 : 0} max={finalBlockExercise(i) ? 90 : undefined} step="15" disabled={restLocked(i)} value={restLocked(i) ? 0 : r.rest_sec ?? ''} onChange={e => updRow(i, { rest_sec: num(e.target.value) })} /></label>
                {!/^burpees?$/i.test(r.exercise_name.trim()) && <label className="field">Tempo<input value={r.tempo} onChange={e => updRow(i, { tempo: e.target.value })} placeholder="3-1-1" /></label>}
              </div>
            ))}
            {!compact && <><input style={{ marginTop: 8 }} placeholder="Coaching notes" value={r.notes} onChange={e => updRow(i, { notes: e.target.value })} />
            {coach && <button type="button" className="soft sm" style={{ marginTop: 10 }} disabled={r.isNew || busy} onClick={() => setAlternativeItem(r)} aria-label={`Manage alternatives for ${r.exercise_name}`}>Approved alternatives</button>}
            {coach && r.isNew && <p className="mute small">Save this exercise before approving alternatives.</p>}</>}
          </div>
        ))}
        {editable && <button type="button" className="soft block" onClick={() => setPicker(true)}><Icon name="plus" size={18} />Add exercise{w.format === 'standard' ? ` to ${SET_STYLE_LABEL[addStyle].toLowerCase()}` : ''}</button>}
      </fieldset>

      {editable && (
        <div className="row" style={{ marginTop: 16 }}>
          <button className={'grow' + (target ? ' soft' : '')} style={{ minHeight: 52 }} onClick={save} disabled={busy || !dirty}>{busy ? 'Saving...' : dirty ? 'Save workout' : 'Saved'}</button>
          {target && <button className="grow" style={{ minHeight: 52 }} onClick={saveAndSchedule} disabled={busy || rows.length === 0}>Save and assign to {target.full_name?.split(' ')[0] || 'client'}</button>}
        </div>
      )}
      <Sheet open={sched} onClose={() => setSched(false)} title={`Assign to ${target?.full_name ?? 'client'}`}>
        {target && <AssignWorkout workout={w} clients={[target]} presetClient={target.id} onClose={() => nav(`/clients/${target.id}?tab=training`)} />}
      </Sheet>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={add} />
      {alternativeItem && <AlternativeEditor key={alternativeItem.id} item={{ ...alternativeItem, workout_id: w.id }} format={w.format} onClose={() => setAlternativeItem(null)} />}
    </>
  )
}
