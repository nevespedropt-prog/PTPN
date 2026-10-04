import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { useClients } from '../../hooks'
import { FORMAT_LABEL } from '../../lib/training'
import type { Category, Exercise, Program, Workout } from '../../types'
import { Empty, PageHead, Seg, Sheet, Skeleton } from '../../components/ui'
import Icon from '../../components/Icon'
import { useExercises } from '../../components/Pickers'
import { AssignWorkout } from './Assign'

const CATS: Category[] = ['strength', 'cardio', 'mobility', 'plyometric', 'core']

function Workouts() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const { clients } = useClients()
  const [rows, setRows] = useState<Workout[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [q, setQ] = useState('')
  const [assign, setAssign] = useState<Workout | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [w, i] = await Promise.all([supabase.from('workouts').select('*').order('name'), supabase.from('workout_items').select('workout_id')])
    setRows((w.data ?? []) as Workout[])
    const c: Record<string, number> = {}
    for (const r of (i.data ?? []) as { workout_id: string }[]) c[r.workout_id] = (c[r.workout_id] ?? 0) + 1
    setCounts(c)
  }, [])
  useEffect(() => { load() }, [load])

  async function create() {
    setBusy(true)
    const { data, error } = await supabase.from('workouts').insert({ name: 'New workout', created_by: profile!.id }).select().single()
    setBusy(false)
    if (error) return alert(error.message)
    nav(`/library/workouts/${data.id}`)
  }
  async function duplicate(w: Workout) {
    setBusy(true)
    const { data: copy, error } = await supabase.from('workouts').insert({ name: `${w.name} (copy)`, description: w.description, format: w.format, duration_min: w.duration_min, rounds: w.rounds, created_by: profile!.id }).select().single()
    if (error) { setBusy(false); return alert(error.message) }
    const { data: items } = await supabase.from('workout_items').select('*').eq('workout_id', w.id)
    if (items?.length) await supabase.from('workout_items').insert(items.map(({ id: _id, workout_id: _w, ...r }) => ({ ...r, workout_id: copy.id })))
    setBusy(false); nav(`/library/workouts/${copy.id}`)
  }
  async function remove(w: Workout) {
    if (!confirm(`Delete "${w.name}"? Scheduled sessions using it will be removed too.`)) return
    await supabase.from('workouts').delete().eq('id', w.id); load()
  }

  const list = (rows ?? []).filter(w => w.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="row nowrap"><input placeholder="Search workouts" value={q} onChange={e => setQ(e.target.value)} /><button className="sm" style={{ flex: 'none' }} onClick={create} disabled={busy}><Icon name="plus" size={16} />New</button></div>
      {!rows && <Skeleton n={4} />}
      <div className="g-auto">
        {list.map(w => (
          <div key={w.id} className="card">
            <div className="row between nowrap" style={{ marginBottom: 6 }}>
              <span className="badge">{FORMAT_LABEL[w.format]}</span>
              <span className={'badge ' + (w.created_by ? 'violet' : 'blue')}>{w.created_by ? 'Yours' : 'Template'}</span>
            </div>
            <Link to={`/library/workouts/${w.id}`}><b style={{ color: 'var(--ink)', fontSize: '1.05rem' }}>{w.name}</b></Link>
            <p className="mute small" style={{ margin: '4px 0 12px' }}>{counts[w.id] ?? 0} exercises{w.duration_min ? ` · ${w.duration_min} min` : ''}</p>
            <div className="row" style={{ marginBottom: 0 }}>
              <button className="sm" onClick={() => setAssign(w)}>Assign</button>
              <Link className="btn soft sm" to={`/library/workouts/${w.id}`}>{w.created_by ? 'Edit' : 'View'}</Link>
              <button className="soft sm" onClick={() => duplicate(w)} aria-label={`Duplicate ${w.name}`}><Icon name="copy" size={15} /></button>
              {w.created_by && <button className="link" onClick={() => remove(w)}>Delete</button>}
            </div>
          </div>
        ))}
      </div>
      {rows && list.length === 0 && <div className="card"><Empty icon="train" title="No workouts found" /></div>}
      <Sheet open={!!assign} onClose={() => setAssign(null)} title={`Assign ${assign?.name ?? ''}`}>{assign && clients && <AssignWorkout workout={assign} clients={clients} onClose={() => setAssign(null)} />}</Sheet>
    </>
  )
}

