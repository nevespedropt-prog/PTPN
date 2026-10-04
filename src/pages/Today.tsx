import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import { localDate } from '../lib/dates'
import type { Checkin, Habit, HabitLog } from '../types'

const MOOD = ['Low', '', '', '', 'Great']

function Scale({ label, value, set, ends }: { label: string; value: number | null; set: (n: number) => void; ends: [string, string] }) {
  return (
    <div>
      <b>{label}</b>
      <div className="scale" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map(n => (
          <button type="button" key={n} className={value === n ? 'on' : ''} aria-pressed={value === n} onClick={() => set(n)}>{n}</button>
        ))}
      </div>
      <div className="scale-ends mute"><span>{ends[0]}</span><span>{ends[1]}</span></div>
    </div>
  )
}

function Habits({ today }: { today: string }) {
  const { profile } = useAuth()
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<Record<string, HabitLog>>({})
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const [h, l] = await Promise.all([
      supabase.from('habits').select('*').eq('active', true).order('sort').order('created_at'),
      supabase.from('habit_logs').select('*').eq('date', today),
    ])
    setHabits((h.data ?? []) as Habit[])
    setLogs(Object.fromEntries(((l.data ?? []) as HabitLog[]).map(x => [x.habit_id, x])))
    setLoaded(true)
  }, [today])
  useEffect(() => { load() }, [load])

  async function toggle(h: Habit) {
    setErr('')
    const existing = logs[h.id]
    const { error } = existing
      ? await supabase.from('habit_logs').delete().eq('id', existing.id)
      : await supabase.from('habit_logs').insert({ habit_id: h.id, client_id: profile!.id, date: today, value: 1 })
    if (error) setErr(error.message)
    load()
  }
  async function saveNumber(h: Habit) {
    setErr('')
    const raw = (draft[h.id] ?? '').trim()
    const existing = logs[h.id]
    if (raw === '') {
      if (existing) await supabase.from('habit_logs').delete().eq('id', existing.id)
    } else {
      const { error } = await supabase.from('habit_logs')
        .upsert({ habit_id: h.id, client_id: profile!.id, date: today, value: Number(raw) }, { onConflict: 'habit_id,date' })
      if (error) setErr(error.message)
    }
    setDraft(d => { const n = { ...d }; delete n[h.id]; return n })
    load()
  }

  const isDone = (h: Habit) => {
    const l = logs[h.id]
    if (!l) return false
    return h.kind === 'number' && h.target ? Number(l.value) >= Number(h.target) : true
  }
  const done = habits.filter(isDone).length

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Habits</h2>
        {habits.length > 0 && <span className="mute">{done} of {habits.length} done</span>}
      </div>
      {habits.length > 0 && <div className="bar" aria-hidden="true"><i style={{ width: `${(done / habits.length) * 100}%` }} /></div>}
      {loaded && habits.length === 0 && <p className="mute">Your coach has not set any habits yet.</p>}
      {habits.map(h => h.kind === 'check' ? (
        <button type="button" key={h.id} className={'habit' + (isDone(h) ? ' done' : '')} onClick={() => toggle(h)} aria-pressed={isDone(h)}>
          <span className="tick" aria-hidden="true">{isDone(h) ? '✓' : ''}</span>{h.name}
        </button>
      ) : (
        <div key={h.id} className={'habit num' + (isDone(h) ? ' done' : '')}>
          <span className="tick" aria-hidden="true">{isDone(h) ? '✓' : ''}</span>
          <span className="grow">{h.name}{h.target ? <span className="mute"> · goal {h.target} {h.unit}</span> : null}</span>
          <input type="number" inputMode="decimal" step="any" min="0" aria-label={h.name}
            value={draft[h.id] ?? (logs[h.id] ? String(logs[h.id].value) : '')} placeholder={h.unit || '0'}
            onChange={e => setDraft(d => ({ ...d, [h.id]: e.target.value }))}
            onBlur={() => draft[h.id] !== undefined && saveNumber(h)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        </div>
      ))}
      {err && <p className="err">{err}</p>}
    </div>
  )
}

function CheckinForm({ today }: { today: string }) {
  const { profile } = useAuth()
  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [sleep, setSleep] = useState('')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('checkins').select('*').eq('date', today).maybeSingle().then(({ data }) => {
      const c = data as Checkin | null
      if (!c) return
      setMood(c.mood); setEnergy(c.energy); setSleep(c.sleep_hours != null ? String(c.sleep_hours) : ''); setNote(c.note); setSaved(true)
    })
  }, [today])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!mood || !energy) return setErr('Pick a mood and an energy level.')
    setBusy(true)
    const { error } = await supabase.from('checkins').upsert(
      { client_id: profile!.id, date: today, mood, energy, sleep_hours: sleep ? Number(sleep) : null, note },
      { onConflict: 'client_id,date' })
    setBusy(false)
    if (error) return setErr(error.message)
    setSaved(true)
  }

  return (
    <form className="card col" onSubmit={save}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 0 }}>
        <h2 style={{ margin: 0 }}>Daily check-in</h2>
        {saved && <span className="ok">Saved today</span>}
      </div>
      <Scale label="Mood" value={mood} set={n => { setMood(n); setSaved(false) }} ends={[MOOD[0], MOOD[4]]} />
      <Scale label="Energy" value={energy} set={n => { setEnergy(n); setSaved(false) }} ends={['Drained', 'Fired up']} />
      <label className="field"><b>Sleep last night (hours)</b>
        <input type="number" inputMode="decimal" step="0.25" min="0" max="24" placeholder="e.g. 7.5" value={sleep} onChange={e => { setSleep(e.target.value); setSaved(false) }} />
      </label>
      <label className="field"><b>Anything your coach should know?</b>
        <textarea rows={3} placeholder="Soreness, stress, wins..." value={note} onChange={e => { setNote(e.target.value); setSaved(false) }} />
      </label>
      <button disabled={busy}>{busy ? 'Saving...' : saved ? 'Update check-in' : 'Save check-in'}</button>
      {err && <span className="err">{err}</span>}
    </form>
  )
}

export default function Today() {
  const [today] = useState(() => localDate())
  const [heading] = useState(() => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))
  return (
    <>
      <h1>Today</h1>
      <p className="mute" style={{ marginTop: -8 }}>{heading}</p>
      <Habits today={today} />
      <CheckinForm today={today} />
    </>
  )
}
