import { useCallback, useEffect, useMemo, useState } from 'react'
import { Seg, SectionTitle } from '../components/ui'
import { usePageTab } from '../hooks'
import { supabase } from '../lib/supabase'
import type { Booking, Session } from '../types'

type CalendarView = 'day' | 'week' | 'month'

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next }
const startOfWeek = (date: Date) => addDays(startOfDay(date), -((date.getDay() + 6) % 7))
const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b)

function periodLabel(view: CalendarView, focus: Date) {
  if (view === 'day') return focus.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (view === 'week') {
    const first = startOfWeek(focus), last = addDays(first, 6)
    const firstText = first.toLocaleDateString('en-GB', { day: 'numeric', month: first.getMonth() === last.getMonth() ? undefined : 'short' })
    return `${firstText} - ${last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  return focus.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export default function CoachSlots() {
  const [slots, setSlots] = useState<Session[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [people, setPeople] = useState<Record<string, string>>({})
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([])
  const [pick, setPick] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState('')
  const [rowErr, setRowErr] = useState('')
  const [when, setWhen] = useState('')
  const [dur, setDur] = useState(60)
  const [err, setErr] = useState('')
  const [view, setView] = usePageTab<CalendarView>('sessions-calendar', ['day', 'week', 'month'], 'week', 'view')
  const [focus, setFocus] = useState(() => startOfDay(new Date()))

  const load = useCallback(async () => {
    const [s, b, p, a] = await Promise.all([
      supabase.from('sessions').select('*').gte('starts_at', new Date().toISOString()).order('starts_at'),
      supabase.from('bookings').select('*'),
      supabase.from('profiles').select('id, full_name, role').order('full_name'),
      supabase.from('client_archives').select('client_id'),
    ])
    setSlots((s.data ?? []) as Session[]); setBookings((b.data ?? []) as Booking[])
    const profiles = (p.data ?? []) as { id: string; full_name: string; role: string }[]
    const archived = new Set((a.data ?? []).map(x => x.client_id as string))
    setPeople(Object.fromEntries(profiles.map(x => [x.id, x.full_name])))
    setClients(profiles.filter(x => x.role === 'client' && !archived.has(x.id)))
  }, [])
  useEffect(() => { load() }, [load])

  const bookingBySession = useMemo(() => Object.fromEntries(bookings.map(b => [b.session_id, b])), [bookings])
  const slotsByDay = useMemo(() => {
    const grouped: Record<string, Session[]> = {}
    slots.forEach(slot => { (grouped[dayKey(new Date(slot.starts_at))] ??= []).push(slot) })
    return grouped
  }, [slots])

  const days = useMemo(() => {
    if (view === 'day') return [startOfDay(focus)]
    if (view === 'week') return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(focus), i))
    const first = startOfWeek(new Date(focus.getFullYear(), focus.getMonth(), 1))
    const last = new Date(focus.getFullYear(), focus.getMonth() + 1, 0)
    const final = addDays(startOfWeek(last), 6)
    const count = Math.round((final.getTime() - first.getTime()) / 86400000) + 1
    return Array.from({ length: count }, (_, i) => addDays(first, i))
  }, [focus, view])

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('sessions').insert({ starts_at: new Date(when).toISOString(), duration_min: dur })
    if (error) return setErr(error.message)
    setWhen(''); load()
  }
  async function remove(id: string) { await supabase.from('sessions').delete().eq('id', id); load() }
  async function assign(slot: Session) {
    const clientId = pick[slot.id]
    if (!clientId) return
    setBusyId(slot.id); setRowErr('')
    const { error } = await supabase.from('bookings').insert({ session_id: slot.id, client_id: clientId })
    setBusyId('')
    if (error) return setRowErr('Could not add the client to this session. Someone may already be booked in. Refresh and try again.')
    setPick(current => { const next = { ...current }; delete next[slot.id]; return next }); load()
  }
  async function unassign(booking: Booking) {
    setBusyId(booking.session_id); setRowErr('')
    const { error } = await supabase.from('bookings').delete().eq('id', booking.id)
    setBusyId('')
    if (error) return setRowErr('Could not remove the client from this session. Please try again.')
    load()
  }
  function move(direction: number) {
    setFocus(current => {
      const next = new Date(current)
      if (view === 'month') next.setMonth(next.getMonth() + direction)
      else next.setDate(next.getDate() + direction * (view === 'week' ? 7 : 1))
      return next
    })
  }

  const event = (slot: Session) => {
    const booking = bookingBySession[slot.id]
    const client = booking ? people[booking.client_id] || 'Client' : 'Open slot'
    return <div key={slot.id} className={`calendar-event ${booking ? 'booked' : 'open'}`} title={`${time(slot.starts_at)} - ${client}`}>
      <b>{time(slot.starts_at)}</b><span>{client}</span>
    </div>
  }

  return (
    <>
      <div className="page-head">
        <div><div className="eyebrow">Coach schedule</div><h1>Sessions</h1><div className="sub">Create slots and see your bookings at a glance.</div></div>
      </div>
      <form className="card session-add" onSubmit={add}>
        <label><span>Date and time</span><input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} required /></label>
        <label><span>Duration</span><input type="number" min={15} step={15} value={dur} onChange={e => setDur(Number(e.target.value))} aria-label="Minutes" /></label>
        <button>Add slot</button>
        {err && <span className="err">{err}</span>}
      </form>

      <section className="card session-calendar" aria-label="Session calendar">
        <div className="calendar-toolbar">
          <Seg value={view} onChange={setView} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
          <div className="calendar-nav">
            <button type="button" className="ghost sm" onClick={() => move(-1)} aria-label={`Previous ${view}`}>&lsaquo;</button>
            <button type="button" className="ghost sm" onClick={() => setFocus(startOfDay(new Date()))}>Today</button>
            <button type="button" className="ghost sm" onClick={() => move(1)} aria-label={`Next ${view}`}>&rsaquo;</button>
          </div>
        </div>
        <h2 className="calendar-period">{periodLabel(view, focus)}</h2>

        {view === 'day' ? (
          <div className="day-agenda">
            {(slotsByDay[dayKey(focus)] ?? []).map(event)}
            {(slotsByDay[dayKey(focus)] ?? []).length === 0 && <p className="mute">No sessions on this day.</p>}
          </div>
        ) : (
          <div className="calendar-scroll">
            <div className={`calendar-grid ${view}`}>
              {view === 'month' && ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(label => <div className="calendar-dow" key={label}>{label}</div>)}
              {days.map(day => {
                const daySlots = slotsByDay[dayKey(day)] ?? []
                return <div key={dayKey(day)} className={`calendar-day ${sameDay(day, new Date()) ? 'today' : ''} ${view === 'month' && day.getMonth() !== focus.getMonth() ? 'outside' : ''}`}>
                  <div className="calendar-date"><span>{view === 'week' && day.toLocaleDateString('en-GB', { weekday: 'short' })}</span><b>{day.getDate()}</b>{view === 'week' && <small>{day.toLocaleDateString('en-GB', { month: 'short' })}</small>}</div>
                  <div className="calendar-events">{daySlots.map(event)}{daySlots.length === 0 && view === 'week' && <span className="calendar-empty">No sessions</span>}</div>
                </div>
              })}
            </div>
          </div>
        )}
        <div className="calendar-legend"><span><i className="booked" />Booked</span><span><i className="open" />Open</span></div>
      </section>

      <SectionTitle title="Upcoming sessions"><span className="mute">{slots.length} total</span></SectionTitle>
      <div className="session-list">
        {slots.map(s => {
          const b = bookingBySession[s.id]
          return (
            <div key={s.id} className="card session-row">
              <span><b>{fmt(s.starts_at)}</b> - {s.duration_min} min<br />
                <span className="mute">{b ? `Booked: ${people[b.client_id] || 'client'}` : 'Open'}</span></span>
              <span className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {b ? <button className="ghost sm" disabled={busyId === s.id} onClick={() => unassign(b)} aria-label={`Remove ${people[b.client_id] || 'client'} from ${fmt(s.starts_at)}`}>Remove client</button> : <>
                  <select aria-label={`Client for ${fmt(s.starts_at)}`} value={pick[s.id] ?? ''} onChange={e => setPick(current => ({ ...current, [s.id]: e.target.value }))}>
                    <option value="">Choose client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name || 'Unnamed'}</option>)}
                  </select>
                  <button className="sm" disabled={!pick[s.id] || busyId === s.id} onClick={() => assign(s)} aria-label={`Add client to ${fmt(s.starts_at)}`}>Add client</button>
                </>}
                <button className="ghost sm" onClick={() => remove(s.id)}>Delete</button>
              </span>
            </div>
          )
        })}
        {rowErr && <p className="err" role="alert">{rowErr}</p>}
        {slots.length === 0 && <p className="mute">No upcoming slots.</p>}
      </div>
    </>
  )
}

