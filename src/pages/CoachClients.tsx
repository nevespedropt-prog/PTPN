import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { OneRepMax, Profile, Programme, ProgrammeExercise } from '../types'
import { ProgrammeView } from './MyProgramme'
import Progress from './Progress'
import CoachHabits from './CoachHabits'

export default function CoachClients() {
  const [clients, setClients] = useState<Profile[]>([])
  const [sel, setSel] = useState<Profile | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'client').order('full_name')
    setClients((data ?? []) as Profile[])
  }, [])
  useEffect(() => { load() }, [load])

  if (sel) return <ClientDetail client={sel} back={() => setSel(null)} />
  return (
    <>
      <h1>Clients</h1>
      <AddClient done={load} />
      {clients.length === 0 && <p className="mute">No clients yet. Add one above, or they appear here after signing up.</p>}
      {clients.map(c => (
        <div key={c.id} className="card row" style={{ justifyContent: 'space-between' }}>
          <b>{c.full_name || 'Unnamed'}</b><button onClick={() => setSel(c)}>Open</button>
        </div>
      ))}
    </>
  )
}

function AddClient({ done }: { done: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setCreated(null); setBusy(true)
    const { data, error } = await supabase.functions.invoke('create-client', { body: { email, password, full_name: name } })
    setBusy(false)
    if (error || data?.error) {
      let msg = data?.error ?? error?.message ?? 'Could not add client'
      const res = (error as { context?: Response } | null)?.context
      if (res && typeof res.json === 'function') msg = (await res.json().catch(() => null))?.error ?? msg
      return setErr(msg)
    }
    setCreated({ email, password })
    setName(''); setEmail(''); setPassword(''); done()
  }

  return (
    <form className="card row" onSubmit={add}>
      <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input placeholder="Temp password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
      <button disabled={busy}>{busy ? 'Adding...' : 'Add client'}</button>
      {err && <span className="err">{err}</span>}
      {created && <span className="mute">Added. Send them: {created.email} / {created.password}</span>}
    </form>
  )
}

function ClientDetail({ client, back }: { client: Profile; back: () => void }) {
  const [progs, setProgs] = useState<Programme[]>([])
  const [exs, setExs] = useState<ProgrammeExercise[]>([])
  const [maxes, setMaxes] = useState<OneRepMax[]>([])
  const [tab, setTab] = useState<'prog' | 'progress' | 'habits'>('prog')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data: p } = await supabase.from('programmes').select('*').eq('client_id', client.id).order('created_at', { ascending: false })
    const list = (p ?? []) as Programme[]
    setProgs(list)
    const { data: mx } = await supabase.from('one_rep_maxes').select('*').eq('client_id', client.id).order('date', { ascending: false }).order('created_at', { ascending: false })
    setMaxes((mx ?? []) as OneRepMax[])
    if (list.length) {
      const { data: e } = await supabase.from('programme_exercises').select('*').in('programme_id', list.map(x => x.id))
      setExs((e ?? []) as ProgrammeExercise[])
    } else setExs([])
  }, [client.id])
  useEffect(() => { load() }, [load, tab])

  async function addProgramme(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('programmes').insert({ client_id: client.id, name })
    if (error) return setErr(error.message)
    setName(''); load()
  }
  async function toggle(p: Programme) { await supabase.from('programmes').update({ active: !p.active }).eq('id', p.id); load() }

  return (
    <>
      <button className="ghost" onClick={back}>Back</button>
      <h1 style={{ marginTop: 12 }}>{client.full_name || 'Unnamed'}</h1>
      <div className="row">
        <button className={tab === 'prog' ? '' : 'ghost'} onClick={() => setTab('prog')}>Programmes</button>
        <button className={tab === 'progress' ? '' : 'ghost'} onClick={() => setTab('progress')}>Progress</button>
        <button className={tab === 'habits' ? '' : 'ghost'} onClick={() => setTab('habits')}>Habits</button>
      </div>
      {tab === 'habits' ? <CoachHabits clientId={client.id} /> : tab === 'progress' ? <Progress clientId={client.id} readOnly /> : (
        <>
          <form className="card row" onSubmit={addProgramme}>
            <input placeholder="New programme name" value={name} onChange={e => setName(e.target.value)} required />
            <button>Create</button>{err && <span className="err">{err}</span>}
          </form>
          {progs.map(p => (
            <div key={p.id}>
              <ProgrammeView programme={p} exercises={exs.filter(x => x.programme_id === p.id)} maxes={maxes} />
              <div className="row">
                <AddExercise programmeId={p.id} count={exs.filter(x => x.programme_id === p.id).length} done={load} />
                <button className="ghost" onClick={() => toggle(p)}>{p.active ? 'Archive' : 'Reactivate'}</button>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  )
}

function AddExercise({ programmeId, count, done }: { programmeId: string; count: number; done: () => void }) {
  const [day, setDay] = useState('Day 1')
  const [ex, setEx] = useState('')
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [pct, setPct] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('programme_exercises').insert({
      programme_id: programmeId, day_label: day, exercise: ex, sets: sets ? Number(sets) : null, reps: reps || null, percent_1rm: pct ? Number(pct) : null, sort: count,
    })
    setEx(''); setSets(''); setReps(''); setPct(''); done()
  }
  return (
    <form className="row" onSubmit={add}>
      <input value={day} onChange={e => setDay(e.target.value)} style={{ width: 80 }} aria-label="Day" />
      <input placeholder="Exercise" value={ex} onChange={e => setEx(e.target.value)} required />
      <input type="number" placeholder="Sets" value={sets} onChange={e => setSets(e.target.value)} style={{ width: 70 }} />
      <input placeholder="Reps" value={reps} onChange={e => setReps(e.target.value)} style={{ width: 80 }} />
      <input type="number" inputMode="decimal" step="any" min="1" max="150" placeholder="%1RM" value={pct} onChange={e => setPct(e.target.value)} style={{ width: 84 }} aria-label="Percent of one-rep max" />
      <button>Add</button>
    </form>
  )
}
