import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/dates'
import { sortMaxes } from '../lib/oneRepMax'
import type { OneRepMax } from '../types'

export default function MaxLifts({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<OneRepMax[]>([])
  const [exercise, setExercise] = useState('')
  const [kg, setKg] = useState('')
  const [date, setDate] = useState(() => localDate())
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('one_rep_maxes').select('*').eq('client_id', clientId)
      .order('date', { ascending: false }).order('created_at', { ascending: false })
    setRows((data ?? []) as OneRepMax[])
  }, [clientId])
  useEffect(() => { load() }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('one_rep_maxes').insert({ client_id: clientId, exercise: exercise.trim(), weight_kg: Number(kg), date })
    if (error) return setErr(error.message)
    setExercise(''); setKg(''); load()
  }
  async function remove(id: string) { await supabase.from('one_rep_maxes').delete().eq('id', id); load() }

  // newest entry per exercise is the "current" max
  const seen = new Set<string>()
  const current = sortMaxes(rows).filter(r => { const k = r.exercise.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })

  return (
    <div className="card">
      <h2>Max lifts (1RM)</h2>
      <p className="mute" style={{ marginTop: -4 }}>Programmes can prescribe a % of these, and the working weight is worked out for you.</p>
      <form className="row" onSubmit={add}>
        <input placeholder="Exercise, e.g. Back squat" value={exercise} onChange={e => setExercise(e.target.value)} required style={{ flexBasis: '100%' }} />
        <input type="number" inputMode="decimal" step="0.5" min="1" placeholder="kg" value={kg} onChange={e => setKg(e.target.value)} required style={{ maxWidth: 100 }} />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{ maxWidth: 170 }} />
        <button>Add</button>
        {err && <span className="err">{err}</span>}
      </form>
      {current.length === 0 && <p className="mute">No max lifts recorded yet.</p>}
      {current.map(r => (
        <div key={r.id} className="lift">
          <span className="grow"><b>{r.exercise}</b><br /><span className="mute">{r.date}</span></span>
          <span className="big">{Number(r.weight_kg)} <small>kg</small></span>
          <button className="link" onClick={() => remove(r.id)} aria-label={`Delete ${r.exercise} max`}>Delete</button>
        </div>
      ))}
    </div>
  )
}
