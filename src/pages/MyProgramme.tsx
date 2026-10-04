import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Programme, ProgrammeExercise } from '../types'

export function ProgrammeView({ programme, exercises }: { programme: Programme; exercises: ProgrammeExercise[] }) {
  const days = [...new Set(exercises.map(x => x.day_label))]
  return (
    <div className="card">
      <h2>{programme.name}</h2>
      {programme.notes && <p className="mute">{programme.notes}</p>}
      {days.length === 0 && <p className="mute">No exercises yet.</p>}
      {days.map(d => (
        <div key={d}>
          <b>{d}</b>
          <table><tbody>
            {exercises.filter(x => x.day_label === d).sort((a, b) => a.sort - b.sort).map(x => (
              <tr key={x.id}><td>{x.exercise}</td><td>{x.sets ?? ''}{x.reps ? ` x ${x.reps}` : ''}</td><td className="mute">{x.notes}</td></tr>
            ))}
          </tbody></table>
        </div>
      ))}
    </div>
  )
}

export default function MyProgramme() {
  const [progs, setProgs] = useState<Programme[]>([])
  const [exs, setExs] = useState<ProgrammeExercise[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from('programmes').select('*').eq('active', true).order('created_at', { ascending: false })
      const list = (p ?? []) as Programme[]
      setProgs(list)
      if (list.length) {
        const { data: e } = await supabase.from('programme_exercises').select('*').in('programme_id', list.map(x => x.id))
        setExs((e ?? []) as ProgrammeExercise[])
      }
      setLoaded(true)
    })()
  }, [])

  return (
    <>
      <h1>My programme</h1>
      {loaded && progs.length === 0 && <p className="mute">Your coach has not assigned a programme yet.</p>}
      {progs.map(p => <ProgrammeView key={p.id} programme={p} exercises={exs.filter(x => x.programme_id === p.id)} />)}
    </>
  )
}
