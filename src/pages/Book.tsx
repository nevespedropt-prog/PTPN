import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import type { Booking, Session } from '../types'

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Book() {
  const { profile } = useAuth()
  const [slots, setSlots] = useState<Session[]>([])
  const [taken, setTaken] = useState<Set<string>>(new Set())
  const [mine, setMine] = useState<Booking[]>([])
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const now = new Date().toISOString()
    const [s, t, m] = await Promise.all([
      supabase.from('sessions').select('*').gte('starts_at', now).order('starts_at'),
      supabase.rpc('booked_session_ids'),
      supabase.from('bookings').select('*').eq('client_id', profile!.id),
    ])
    setSlots((s.data ?? []) as Session[])
    setTaken(new Set((t.data ?? []) as string[]))
    setMine((m.data ?? []) as Booking[])
  }, [profile])
  useEffect(() => { load() }, [load])

  async function book(id: string) {
    setErr('')
    const { error } = await supabase.from('bookings').insert({ session_id: id, client_id: profile!.id })
    if (error) setErr(error.code === '23505' ? 'That slot was just taken.' : error.message)
    load()
  }
  async function cancel(id: string) { await supabase.from('bookings').delete().eq('id', id); load() }

  const myBySession = new Map(mine.map(b => [b.session_id, b]))
  return (
    <>
      <h1>Book a session</h1>
      {err && <p className="err">{err}</p>}
      {slots.length === 0 && <p className="mute">No upcoming slots. Check back soon.</p>}
      {slots.map(s => {
        const b = myBySession.get(s.id)
        return (
          <div key={s.id} className="card row" style={{ justifyContent: 'space-between' }}>
            <span><b>{s.title}</b><br /><span className="mute">{fmt(s.starts_at)} · {s.duration_min} min</span></span>
            {b ? <button className="ghost" onClick={() => cancel(b.id)}>Cancel</button>
              : taken.has(s.id) ? <span className="mute">Taken</span>
              : <button onClick={() => book(s.id)}>Book</button>}
          </div>
        )
      })}
    </>
  )
}
