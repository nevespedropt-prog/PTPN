import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Booking, Profile, Session } from '../types'

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function CoachSlots() {
  const [slots, setSlots] = useState<Session[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [people, setPeople] = useState<Record<string, string>>({})
  const [when, setWhen] = useState('')
  const [dur, setDur] = useState(60)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [s, b, p] = await Promise.all([
      supabase.from('sessions').select('*').gte('starts_at', new Date().toISOString()).order('starts_at'),
      supabase.from('bookings').select('*'),
      supabase.from('profiles').select('id, full_name'),
    ])
    setSlots((s.data ?? []) as Session[]); setBookings((b.data ?? []) as Booking[])
    setPeople(Object.fromEntries(((p.data ?? []) as Profile[]).map(x => [x.id, x.full_name])))
  }, [])
  useEffect(() => { load() }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('sessions').insert({ starts_at: new Date(when).toISOString(), duration_min: dur })
    if (error) return setErr(error.message)
    setWhen(''); load()
  }
  async function remove(id: string) { await supabase.from('sessions').delete().eq('id', id); load() }

  return (
    <>
      <h1>Session slots</h1>
      <form className="card row" onSubmit={add}>
        <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} required />
        <input type="number" min={15} step={15} value={dur} onChange={e => setDur(Number(e.target.value))} style={{ width: 80 }} aria-label="Minutes" />
        <button>Add slot</button>
        {err && <span className="err">{err}</span>}
      </form>
      {slots.map(s => {
        const b = bookings.find(x => x.session_id === s.id)
        return (
          <div key={s.id} className="card row" style={{ justifyContent: 'space-between' }}>
            <span><b>{fmt(s.starts_at)}</b> · {s.duration_min} min<br />
              <span className="mute">{b ? `Booked: ${people[b.client_id] || 'client'}` : 'Open'}</span></span>
            <button className="ghost" onClick={() => remove(s.id)}>Delete</button>
          </div>
        )
      })}
      {slots.length === 0 && <p className="mute">No upcoming slots.</p>}
    </>
  )
}
