import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '../types'
import { Sheet } from './ui'
import Icon from './Icon'

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const pad = (n: number) => String(n).padStart(2, '0')
/** ISO time to the value a datetime-local box expects, in the coach's own time zone. */
export const toLocalInput = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }

/** The client's booked sessions on the coach side: upcoming first, with a way to move one to another day. */
export default function ClientSessions({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<Session[] | null>(null)
  const [moving, setMoving] = useState<Session | null>(null)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('PT session')
  const [when, setWhen] = useState('')
  const [dur, setDur] = useState(60)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const booked = await supabase.from('bookings').select('session_id').eq('client_id', clientId)
    const ids = ((booked.data ?? []) as { session_id: string }[]).map(b => b.session_id)
    const found = ids.length ? await supabase.from('sessions').select('*').in('id', ids).order('starts_at') : { data: [] }
    setRows((found.data ?? []) as Session[])
  }, [clientId])
  useEffect(() => { load() }, [load])

  const now = new Date().toISOString()
  const upcoming = (rows ?? []).filter(s => s.starts_at >= now)
  const past = (rows ?? []).filter(s => s.starts_at < now).reverse()

  function startMove(s: Session) { setAdding(false); setMoving(s); setWhen(toLocalInput(s.starts_at)); setDur(s.duration_min); setErr(''); setNotice('') }
  function startAdd() { setMoving(null); setAdding(true); setWhen(''); setDur(60); setTitle('PT session'); setErr(''); setNotice('') }
  const closeSheet = () => { setMoving(null); setAdding(false) }

  /** Checks the time, then looks for another session at the same time so the coach is never double-booked. */
  async function clashFor(start: Date, minutes: number, ignoreId?: string) {
    const end = new Date(start.getTime() + minutes * 60000)
    let q = supabase.from('sessions').select('id, starts_at, duration_min')
      .gte('starts_at', new Date(start.getTime() - 24 * 3600000).toISOString()).lte('starts_at', end.toISOString())
    if (ignoreId) q = q.neq('id', ignoreId)
    const around = await q
    if (around.error) return { error: 'Could not check your calendar. Please try again.' }
    const clash = ((around.data ?? []) as Session[]).find(o => new Date(o.starts_at) < end && new Date(new Date(o.starts_at).getTime() + o.duration_min * 60000) > start)
    return clash ? { error: `That overlaps another session at ${fmt(clash.starts_at)}. Pick a free time.` } : {}
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const start = new Date(when)
    if (Number.isNaN(start.getTime())) return setErr('Choose a date and time.')
    if (!Number.isFinite(dur) || dur < 15) return setErr('A session lasts at least 15 minutes.')
    setBusy(true); setErr('')
    const check = await clashFor(start, dur, moving?.id)
    if (check.error) { setBusy(false); return setErr(check.error) }
    if (moving) {
      const { error } = await supabase.from('sessions').update({ starts_at: start.toISOString(), duration_min: dur }).eq('id', moving.id)
      setBusy(false)
      if (error) return setErr('Could not move the session. Please try again.')
      setNotice(`Session moved to ${fmt(start.toISOString())}.`)
    } else {
      const made = await supabase.from('sessions').insert({ starts_at: start.toISOString(), duration_min: dur, title: title.trim() || 'PT session' }).select('id').single()
      if (made.error || !made.data) { setBusy(false); return setErr('Could not add the session. Please try again.') }
      const booked = await supabase.from('bookings').insert({ session_id: made.data.id, client_id: clientId })
      if (booked.error) { await supabase.from('sessions').delete().eq('id', made.data.id); setBusy(false); return setErr('Could not book the client into the session. Please try again.') }
      setBusy(false); setNotice(`Session added for ${fmt(start.toISOString())}.`)
    }
    closeSheet(); load()
  }

  async function cancel() {
    if (!moving || !confirm('Cancel this session? It is removed from the calendar and from the client.')) return
    setBusy(true); setErr('')
    const { error } = await supabase.from('sessions').delete().eq('id', moving.id)
    setBusy(false)
    if (error) return setErr('Could not cancel the session. Please try again.')
    closeSheet(); setNotice('Session cancelled.'); load()
  }

  const line = (s: Session) => (
    <div key={s.id} className="session-row-lite" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--line)' }}>
      <span className="grow"><b>{fmt(s.starts_at)}</b><br /><span className="meta">{s.title} · {s.duration_min} min</span></span>
      <button className="ghost sm" onClick={() => startMove(s)} aria-label={`Edit session on ${fmt(s.starts_at)}`}><Icon name="calendar" size={16} />Edit</button>
    </div>
  )

  return (
    <section className="card" aria-label="Client sessions">
      <div className="section-title" style={{ margin: '0 0 6px' }}><h2>Sessions</h2><span className="row" style={{ gap: 8, margin: 0 }}><span className="mute small">{rows ? `${upcoming.length} upcoming` : ''}</span><button className="soft sm" onClick={startAdd}><Icon name="plus" size={16} />Add session</button></span></div>
      {notice && <p role="status" style={{ margin: '4px 0', color: 'var(--green)' }}>{notice}</p>}
      {rows && upcoming.length === 0 && <p className="mute" style={{ margin: '4px 0' }}>No upcoming sessions booked.</p>}
      {upcoming.map(line)}
      {past.length > 0 && <details style={{ marginTop: 8 }}><summary className="mute small" style={{ cursor: 'pointer' }}>Past sessions ({past.length})</summary>{past.slice(0, 100).map(line)}</details>}
      <Sheet open={!!moving || adding} onClose={closeSheet} title={moving ? 'Edit session' : 'Add session'}>
        {(moving || adding) && <form className="stack" onSubmit={save}>
          {moving ? <p className="mute" style={{ margin: 0 }}>Currently {fmt(moving.starts_at)}. Pick the new day and time.</p>
            : <label className="field">Session name<input value={title} onChange={e => setTitle(e.target.value)} /></label>}
          <label className="field">Date and time<input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} required /></label>
          <label className="field">Duration (minutes)<input type="number" min={15} step={15} value={dur} onChange={e => setDur(Number(e.target.value))} /></label>
          <button disabled={busy}>{busy ? 'Saving...' : moving ? 'Save changes' : 'Add session'}</button>
          {moving && <button type="button" className="danger" disabled={busy} onClick={cancel}>Cancel this session</button>}
          {err && <span className="err" role="alert">{err}</span>}
        </form>}
      </Sheet>
    </section>
  )
}
