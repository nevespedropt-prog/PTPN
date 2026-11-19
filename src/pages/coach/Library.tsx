import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { safeUrl, demoUrl } from '../../lib/util'
import { useAuth } from '../../auth'
import { useClients, usePageTab } from '../../hooks'
import { FORMAT_LABEL } from '../../lib/training'
import type { Category, Exercise, Program, Workout } from '../../types'
import { Empty, PageHead, Seg, Sheet, Skeleton } from '../../components/ui'
import Icon from '../../components/Icon'
import DemoLink from '../../components/DemoLink'
import { EQUIPMENT_TILES, MACHINE_KINDS, equipmentGroups, groupByMuscle, machineKinds, searchExercises } from '../../lib/exerciseSearch'
import type { EquipmentTile, MachineKind } from '../../lib/exerciseSearch'
import { DidYouMean, MuscleTag } from '../../components/ExerciseBits'
import { useExercises } from '../../components/Pickers'
import { AssignWorkout } from './Assign'

const CATS: Category[] = ['strength', 'cardio', 'mobility', 'plyometric', 'core']

function useLibraryReturn(tab: string) {
  const { pathname, search } = useLocation()
  const nav = useNavigate()
  const params = new URLSearchParams(search)
  params.set('tab', tab)
  const base = pathname + '?' + params.toString()
  const open = (to: string) => {
    const back = new URLSearchParams(params)
    back.set('scrollY', String(Math.round(window.scrollY)))
    const state = { returnTo: pathname + '?' + back.toString() }
    nav(`${to}?returnTo=${encodeURIComponent(state.returnTo)}`, { state })
  }
  return { returnTo: base, open }
}

function useRestoreLibraryScroll(ready: boolean) {
  const { search } = useLocation()
  useEffect(() => {
    if (!ready) return
    const y = Number(new URLSearchParams(search).get('scrollY'))
    if (!Number.isFinite(y) || y <= 0) return
    const frame = requestAnimationFrame(() => window.scrollTo({ top: y }))
    return () => cancelAnimationFrame(frame)
  }, [ready, search])
}

