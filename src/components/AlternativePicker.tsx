import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { WorkoutAlternative, WorkoutItem } from '../types'
import { Sheet } from './ui'

export default function AlternativePicker({ item, selectedId, busy, error, uncertain, onChoose, onClose }: {
  item: WorkoutItem; selectedId?: string; busy: boolean; error: string; uncertain: boolean
  onChoose: (alternative: WorkoutAlternative | null) => void; onClose: () => void
}) {
  const [rows, setRows] = useState<WorkoutAlternative[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
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
  return <Sheet open onClose={onClose} title={'Choose an alternative: ' + item.exercise_name}>
    <div className="stack" style={{ overflowWrap: 'anywhere' }}>
      <p className="mute small">Choose only an option approved by your coach. Changing exercise clears unfinished entries in this block. Completed sets cannot be switched.</p>
      {loading ? <p role="status">Loading approved alternatives...</p> : loadError ? <><p className="err" role="alert">{loadError}</p><button className="soft" onClick={() => setRetry(v => v + 1)}>Retry approved alternatives</button></> : <>
        {selectedId && <button className="soft" disabled={busy || uncertain} onClick={() => onChoose(null)}>Use original: {item.exercise_name}</button>}
        {!rows.length && <p className="mute">No alternatives currently approved. Ask your coach if you need another option.</p>}
        {rows.map(row => <button key={row.id} className="item" disabled={busy || uncertain || row.id === selectedId} onClick={() => onChoose(row)}>
          <span className="grow"><b>{row.exercise_name}</b><br /><span className="mute small">{row.sets} {row.is_cardio ? 'rounds' : 'sets'}{row.reps ? ` x ${row.reps}` : ''}. Rest {row.rest_sec}s. {row.id === selectedId ? 'Selected' : 'Working weight starts blank.'}</span></span>
        </button>)}
      </>}
      {busy && <p role="status">Saving exercise choice...</p>}
      {error && <p className="err" role="alert">{error}</p>}
      {uncertain && <button onClick={() => window.location.reload()}>Reload workout</button>}
    </div>
  </Sheet>
}