function Programs() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [rows, setRows] = useState<Program[] | null>(null)
  const load = useCallback(async () => { const { data } = await supabase.from('programs').select('*').order('name'); setRows((data ?? []) as Program[]) }, [])
  useEffect(() => { load() }, [load])

  async function create() {
    const { data, error } = await supabase.from('programs').insert({ name: 'New programme', created_by: profile!.id }).select().single()
    if (error) return alert(error.message)
    nav(`/library/programs/${data.id}`)
  }
  async function remove(p: Program) { if (confirm(`Delete "${p.name}"?`)) { await supabase.from('programs').delete().eq('id', p.id); load() } }

  return (
    <>
      <div className="row between"><span className="mute">Multi-week plans you can assign in one tap</span><button className="sm" onClick={create}><Icon name="plus" size={16} />New</button></div>
      {!rows && <Skeleton n={3} />}
      <div className="g-auto">
        {rows?.map(p => (
          <div key={p.id} className="card">
            <div className="row" style={{ marginBottom: 6 }}>
              {p.goal && <span className="badge red">{p.goal}</span>}{p.level && <span className="badge">{p.level}</span>}<span className="badge">{p.weeks} weeks</span>
            </div>
            <Link to={`/library/programs/${p.id}`}><b style={{ color: 'var(--ink)', fontSize: '1.05rem' }}>{p.name}</b></Link>
            <p className="mute small" style={{ margin: '4px 0 12px' }}>{p.description}</p>
            <div className="row" style={{ marginBottom: 0 }}>
              <Link className="btn sm" to={`/library/programs/${p.id}`}>{p.created_by ? 'Edit and assign' : 'View and assign'}</Link>
              {p.created_by && <button className="link" onClick={() => remove(p)}>Delete</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function Exercises() {
  const { profile } = useAuth()
  const { rows, reload } = useExercises()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<Exercise | null>(null)
  const [f, setF] = useState({ name: '', muscle: '', equipment: '', category: 'strength' as Category, instructions: '', video_url: '' })
  const [err, setErr] = useState('')
  const list = useMemo(() => (rows ?? []).filter(e => (cat === 'all' || e.category === cat) && e.name.toLowerCase().includes(q.toLowerCase())), [rows, q, cat])

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('exercises').insert({ ...f, name: f.name.trim(), created_by: profile!.id })
    if (error) return setErr(error.message)
    setAdding(false); setF({ name: '', muscle: '', equipment: '', category: 'strength', instructions: '', video_url: '' }); reload()
  }
  async function remove(x: Exercise) { if (confirm(`Delete "${x.name}"?`)) { await supabase.from('exercises').delete().eq('id', x.id); setOpen(null); reload() } }

  return (
    <>
      <div className="row nowrap"><input placeholder={`Search ${rows?.length ?? ''} exercises`} value={q} onChange={e => setQ(e.target.value)} /><button className="sm" style={{ flex: 'none' }} onClick={() => setAdding(true)}><Icon name="plus" size={16} />Custom</button></div>
      <div className="chips">
        <button className={'chip' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>All</button>
        {CATS.map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)} style={{ textTransform: 'capitalize' }}>{c}</button>)}
      </div>
      {!rows && <Skeleton n={4} />}
      <div className="card tight"><div className="list">
        {list.slice(0, 150).map(x => (
          <button key={x.id} className="item" onClick={() => setOpen(x)}>
            <span className="grow"><span className="title">{x.name}</span> {x.created_by && <span className="badge violet">Custom</span>}<br /><span className="meta">{x.muscle} · {x.equipment}</span></span>
            <span className="badge" style={{ textTransform: 'capitalize' }}>{x.category}</span>
          </button>
        ))}
      </div></div>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open && <div className="stack">
          <div className="row" style={{ marginBottom: 0 }}><span className="badge red">{open.muscle}</span><span className="badge">{open.equipment}</span><span className="badge" style={{ textTransform: 'capitalize' }}>{open.category}</span></div>
          <p style={{ margin: 0 }}>{open.instructions || 'No instructions yet.'}</p>
          <a className="btn soft" href={open.video_url || `https://www.youtube.com/results?search_query=${encodeURIComponent(open.name + ' exercise form')}`} target="_blank" rel="noopener noreferrer"><Icon name="play" size={16} />Watch a demo</a>
          {open.created_by && <button className="danger" onClick={() => remove(open)}>Delete exercise</button>}
        </div>}
      </Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Custom exercise">
        <form className="stack" onSubmit={add}>
          <input placeholder="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required />
          <div className="inline-inputs">
            <label className="field">Muscle<input value={f.muscle} onChange={e => setF({ ...f, muscle: e.target.value })} placeholder="Chest" /></label>
            <label className="field">Equipment<input value={f.equipment} onChange={e => setF({ ...f, equipment: e.target.value })} placeholder="Dumbbells" /></label>
            <label className="field">Type<select value={f.category} onChange={e => setF({ ...f, category: e.target.value as Category })}>{CATS.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
          </div>
          <textarea rows={3} placeholder="Coaching cues" value={f.instructions} onChange={e => setF({ ...f, instructions: e.target.value })} />
          <input placeholder="Demo video link (optional)" value={f.video_url} onChange={e => setF({ ...f, video_url: e.target.value })} />
          <button>Save exercise</button>{err && <span className="err">{err}</span>}
        </form>
      </Sheet>
    </>
  )
}

export default function Library() {
  const [tab, setTab] = useState<'workouts' | 'programs' | 'exercises'>('workouts')
  return (
    <>
      <PageHead eyebrow="Training" title="Library" sub="Templates, programmes and the exercise library" />
      <Seg value={tab} onChange={setTab} options={[{ value: 'workouts', label: 'Workouts' }, { value: 'programs', label: 'Programmes' }, { value: 'exercises', label: 'Exercises' }]} />
      {tab === 'workouts' && <Workouts />}
      {tab === 'programs' && <Programs />}
      {tab === 'exercises' && <Exercises />}
    </>
  )
}

