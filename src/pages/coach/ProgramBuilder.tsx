import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { useClients } from '../../hooks'
import { DAY_NAMES } from '../../lib/dates'
import type { Program, ProgramDay, Workout } from '../../types'
import { Empty, PageHead, Sheet, Skeleton } from '../../components/ui'
import Icon from '../../components/Icon'
import { WorkoutPicker } from '../../components/Pickers'
import { AssignProgram } from './Assign'

export default function ProgramBuilder() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { clients } = useClients()
  const [p, setP] = useState<Program | null | undefined>(undefined)
  const [days, setDays] = useState<ProgramDay[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [week, setWeek] = useState(1)
  const [pickFor, setPickFor] = useState<number | null>(null)
  const [assign, setAssign] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    const [a, b] = await Promise.all([supabase.from('programs').select('*').eq('id', id).maybeSingle(), supabase.from('program_days').select('*').eq('program_id', id)])
    setP(a.data as Program | null)
    const list = (b.data ?? []) as ProgramDay[]
    setDays(list)
    const ids = [...new Set(list.map(d => d.workout_id))]
    if (ids.length) {
      const { data } = await supabase.from('workouts').select('id, name').in('id', ids)
      setNames(Object.fromEntries(((data ?? []) as Workout[]).map(w => [w.id, w.name])))
    }
  }, [id])
  useEffect(() => { load() }, [load])

  if (p === undefined) return <Skeleton n={3} />
  if (!p) return <div className="card"><Empty icon="train" title="Programme not found"><Link to="/library">Back to library</Link></Empty></div>
  const editable = p.created_by === profile?.id

  async function saveMeta(patch: Partial<Program>) {
    const next = { ...p!, ...patch }; setP(next)
    const { error } = await supabase.from('programs').update({ name: next.name || 'Untitled', description: next.description, goal: next.goal, level: next.level, weeks: next.weeks }).eq('id', next.id)
    setMsg(error ? error.message : 'Saved')
    if (patch.weeks && week > patch.weeks) setWeek(patch.weeks)
  }
  async function addDay(day: number, w: Workout) {
    setPickFor(null)
    const { error } = await supabase.from('program_days').insert({ program_id: p!.id, week, day, workout_id: w.id })
    if (error && !error.message.includes('duplicate')) return setMsg(error.message)
    setNames(n => ({ ...n, [w.id]: w.name })); load()
  }
  async function removeDay(d: ProgramDay) { await supabase.from('program_days').delete().eq('id', d.id); load() }
  async function copyToAll() {
    if (!confirm(`Copy week ${week} to every other week? This replaces their current content.`)) return
    const src = days.filter(d => d.week === week)
    await supabase.from('program_days').delete().eq('program_id', p!.id).neq('week', week)
    const rows = []
    for (let w = 1; w <= p!.weeks; w++) if (w !== week) for (const d of src) rows.push({ program_id: p!.id, week: w, day: d.day, workout_id: d.workout_id })
    if (rows.length) await supabase.from('program_days').insert(rows)
    load()
  }

  const total = days.length
  const inWeek = (d: number) => days.filter(x => x.week === week && x.day === d)

  return (
    <>
      <div className="row between" style={{ marginBottom: 6 }}>
        <Link to="/library" className="btn icon" aria-label="Back"><Icon name="back" size={18} /></Link>
        <span className={msg === 'Saved' ? 'ok small' : 'err small'}>{msg}</span>
      </div>
      <PageHead eyebrow="Programme" title={p.name} sub={`${p.weeks} weeks · ${total} scheduled workouts`}>
        <button onClick={() => setAssign(true)}><Icon name="send" size={16} />Assign to client</button>
      </PageHead>

      <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="card stack">
          <label className="field">Name<input value={p.name} onChange={e => setP({ ...p, name: e.target.value })} onBlur={() => saveMeta({})} /></label>
          <label className="field">Description<textarea rows={2} value={p.description} onChange={e => setP({ ...p, description: e.target.value })} onBlur={() => saveMeta({})} /></label>
          <div className="inline-inputs">
            <label className="field">Goal<input value={p.goal} onChange={e => setP({ ...p, goal: e.target.value })} onBlur={() => saveMeta({})} placeholder="Strength" /></label>
            <label className="field">Level<input value={p.level} onChange={e => setP({ ...p, level: e.target.value })} onBlur={() => saveMeta({})} placeholder="Beginner" /></label>
            <label className="field">Weeks<input type="number" min="1" max="52" value={p.weeks} onChange={e => setP({ ...p, weeks: Number(e.target.value) || 1 })} onBlur={() => saveMeta({})} /></label>
          </div>
        </div>
      </fieldset>

      <div className="section-title"><h2>Schedule</h2>{editable && <button className="link" onClick={copyToAll}>Copy this week to all weeks</button>}</div>
      <div className="chips">
        {Array.from({ length: p.weeks }, (_, i) => i + 1).map(w => <button key={w} className={'chip' + (week === w ? ' on' : '')} onClick={() => setWeek(w)}>Week {w}</button>)}
      </div>
      <div className="card">
        {DAY_NAMES.map((dn, i) => {
          const day = i + 1
          const list = inWeek(day)
          return (
            <div key={dn} className="item" style={{ alignItems: 'flex-start' }}>
              <b style={{ width: 42, paddingTop: 6 }}>{dn}</b>
              <div className="grow stack" style={{ gap: 6 }}>
                {list.length === 0 && <span className="mute" style={{ padding: '6px 0' }}>Rest</span>}
                {list.map(d => (
                  <div key={d.id} className="row nowrap" style={{ marginBottom: 0, background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '6px 6px 6px 12px' }}>
                    <Link to={`/library/workouts/${d.workout_id}`} className="grow truncate" style={{ color: 'var(--ink)', fontWeight: 600 }}>{names[d.workout_id] ?? 'Workout'}</Link>
                    {editable && <button className="icon sm" style={{ width: 32, minHeight: 32 }} onClick={() => removeDay(d)} aria-label="Remove workout"><Icon name="x" size={14} /></button>}
                  </div>
                ))}
              </div>
              {editable && <button className="soft sm" onClick={() => setPickFor(day)}><Icon name="plus" size={14} />Add</button>}
            </div>
          )
        })}
      </div>

      <WorkoutPicker open={pickFor !== null} onClose={() => setPickFor(null)} onPick={w => addDay(pickFor!, w)} title={pickFor ? `Add to ${DAY_NAMES[pickFor - 1]}, week ${week}` : ''} />
      <Sheet open={assign} onClose={() => setAssign(false)} title="Assign programme">
        {clients && <AssignProgram program={p} days={days} clients={clients} onClose={() => setAssign(false)} />}
      </Sheet>
    </>
  )
}
