import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { FORMAT_LABEL } from '../../lib/training'
import type { Workout, WorkoutFormat, WorkoutItem } from '../../types'
import { Empty, PageHead, Skeleton } from '../../components/ui'
import Icon from '../../components/Icon'
import { ExercisePicker } from '../../components/Pickers'

type Row = Omit<WorkoutItem, 'workout_id' | 'load' | 'tempo'> & { load: string; tempo: string; isNew?: boolean }
const LABELS = ['', 'A', 'B', 'C', 'D', 'E']

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
  const coach = profile?.role === 'coach'
  const back = coach ? '/library' : '/train'

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const [a, b] = await Promise.all([
        supabase.from('workouts').select('*').eq('id', id).maybeSingle(),
        supabase.from('workout_items').select('*').eq('workout_id', id).order('sort'),
      ])
      setW(a.data as Workout | null); setRows((b.data ?? []) as Row[])
    })()
  }, [id])

  if (w === undefined) return <Skeleton n={3} />
  if (!w) return <div className="card"><Empty icon="train" title="Workout not found"><Link to={back}>Back</Link></Empty></div>
  const editable = coach || w.created_by === profile?.id

  const upd = (patch: Partial<Workout>) => { setW({ ...w, ...patch }); setDirty(true) }
  const updRow = (i: number, patch: Partial<Row>) => { setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r))); setDirty(true) }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= rows.length) return
    const next = [...rows]; [next[i], next[j]] = [next[j], next[i]]
    setRows(next); setDirty(true)
  }
  const drop = (i: number) => {
    const r = rows[i]
    if (!r.isNew) setRemoved([...removed, r.id])
    setRows(rows.filter((_, k) => k !== i)); setDirty(true)
  }
  const add = (e: { id: string | null; name: string }) => {
    setRows([...rows, { id: crypto.randomUUID(), exercise_id: e.id, exercise_name: e.name, sort: rows.length, group_label: '', sets: 3, reps: '10', load: '', percent_1rm: null, rest_sec: 90, tempo: '', notes: '', isNew: true }])
    setPicker(false); setDirty(true)
  }

  async function save() {
    setBusy(true); setMsg('')
    const { error: e1 } = await supabase.from('workouts').update({
      name: w!.name.trim() || 'Untitled workout', description: w!.description, format: w!.format,
      duration_min: w!.duration_min || null, rounds: w!.rounds || null,
    }).eq('id', w!.id)
    if (e1) { setBusy(false); return setMsg(e1.message) }
    if (removed.length) await supabase.from('workout_items').delete().in('id', removed)
    if (rows.length) {
      const payload = rows.map(({ isNew: _n, ...r }, i) => ({ ...r, workout_id: w!.id, sort: i, percent_1rm: r.percent_1rm || null, sets: r.sets || null, rest_sec: r.rest_sec ?? null }))
      const { error } = await supabase.from('workout_items').upsert(payload)
      if (error) { setBusy(false); return setMsg(error.message) }
    }
    setRemoved([]); setRows(rows.map(r => ({ ...r, isNew: false }))); setDirty(false); setBusy(false); setMsg('Saved')
    const cw = sp.get('cw')
    if (cw && !coach) nav(`/workout/${cw}`)
  }

  const num = (v: string) => (v === '' ? null : Number(v))

  return (
    <>
      <div className="row between" style={{ marginBottom: 6 }}>
        <Link to={back} className="btn icon" aria-label="Back"><Icon name="back" size={18} /></Link>
        <span className={msg === 'Saved' ? 'ok small' : 'err small'}>{msg}</span>
      </div>
      <PageHead eyebrow={coach ? 'Workout template' : 'My workout'} title={w.name || 'Untitled workout'} sub={editable ? undefined : 'Read only'} />
      <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="card stack">
          <label className="field">Name<input value={w.name} onChange={e => upd({ name: e.target.value })} /></label>
          <label className="field">Description<textarea rows={2} value={w.description} onChange={e => upd({ description: e.target.value })} placeholder="What is this session for?" /></label>
          <div className="inline-inputs">
            <label className="field">Format
              <select value={w.format} onChange={e => upd({ format: e.target.value as WorkoutFormat })}>
                {(Object.keys(FORMAT_LABEL) as WorkoutFormat[]).map(f => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
              </select>
            </label>
            <label className="field">Minutes<input type="number" inputMode="numeric" min="1" value={w.duration_min ?? ''} onChange={e => upd({ duration_min: num(e.target.value) })} /></label>
            {w.format !== 'standard' && <label className="field">Rounds<input type="number" inputMode="numeric" min="1" value={w.rounds ?? ''} onChange={e => upd({ rounds: num(e.target.value) })} /></label>}
          </div>
        </div>

        <div className="section-title"><h2>Exercises</h2><span className="mute small">{rows.length} added</span></div>
        {rows.length === 0 && <div className="card"><Empty icon="train" title="No exercises yet">Add exercises from the library of 100+ moves or type your own.</Empty></div>}
        {rows.map((r, i) => (
          <div key={r.id} className="card" style={r.group_label ? { borderLeft: '3px solid var(--violet)' } : undefined}>
            <div className="row between nowrap" style={{ marginBottom: 8 }}>
              <b className="grow truncate">{i + 1}. {r.exercise_name}</b>
              <button type="button" className="icon sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><Icon name="up" size={16} /></button>
              <button type="button" className="icon sm" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down"><Icon name="down" size={16} /></button>
              <button type="button" className="icon sm" onClick={() => drop(i)} aria-label={`Remove ${r.exercise_name}`}><Icon name="trash" size={16} /></button>
            </div>
            <div className="inline-inputs">
              <label className="field">Sets<input type="number" inputMode="numeric" min="1" value={r.sets ?? ''} onChange={e => updRow(i, { sets: num(e.target.value) })} /></label>
              <label className="field">Reps<input value={r.reps} onChange={e => updRow(i, { reps: e.target.value })} placeholder="10 or 30 s" /></label>
              <label className="field">%1RM<input type="number" inputMode="decimal" min="1" max="150" value={r.percent_1rm ?? ''} onChange={e => updRow(i, { percent_1rm: num(e.target.value) })} /></label>
              <label className="field">Load<input value={r.load} onChange={e => updRow(i, { load: e.target.value })} placeholder="e.g. RPE 8" /></label>
              <label className="field">Rest (s)<input type="number" inputMode="numeric" min="0" step="15" value={r.rest_sec ?? ''} onChange={e => updRow(i, { rest_sec: num(e.target.value) })} /></label>
              <label className="field">Tempo<input value={r.tempo} onChange={e => updRow(i, { tempo: e.target.value })} placeholder="3-1-1" /></label>
              <label className="field">Group
                <select value={r.group_label} onChange={e => updRow(i, { group_label: e.target.value })}>
                  {LABELS.map(l => <option key={l} value={l}>{l || 'None'}</option>)}
                </select>
              </label>
            </div>
            <input style={{ marginTop: 8 }} placeholder="Coaching notes" value={r.notes} onChange={e => updRow(i, { notes: e.target.value })} />
          </div>
        ))}
        {editable && <button type="button" className="soft block" onClick={() => setPicker(true)}><Icon name="plus" size={18} />Add exercise</button>}
      </fieldset>

      {editable && (
        <div className="row" style={{ marginTop: 16 }}>
          <button className="grow" style={{ minHeight: 52 }} onClick={save} disabled={busy || !dirty}>{busy ? 'Saving...' : dirty ? 'Save workout' : 'Saved'}</button>
        </div>
      )}
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={add} />
    </>
  )
}
