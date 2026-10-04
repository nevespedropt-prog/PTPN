import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { addDays, localDate, weekday } from '../../lib/dates'
import type { Profile, Program, ProgramDay, Workout } from '../../types'

function Clients({ clients, picked, setPicked }: { clients: Profile[]; picked: string[]; setPicked: (v: string[]) => void }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <b>Clients</b>
      {clients.length === 0 && <span className="mute">Add a client first.</span>}
      {clients.map(c => (
        <label key={c.id} className="row small" style={{ marginBottom: 0, gap: 10 }}>
          <input type="checkbox" checked={picked.includes(c.id)} onChange={e => setPicked(e.target.checked ? [...picked, c.id] : picked.filter(x => x !== c.id))} />
          {c.full_name || 'Unnamed'}
        </label>
      ))}
    </div>
  )
}

/** Schedule one workout for one or more clients on a date, optionally repeating on chosen weekdays. */
export function AssignWorkout({ workout, clients, onClose, presetClient }: { workout: Workout; clients: Profile[]; onClose: () => void; presetClient?: string }) {
  const [picked, setPicked] = useState<string[]>(presetClient ? [presetClient] : [])
  const [date, setDate] = useState(localDate())
  const [repeat, setRepeat] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function go() {
    setBusy(true); setMsg('')
    const rows = picked.flatMap(client_id => Array.from({ length: repeat + 1 }, (_, i) => ({ client_id, workout_id: workout.id, date: addDays(date, i * 7) })))
    const { error } = await supabase.from('client_workouts').insert(rows)
    setBusy(false)
    if (error) return setMsg(error.message)
    setMsg(`Scheduled ${rows.length} session${rows.length === 1 ? '' : 's'}.`)
    setTimeout(onClose, 900)
  }
  return (
    <div className="stack">
      {!presetClient && <Clients clients={clients} picked={picked} setPicked={setPicked} />}
      <label className="field">Date<input type="date" value={date} onChange={e => setDate(e.target.value)} required /></label>
      <label className="field">Repeat weekly for
        <select value={repeat} onChange={e => setRepeat(Number(e.target.value))}>
          <option value={0}>Just this date</option>
          {[1, 3, 5, 7, 11].map(n => <option key={n} value={n}>{n + 1} weeks</option>)}
        </select>
      </label>
      <button disabled={busy || picked.length === 0} onClick={go}>{busy ? 'Scheduling...' : 'Schedule'}</button>
      {msg && <span className={msg.startsWith('Scheduled') ? 'ok' : 'err'}>{msg}</span>}
    </div>
  )
}

/** Expand a programme into dated sessions: week 1 starts on the first Monday on or after the chosen date's week. */
export function AssignProgram({ program, days, clients, onClose, presetClient }: { program: Program; days: ProgramDay[]; clients: Profile[]; onClose: () => void; presetClient?: string }) {
  const [picked, setPicked] = useState<string[]>(presetClient ? [presetClient] : [])
  const [start, setStart] = useState(localDate())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function go() {
    setBusy(true); setMsg('')
    const monday = addDays(start, 1 - weekday(start))
    const rows = picked.flatMap(client_id => days.map(d => ({
      client_id, workout_id: d.workout_id, program_id: program.id, date: addDays(monday, (d.week - 1) * 7 + (d.day - 1)),
    }))).filter(r => r.date >= start)
    if (rows.length === 0) { setBusy(false); return setMsg('This programme has no workouts scheduled yet.') }
    const { error } = await supabase.from('client_workouts').insert(rows)
    setBusy(false)
    if (error) return setMsg(error.message)
    setMsg(`Scheduled ${rows.length} workouts across ${program.weeks} weeks.`)
    setTimeout(onClose, 1100)
  }
  return (
    <div className="stack">
      {!presetClient && <Clients clients={clients} picked={picked} setPicked={setPicked} />}
      <label className="field">Start date<input type="date" value={start} onChange={e => setStart(e.target.value)} required /></label>
      <p className="mute small" style={{ margin: 0 }}>Week 1 runs Monday to Sunday of the week you pick. Days before the start date are skipped.</p>
      <button disabled={busy || picked.length === 0} onClick={go}>{busy ? 'Scheduling...' : 'Assign programme'}</button>
      {msg && <span className={msg.startsWith('Scheduled') ? 'ok' : 'err'}>{msg}</span>}
    </div>
  )
}
