import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import type { WorkoutAlternative, WorkoutFormat, WorkoutItem } from '../types'
import { CARDIO_FIELDS } from '../lib/training'
import { ExercisePicker } from './Pickers'
import { Sheet } from './ui'

type Draft = Omit<WorkoutAlternative, 'id'> & { id?: string }
export default function AlternativeEditor({ item, format, onClose }: { item: WorkoutItem; format: WorkoutFormat; onClose: () => void }) {
  const { profile } = useAuth()
  const [rows, setRows] = useState<WorkoutAlternative[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const writing = useRef(false)
  const [picker, setPicker] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  useEffect(() => {
    let active = true
    setLoading(true); setLoadError('')
    supabase.from('workout_alternatives').select('*').eq('workout_item_id', item.id).order('exercise_name').then(({ data, error: err }) => {
      if (!active) return
      setLoading(false)
      if (err) setLoadError('Could not load approved alternatives. Please retry when connected.')
      else setRows((data ?? []) as WorkoutAlternative[])
    })
    return () => { active = false }
  }, [item.id, retry])
  if (profile?.role !== 'coach') return null
  const set = (patch: Partial<Draft>) => setDraft(draft ? { ...draft, ...patch } : null)
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!draft || writing.current) return
    writing.current = true; setBusy(true); setError('')
    try {
      const value = { ...draft, id: draft.id ?? crypto.randomUUID(), notes: draft.notes.trim(), reps: draft.reps.trim(), cardio_time: draft.cardio_time.trim() }
      const result = await supabase.from('workout_alternatives').upsert(value).select('*').single()
      if (result.error || !result.data) throw new Error('save')
      const saved = result.data as WorkoutAlternative
      setRows(list => [...list.filter(a => a.id !== saved.id), saved].sort((a, b) => a.exercise_name.localeCompare(b.exercise_name)))
      setDraft(null)
    } catch { setError('Could not save this approval. Your prescription is still here. Please retry; the exercise may already be approved.') }
    finally { writing.current = false; setBusy(false) }
  }
  async function remove(row: WorkoutAlternative) {
    if (writing.current || !confirm(`Remove approval for ${row.exercise_name}? Existing session history is preserved.`)) return
    writing.current = true; setBusy(true); setError('')
    try {
      const result = await supabase.from('workout_alternatives').delete().eq('id', row.id).eq('workout_item_id', item.id).select('id')
      if (result.error || !result.data?.length) throw new Error('delete')
      setRows(list => list.filter(a => a.id !== row.id))
    } catch { setError('Could not remove this approval. Please retry when connected.') }
    finally { writing.current = false; setBusy(false) }
  }
  return <>
    <Sheet open onClose={() => { if (!busy) onClose() }} title={'Approved alternatives: ' + item.exercise_name}>
      <div className="stack" style={{ overflowWrap: 'anywhere' }}>
        <p className="mute small">Approvals save separately from the workout. Clients can switch before completing a set. The substitute starts with blank working weights; set its prescription here.</p>
        {loading ? <p role="status">Loading alternatives...</p> : loadError ? <>
          <p className="err" role="alert">{loadError}</p><button className="soft" onClick={() => setRetry(v => v + 1)}>Retry alternatives</button>
        </> : draft ? <form className="stack" onSubmit={save}>
          <h3 style={{ margin: 0 }}>{draft.exercise_name}</h3>
          <fieldset disabled={busy} className="stack" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div className="inline-inputs">
              <label className="field">{draft.is_cardio ? 'Rounds' : 'Sets'}<input aria-label="Alternative sets" type="number" min="1" max="20" required value={draft.sets} onChange={e => set({ sets: Number(e.target.value) })} /></label>
              {!draft.is_cardio && <label className="field">Reps<input aria-label="Alternative reps" maxLength={100} value={draft.reps} onChange={e => set({ reps: e.target.value })} /></label>}
              <label className="field">Rest (seconds)<input aria-label="Alternative rest" type="number" min="0" max="3600" step="1" required value={draft.rest_sec} onChange={e => set({ rest_sec: Number(e.target.value) })} /></label>
              {draft.is_cardio && CARDIO_FIELDS[format].includes('time') && <label className="field">Time<input aria-label="Alternative time" maxLength={40} value={draft.cardio_time} onChange={e => set({ cardio_time: e.target.value })} placeholder="e.g. 10:00" /></label>}
              {draft.is_cardio && CARDIO_FIELDS[format].includes('distance') && <label className="field">Distance (km)<input aria-label="Alternative distance" type="number" min="0.01" step="any" value={draft.cardio_distance_km ?? ''} onChange={e => set({ cardio_distance_km: e.target.value ? Number(e.target.value) : null })} /></label>}
              {draft.is_cardio && CARDIO_FIELDS[format].includes('speed') && <label className="field">Speed (km/h)<input aria-label="Alternative speed" type="number" min="0.01" step="any" value={draft.cardio_speed_kmh ?? ''} onChange={e => set({ cardio_speed_kmh: e.target.value ? Number(e.target.value) : null })} /></label>}
            </div>
            <label className="field">Coaching notes<textarea aria-label="Alternative coaching notes" rows={3} maxLength={1000} value={draft.notes} onChange={e => set({ notes: e.target.value })} /></label>
          </fieldset>
          {error && <p className="err" role="alert">{error}</p>}
          <div className="row"><button type="button" className="soft" disabled={busy} onClick={() => { setDraft(null); setError('') }}>Cancel prescription</button><button disabled={busy}>{busy ? 'Saving...' : 'Save approved alternative'}</button></div>
        </form> : <>
          {rows.length === 0 && <p className="mute">No alternatives approved for this exercise.</p>}
          {rows.map(row => <article key={row.id} className="card tight stack" aria-label={'Approved alternative: ' + row.exercise_name}>
            <b>{row.exercise_name}</b><span className="mute small">{row.sets} {row.is_cardio ? 'rounds' : 'sets'}{row.reps ? ` x ${row.reps}` : ''}. Rest {row.rest_sec}s.</span>
            <div className="row"><button className="soft sm" disabled={busy} onClick={() => { setDraft({ ...row }); setError('') }}>Edit prescription</button><button className="soft sm" disabled={busy} onClick={() => void remove(row)}>Remove approval</button></div>
          </article>)}
          {error && <p className="err" role="alert">{error}</p>}
          <button className="soft" disabled={busy} onClick={() => setPicker(true)}>Choose alternative exercise</button>
        </>}
      </div>
    </Sheet>
    <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={e => {
      setPicker(false); setError('')
      if (!e.id) { setError('Choose an exercise from the library to approve an alternative.'); return }
      if (e.id === item.exercise_id) { setError('Choose a different exercise from the original.'); return }
      const existing = rows.find(row => row.exercise_id === e.id)
      setDraft(existing ? { ...existing } : { workout_item_id: item.id, exercise_id: e.id, exercise_name: e.name, is_cardio: e.category === 'cardio', sets: e.category === 'cardio' ? 1 : item.sets ?? 3, reps: e.category === 'cardio' ? '' : item.reps, rest_sec: e.category === 'cardio' ? 0 : item.rest_sec ?? 90, notes: '', cardio_time: '', cardio_distance_km: null, cardio_speed_kmh: null })
    }} />
  </>
}