function Workouts() {
  const returnState = useLibraryReturn('workouts')
  const { profile } = useAuth()
  const { clients } = useClients()
  const [rows, setRows] = useState<Workout[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [search, setSearch] = useSearchParams()
  const q = search.get('workoutQ') ?? ''
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
  useRestoreLibraryScroll(rows !== null)

  async function create() {
    setBusy(true)
    const { data, error } = await supabase.from('workouts').insert({ name: 'New workout', created_by: profile!.id }).select().single()
    setBusy(false)
    if (error) return alert(error.message)
    returnState.open(`/library/workouts/${data.id}`)
  }
  async function duplicate(w: Workout) {
    setBusy(true)
    const { data: copy, error } = await supabase.from('workouts').insert({ name: `${w.name} (copy)`, description: w.description, format: w.format, duration_min: w.duration_min, rounds: w.rounds, created_by: profile!.id }).select().single()
    if (error) { setBusy(false); return alert(error.message) }
    const { data: items } = await supabase.from('workout_items').select('*').eq('workout_id', w.id)
    if (items?.length) await supabase.from('workout_items').insert(items.map(({ id: _id, workout_id: _w, ...r }) => ({ ...r, workout_id: copy.id })))
    setBusy(false); returnState.open(`/library/workouts/${copy.id}`)
  }
  async function remove(w: Workout) {
    if (!confirm(`Delete "${w.name}"? Scheduled sessions using it will be removed too.`)) return
    await supabase.from('workouts').delete().eq('id', w.id); load()
  }

  const list = (rows ?? []).filter(w => w.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="row nowrap"><input placeholder="Search workouts" value={q} onChange={e => setSearch(previous => { const next = new URLSearchParams(previous); if (e.target.value) next.set('workoutQ', e.target.value); else next.delete('workoutQ'); return next }, { replace: true })} /><button className="sm" style={{ flex: 'none' }} onClick={create} disabled={busy}><Icon name="plus" size={16} />New</button></div>
      {!rows && <Skeleton n={4} />}
      <div className="g-auto">
        {list.map(w => (
          <div key={w.id} className="card">
            <div className="row between nowrap" style={{ marginBottom: 6 }}>
              <span className="badge">{FORMAT_LABEL[w.format]}</span>
              <span className={'badge ' + (w.created_by ? 'violet' : 'blue')}>{w.created_by ? 'Yours' : 'Template'}</span>
            </div>
            <Link to={`/library/workouts/${w.id}?returnTo=${encodeURIComponent(returnState.returnTo)}`} onClick={e => { e.preventDefault(); returnState.open(`/library/workouts/${w.id}`) }}><b style={{ color: 'var(--ink)', fontSize: '1.05rem' }}>{w.name}</b></Link>
            <p className="mute small" style={{ margin: '4px 0 12px' }}>{counts[w.id] ?? 0} exercises{w.duration_min ? ` · ${w.duration_min} min` : ''}</p>
            <div className="row" style={{ marginBottom: 0 }}>
              <button className="sm" onClick={() => setAssign(w)}>Assign</button>
              <Link className="btn soft sm" to={`/library/workouts/${w.id}?returnTo=${encodeURIComponent(returnState.returnTo)}`} onClick={e => { e.preventDefault(); returnState.open(`/library/workouts/${w.id}`) }}>{w.created_by ? 'Edit' : 'View'}</Link>
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
  const returnState = useLibraryReturn('programs')
  const { profile } = useAuth()
  const [rows, setRows] = useState<Program[] | null>(null)
  const load = useCallback(async () => { const { data } = await supabase.from('programs').select('*').order('name'); setRows((data ?? []) as Program[]) }, [])
  useEffect(() => { load() }, [load])
  useRestoreLibraryScroll(rows !== null)

  async function create() {
    const { data, error } = await supabase.from('programs').insert({ name: 'New programme', created_by: profile!.id }).select().single()
    if (error) return alert(error.message)
    returnState.open(`/library/programs/${data.id}`)
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
            <Link to={`/library/programs/${p.id}?returnTo=${encodeURIComponent(returnState.returnTo)}`} onClick={e => { e.preventDefault(); returnState.open(`/library/programs/${p.id}`) }}><b style={{ color: 'var(--ink)', fontSize: '1.05rem' }}>{p.name}</b></Link>
            <p className="mute small" style={{ margin: '4px 0 12px' }}>{p.description}</p>
            <div className="row" style={{ marginBottom: 0 }}>
              <Link className="btn sm" to={`/library/programs/${p.id}?returnTo=${encodeURIComponent(returnState.returnTo)}`} onClick={e => { e.preventDefault(); returnState.open(`/library/programs/${p.id}`) }}>{p.created_by ? 'Edit and assign' : 'View and assign'}</Link>
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
  const [search, setSearch] = useSearchParams()
  const q = search.get('exerciseQ') ?? ''
  const requestedCat = search.get('category')
  const cat: Category | 'all' = requestedCat && CATS.includes(requestedCat as Category) ? requestedCat as Category : 'all'
  const equip = EQUIPMENT_TILES.find(t => t === search.get('equip')) ?? null
  const muscleParam = search.get('muscle')
  const kind = MACHINE_KINDS.find(k => k === search.get('kind')) ?? null
  const muscles = useMemo(() => [...new Set((rows ?? []).map(r => r.muscle))].sort(), [rows])
  const muscle = muscleParam && muscles.includes(muscleParam) ? muscleParam : null
  // Typing replaces the history entry; picking equipment or a muscle adds one, so Back returns to the previous view.
  const updateFilters = (patch: { q?: string; cat?: Category | 'all'; equip?: EquipmentTile | null; muscle?: string | null; kind?: MachineKind | null }) => setSearch(previous => {
    const next = new URLSearchParams(previous)
    if (patch.q !== undefined) { if (patch.q) next.set('exerciseQ', patch.q); else next.delete('exerciseQ') }
    if (patch.cat !== undefined) { if (patch.cat === 'all') next.delete('category'); else next.set('category', patch.cat) }
    if (patch.equip !== undefined) { if (patch.equip) next.set('equip', patch.equip); else next.delete('equip'); if (patch.equip !== 'Machines') next.delete('kind') }
    if (patch.muscle !== undefined) { if (patch.muscle) next.set('muscle', patch.muscle); else next.delete('muscle') }
    if (patch.kind !== undefined) { if (patch.kind) next.set('kind', patch.kind); else next.delete('kind') }
    return next
  }, { replace: patch.q !== undefined || patch.cat !== undefined })
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<Exercise | null>(null)
  const [f, setF] = useState({ name: '', muscle: '', equipment: '', category: 'strength' as Category, instructions: '', video_url: '' })
  const [err, setErr] = useState('')
  const inCat = useMemo(() => (rows ?? []).filter(e => cat === 'all' || e.category === cat), [rows, cat])
  const matches = (e: Exercise, skip?: 'equip' | 'muscle') =>
    (skip === 'equip' || !equip || (equipmentGroups(e.equipment).includes(equip) && (equip !== 'Machines' || !kind || machineKinds(e.equipment).includes(kind)))) &&
    (skip === 'muscle' || !muscle || e.muscle === muscle)
  const list = useMemo(() => searchExercises(inCat.filter(e => matches(e)), q), [inCat, q, equip, muscle, kind]) // eslint-disable-line react-hooks/exhaustive-deps
  const equipCount = (t: EquipmentTile) => inCat.filter(e => matches(e, 'equip') && equipmentGroups(e.equipment).includes(t)).length
  const muscleCount = (m: string) => inCat.filter(e => matches(e, 'muscle') && e.muscle === m).length
  const browsing = !q && !equip && !muscle
  const groups = q && !muscle ? groupByMuscle(list) : []

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (f.video_url.trim() && !safeUrl(f.video_url)) return setErr('The demo video link must start with http:// or https://')
    const { error } = await supabase.from('exercises').insert({ ...f, video_url: f.video_url.trim() ? safeUrl(f.video_url) : '', name: f.name.trim(), created_by: profile!.id })
    if (error) return setErr(error.message)
    setAdding(false); setF({ name: '', muscle: '', equipment: '', category: 'strength', instructions: '', video_url: '' }); reload()
  }
  async function remove(x: Exercise) { if (confirm(`Delete "${x.name}"?`)) { await supabase.from('exercises').delete().eq('id', x.id); setOpen(null); reload() } }

  const row = (x: Exercise) => (
    <div key={x.id} className="exrow">
      <button className="item" onClick={() => setOpen(x)}>
        <span className="grow"><span className="title">{x.name}</span> {x.created_by && <span className="badge violet">Custom</span>}<br /><span className="meta"><MuscleTag muscle={x.muscle} /> {x.equipment}</span></span>
        <span className="badge" style={{ textTransform: 'capitalize' }}>{x.category}</span>
      </button>
      <DemoLink name={x.name} url={x.video_url} />
    </div>
  )
  const tile = (label: string, count: number, onClick: () => void) => (
    <button key={label} className="eq-tile" onClick={onClick} disabled={count === 0} style={count === 0 ? { opacity: .45 } : undefined}>
      <span className="name">{label}</span><span className="count">{count} exercise{count === 1 ? '' : 's'}</span>
    </button>
  )

  return (
    <>
      <div className="row nowrap"><input placeholder={`Search ${rows?.length ?? ''} exercises`} value={q} onChange={e => updateFilters({ q: e.target.value })} /><button className="sm" style={{ flex: 'none' }} onClick={() => setAdding(true)}><Icon name="plus" size={16} />Custom</button></div>
      <div className="chips">
        <button className={'chip' + (cat === 'all' ? ' on' : '')} onClick={() => updateFilters({ cat: 'all' })}>All</button>
        {CATS.map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => updateFilters({ cat: c })} style={{ textTransform: 'capitalize' }}>{c}</button>)}
      </div>
      {!rows && <Skeleton n={4} />}
      {rows && browsing && <>
        <div className="eq-label">Equipment</div>
        <div className="eq-grid">{EQUIPMENT_TILES.map(t => tile(t, equipCount(t), () => updateFilters({ equip: t })))}</div>
        <div className="eq-label">Muscle group</div>
        <div className="eq-grid">{muscles.map(m => tile(m, muscleCount(m), () => updateFilters({ muscle: m })))}</div>
      </>}
      {rows && !browsing && <>
        {(equip || muscle) && <div className="row nowrap" style={{ alignItems: 'center', marginBottom: 8 }}>
          <button className="btn icon" aria-label="Back to all exercises" onClick={() => updateFilters({ equip: null, muscle: null })}><Icon name="back" size={18} /></button>
          <span className="title grow">{[equip, muscle].filter(Boolean).join(' · ')}</span><span className="meta">{list.length}</span>
        </div>}
        <div className="chips" aria-label="Equipment">
          <button className={'chip' + (!equip ? ' on' : '')} onClick={() => updateFilters({ equip: null })}>Any equipment</button>
          {EQUIPMENT_TILES.filter(t => equipCount(t) > 0).map(t => <button key={t} className={'chip' + (equip === t ? ' on' : '')} onClick={() => updateFilters({ equip: t })}>{t} {equipCount(t)}</button>)}
        </div>
        {equip === 'Machines' && <div className="chips" aria-label="Machine type">
          <button className={'chip' + (!kind ? ' on' : '')} onClick={() => updateFilters({ kind: null })}>All machines</button>
          {MACHINE_KINDS.map(k => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => updateFilters({ kind: k })}>{k === 'Machine' ? 'Gym machines' : k === 'Cable' ? 'Cables' : 'Smith machine'}</button>)}
        </div>}
        <div className="chips" aria-label="Muscle group">
          <button className={'chip' + (!muscle ? ' on' : '')} onClick={() => updateFilters({ muscle: null })}>Any muscle</button>
          {muscles.filter(m => muscleCount(m) > 0).map(m => <button key={m} className={'chip' + (muscle === m ? ' on' : '')} onClick={() => updateFilters({ muscle: m })}>{m} {muscleCount(m)}</button>)}
        </div>
        {list.length === 0 && q && <DidYouMean rows={inCat} query={q} onPick={name => updateFilters({ q: name, equip: null, muscle: null })} />}
        {list.length === 0 && !q && <Empty icon="search" title="No exercises here yet" />}
        {list.length > 0 && groups.length > 1
          ? groups.map(g => <div key={g.muscle}><div className="ex-group"><span>{g.muscle}</span><span className="meta">{g.rows.length}</span></div><div className="card tight"><div className="list">{g.rows.map(row)}</div></div></div>)
          : list.length > 0 && <div className="card tight"><div className="list">{list.slice(0, 2000).map(row)}</div></div>}
      </>}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open && <div className="stack">
          <div className="row" style={{ marginBottom: 0 }}><MuscleTag muscle={open.muscle} /><span className="badge">{open.equipment}</span><span className="badge" style={{ textTransform: 'capitalize' }}>{open.category}</span></div>
          <p style={{ margin: 0 }}>{open.instructions || 'No instructions yet.'}</p>
          <a className="btn soft" href={demoUrl(open.name, open.video_url)} target="_blank" rel="noopener noreferrer"><Icon name="play" size={16} />Watch a demo</a>
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
  const [tab, setTab] = usePageTab('library', ['workouts', 'programs', 'exercises'] as const, 'workouts')
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


