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

  function startMove(s: Session) { setMoving(s); setWhen(toLocalInput(s.starts_at)); setDur(s.duration_min); setErr(''); setNotice('') }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!moving) return
    const start = new Date(when)
    if (Number.isNaN(start.getTime())) return setErr('Choose a date and time.')
    if (start.getTime() < Date.now()) return setErr('Choose a time in the future.')
    if (!Number.isFinite(dur) || dur < 15) return setErr('A session lasts at least 15 minutes.')
    const end = new Date(start.getTime() + dur * 60000)
    setBusy(true); setErr('')
    // Never double-book the coach: look at the sessions around the new time.
    const around = await supabase.from('sessions').select('id, starts_at, duration_min').neq('id', moving.id)
      .gte('starts_at', new Date(start.getTime() - 24 * 3600000).toISOString()).lte('starts_at', end.toISOString())
    if (around.error) { setBusy(false); return setErr('Could not check your calendar. Please try again.') }
    const clash = ((around.data ?? []) as Session[]).find(o => new Date(o.starts_at) < end && new Date(new Date(o.starts_at).getTime() + o.duration_min * 60000) > start)
    if (clash) { setBusy(false); return setErr(`That overlaps another session at ${fmt(clash.starts_at)}. Pick a free time.`) }
    const { error } = await supabase.from('sessions').update({ starts_at: start.toISOString(), duration_min: dur }).eq('id', moving.id)
    setBusy(false)
    if (error) return setErr('Could not move the session. Please try again.')
    setMoving(null); setNotice(`Session moved to ${fmt(start.toISOString())}.`); load()
  }

  const line = (s: Session, canMove: boolean) => (
    <div key={s.id} className="session-row-lite" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--line)' }}>
      <span className="grow"><b>{fmt(s.starts_at)}</b><br /><span className="meta">{s.title} · {s.duration_min} min</span></span>
      {canMove && <button className="ghost sm" onClick={() => startMove(s)} aria-label={`Move session on ${fmt(s.starts_at)}`}><Icon name="calendar" size={16} />Move</button>}
    </div>
  )

  return (
    <section className="card" aria-label="Client sessions">
      <div className="section-title" style={{ margin: '0 0 6px' }}><h2>Sessions</h2><span className="mute small">{rows ? `${upcoming.length} upcoming` : ''}</span></div>
      {notice && <p role="status" style={{ margin: '4px 0', color: 'var(--green)' }}>{notice}</p>}
      {rows && upcoming.length === 0 && <p className="mute" style={{ margin: '4px 0' }}>No upcoming sessions booked. Add one from the Sessions page.</p>}
      {upcoming.map(s => line(s, true))}
      {past.length > 0 && <details style={{ marginTop: 8 }}><summary className="mute small" style={{ cursor: 'pointer' }}>Past sessions ({past.length})</summary>{past.slice(0, 30).map(s => line(s, false))}</details>}
      <Sheet open={!!moving} onClose={() => setMoving(null)} title="Move session">
        {moving && <form className="stack" onSubmit={save}>
          <p className="mute" style={{ margin: 0 }}>Currently {fmt(moving.starts_at)}. Pick the new day and time.</p>
          <label className="field">New date and time<input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} required /></label>
          <label className="field">Duration (minutes)<input type="number" min={15} step={15} value={dur} onChange={e => setDur(Number(e.target.value))} /></label>
          <button disabled={busy}>{busy ? 'Saving...' : 'Move session'}</button>{err && <span className="err" role="alert">{err}</span>}
        </form>}
      </Sheet>
    </section>
  )
}
