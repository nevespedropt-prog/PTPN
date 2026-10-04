import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { OneRepMax, Programme, ProgrammeExercise } from '../types'
import { latestMax, loadKg } from '../lib/oneRepMax'

export function ProgrammeView({ programme, exercises, maxes = [] }: { programme: Programme; exercises: ProgrammeExercise[]; maxes?: OneRepMax[] }) {
  const days = [...new Set(exercises.map(x => x.day_label))]
  return (
    <div className="card">
      <h2>{programme.name}</h2>
      {programme.notes && <p className="mute">{programme.notes}</p>}
      {days.length === 0 && <p className="mute">No exercises yet.</p>}
      {days.map(d => (
        <div key={d}>
          <span className="day">{d}</span>
          <table><tbody>
            {exercises.filter(x => x.day_label === d).sort((a, b) => a.sort - b.sort).map(x => (
              <tr key={x.id}><td>{x.exercise}</td><td>{x.sets ?? ''}{x.reps ? ` x ${x.reps}` : ''}{x.percent_1rm ? ` @ ${Number(x.percent_1rm)}%` : ''}
                {x.percent_1rm ? (() => { const m = latestMax(x.exercise, maxes); return m ? <><br /><b className="load">{loadKg(Number(x.percent_1rm), Number(m.weight_kg))} kg</b></> : <><br /><span className="mute">no max yet</span></> })() : null}</td>
                <td className="mute">{x.notes}</td></tr>
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
  const [maxes, setMaxes] = useState<OneRepMax[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from('programmes').select('*').eq('active', true).order('created_at', { ascending: false })
      const list = (p ?? []) as Programme[]
      setProgs(list)
      const { data: mx } = await supabase.from('one_rep_maxes').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
      setMaxes((mx ?? []) as OneRepMax[])
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
      {progs.map(p => <ProgrammeView key={p.id} programme={p} exercises={exs.filter(x => x.programme_id === p.id)} maxes={maxes} />)}
    </>
  )
}
