import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Exercise, MealType, Recipe, Workout } from '../types'
import { Empty, MacroChips, Sheet, Skeleton } from './ui'
import Icon from './Icon'
import { FORMAT_LABEL } from '../lib/training'
import { MEAL_LABEL, MEALS } from '../lib/nutrition'

const MUSCLES = ['All', 'Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes', 'Biceps', 'Triceps', 'Core', 'Calves', 'Full body', 'Legs', 'Cardio', 'Mobility']

export function useExercises(open = true) {
  const [rows, setRows] = useState<Exercise[] | null>(null)
  useEffect(() => {
    if (!open || rows) return
    supabase.from('exercises').select('*').order('name').then(({ data }) => setRows((data ?? []) as Exercise[]))
  }, [open, rows])
  return { rows, reload: () => setRows(null) }
}

export function ExerciseList({ rows, onPick, query, setQuery, allowCustom }: {
  rows: Exercise[] | null; onPick: (e: { id: string | null; name: string }) => void; query: string; setQuery: (s: string) => void; allowCustom?: boolean
}) {
  const [muscle, setMuscle] = useState('All')
  const list = useMemo(() => (rows ?? []).filter(e =>
    (muscle === 'All' || e.muscle === muscle) && e.name.toLowerCase().includes(query.trim().toLowerCase())), [rows, muscle, query])
  const exact = (rows ?? []).some(e => e.name.toLowerCase() === query.trim().toLowerCase())
  return (
    <>
      <input autoFocus placeholder="Search 100+ exercises" value={query} onChange={e => setQuery(e.target.value)} style={{ marginBottom: 10 }} />
      <div className="chips">{MUSCLES.map(m => <button key={m} type="button" className={'chip' + (muscle === m ? ' on' : '')} onClick={() => setMuscle(m)}>{m}</button>)}</div>
      {!rows && <Skeleton n={4} />}
      {allowCustom && query.trim() && !exact && (
        <button className="item" type="button" onClick={() => onPick({ id: null, name: query.trim() })}>
          <span className="grow"><span className="title">Use "{query.trim()}"</span><br /><span className="meta">Custom exercise name</span></span>
          <Icon name="plus" />
        </button>
      )}
      <div className="list">
        {list.slice(0, 400).map(e => (
          <button key={e.id} className="item" type="button" onClick={() => onPick({ id: e.id, name: e.name })}>
            <span className="grow"><span className="title">{e.name}</span><br /><span className="meta">{e.muscle} · {e.equipment}</span></span>
            <Icon name="plus" />
          </button>
        ))}
      </div>
      {rows && list.length === 0 && !query && <Empty icon="search" title="No exercises in this group" />}
    </>
  )
}

export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: { id: string | null; name: string }) => void }) {
  const { rows } = useExercises(open)
  const [query, setQuery] = useState('')
  return (
    <Sheet open={open} onClose={onClose} title="Add exercise">
      <ExerciseList rows={rows} query={query} setQuery={setQuery} allowCustom onPick={e => { onPick(e); setQuery('') }} />
    </Sheet>
  )
}

export function WorkoutPicker({ open, onClose, onPick, title = 'Choose a workout' }: { open: boolean; onClose: () => void; onPick: (w: Workout) => void; title?: string }) {
  const [rows, setRows] = useState<Workout[] | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    if (!open) return
    supabase.from('workouts').select('*').order('name').then(({ data }) => setRows((data ?? []) as Workout[]))
  }, [open])
  const list = (rows ?? []).filter(w => w.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <input autoFocus placeholder="Search workouts" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      {!rows && <Skeleton n={4} />}
      <div className="list">
        {list.map(w => (
          <button key={w.id} className="item" type="button" onClick={() => onPick(w)}>
            <span className="grow"><span className="title">{w.name}</span><br /><span className="meta">{FORMAT_LABEL[w.format]}{w.duration_min ? ` · ${w.duration_min} min` : ''}{w.created_by ? ' · Custom' : ''}</span></span>
            <Icon name="chev" />
          </button>
        ))}
      </div>
      {rows && !list.length && <Empty icon="train" title="No workouts found" />}
    </Sheet>
  )
}

export function RecipePicker({ open, onClose, onPick, meal }: { open: boolean; onClose: () => void; onPick: (r: Recipe) => void; meal?: MealType }) {
  const [rows, setRows] = useState<Recipe[] | null>(null)
  const [q, setQ] = useState('')
  const [m, setM] = useState<MealType | 'all'>(meal ?? 'all')
  useEffect(() => { if (open) setM(meal ?? 'all') }, [open, meal])
  useEffect(() => {
    if (!open || rows) return
    supabase.from('recipes').select('*').order('name').then(({ data }) => setRows((data ?? []) as Recipe[]))
  }, [open, rows])
  const list = (rows ?? []).filter(r => (m === 'all' || r.meal_type === m) && r.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Sheet open={open} onClose={onClose} title="Choose a recipe">
      <input autoFocus placeholder="Search recipes" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      <div className="chips">
        <button type="button" className={'chip' + (m === 'all' ? ' on' : '')} onClick={() => setM('all')}>All</button>
        {MEALS.map(x => <button key={x} type="button" className={'chip' + (m === x ? ' on' : '')} onClick={() => setM(x)}>{MEAL_LABEL[x]}</button>)}
      </div>
      {!rows && <Skeleton n={4} />}
      <div className="list">
        {list.map(r => (
          <button key={r.id} className="item" type="button" onClick={() => onPick(r)}>
            <span className="grow"><span className="title">{r.name}</span><MacroChips m={r} className="small" /></span>
            <Icon name="plus" />
          </button>
        ))}
      </div>
    </Sheet>
  )
}
