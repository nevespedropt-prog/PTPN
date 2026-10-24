import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useClients } from '../../hooks'
import { localDate, niceDate } from '../../lib/dates'
import type { ClientWorkout, Profile } from '../../types'
import { Avatar, Empty, PageHead, Sheet, Skeleton } from '../../components/ui'
import Icon from '../../components/Icon'

function AddClient({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    const { data, error } = await supabase.functions.invoke('create-client', { body: { email: f.email, password: f.password, full_name: f.name } })
    setBusy(false)
    if (error || data?.error) {
      let msg = data?.error ?? error?.message ?? 'Could not add client'
      const res = (error as { context?: Response } | null)?.context
      if (res && typeof res.json === 'function') msg = (await res.json().catch(() => null))?.error ?? msg
      return setErr(msg)
    }
    setCreated({ email: f.email, password: f.password }); onDone()
  }
  const link = location.origin + location.pathname

  if (created) {
    const text = `Welcome to PTPN!\nApp: ${link}\nEmail: ${created.email}\nTemporary password: ${created.password}\nPlease change your password in Account after you sign in.`
    return (
      <div className="stack">
        <p className="ok" style={{ margin: 0 }}>Client added. Send them these details:</p>
        <pre className="card tight" style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: '.9rem' }}>{text}</pre>
        <button onClick={() => navigator.clipboard?.writeText(text)}><Icon name="copy" size={18} />Copy message</button>
        <button className="ghost" onClick={onClose}>Done</button>
      </div>
    )
  }
  return (
    <form className="stack" onSubmit={add}>
      <input placeholder="Full name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required />
      <input type="email" placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required />
      <input placeholder="Temporary password (min 6)" minLength={6} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required />
      <button disabled={busy}>{busy ? 'Adding...' : 'Add client'}</button>
      {err && <span className="err">{err}</span>}
      <p className="mute small" style={{ margin: 0 }}>The account is created already confirmed. They can change the password from their Account page.</p>
    </form>
  )
}

export default function Clients() {
  const { clients, reload } = useClients()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [cws, setCws] = useState<ClientWorkout[]>([])
  const [archives, setArchives] = useState<Record<string, string> | null>(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<Profile | null>(null)
  const today = localDate()

  const loadArchives = useCallback(async () => {
    setLoadError('')
    try {
      const { data, error } = await supabase.from('client_archives').select('client_id, archived_at')
      if (error) throw error
      setArchives(Object.fromEntries((data ?? []).map(row => [row.client_id, row.archived_at])))
    } catch {
      setLoadError('Could not load client status. Please try again.')
    }
  }, [])

  useEffect(() => { loadArchives() }, [loadArchives])
  useEffect(() => {
    supabase.from('client_workouts').select('*').order('date', { ascending: false }).limit(500).then(({ data }) => setCws((data ?? []) as ClientWorkout[]))
  }, [])

  async function changeStatus(client: Profile, archive: boolean) {
    if (busy) return
    setBusy(true); setActionError(''); setNotice('')
    try {
      const result = archive
        ? await supabase.from('client_archives').insert({ client_id: client.id, archived_at: new Date().toISOString() }).select('client_id, archived_at').single()
        : await supabase.from('client_archives').delete().eq('client_id', client.id).select('client_id')
      if (result.error) throw result.error
      if (!result.data || (Array.isArray(result.data) && result.data.length !== 1)) throw new Error('Client status was not saved')
      const saved = Array.isArray(result.data) ? result.data[0] : result.data
      if (saved.client_id !== client.id) throw new Error('Client status was not saved')
      setArchives(previous => {
        const next = { ...previous }
        if (archive && 'archived_at' in saved) next[client.id] = saved.archived_at
        else delete next[client.id]
        return next
      })
      setConfirming(null)
      setNotice(`${client.full_name || 'Client'} ${archive ? 'archived' : 'restored to active clients'}.`)
    } catch {
      setActionError('Could not save client status. Please try again.')
    } finally { setBusy(false) }
  }

  const list = (clients ?? []).filter(c => (c.full_name || '').toLowerCase().includes(q.trim().toLowerCase()))
  const active = list.filter(c => !archives?.[c.id])
  const archived = list.filter(c => !!archives?.[c.id])
  const activeCount = (clients ?? []).filter(c => !archives?.[c.id]).length
  const ready = clients !== null && archives !== null && !loadError
  const stat = (id: string) => {
    const mine = cws.filter(c => c.client_id === id)
    const due = mine.filter(c => c.date >= daysAgo(14) && c.date <= today)
    const done = due.filter(c => c.status === 'done')
    const last = mine.filter(c => c.status === 'done')[0]
    return { rate: due.length ? Math.round((done.length / due.length) * 100) : null, last, upcoming: mine.some(c => c.date >= today && c.status === 'scheduled') }
  }

  function card(client: Profile, isArchived: boolean) {
    const s = stat(client.id)
    return (
      <div key={client.id} className="card client-card">
        <Link to={`/clients/${client.id}`} className="client-card-link" style={{ color: 'var(--ink)' }}>
          <div className="row nowrap" style={{ marginBottom: 10 }}>
            <Avatar name={client.full_name} size={46} />
            <div className="grow client-card-name"><b>{client.full_name || 'Unnamed'}</b><br /><span className="mute small">{isArchived ? `Archived ${niceDate(archives![client.id].slice(0, 10))}` : s.last ? `Last workout ${niceDate(s.last.date)}` : 'No workouts yet'}</span></div>
            <Icon name="chev" />
          </div>
          <div className="row" style={{ marginBottom: 0 }}>
            {isArchived ? <span className="badge">Archived</span> : <>
              {s.rate !== null ? <span className={'badge ' + (s.rate >= 70 ? 'green' : s.rate >= 40 ? 'amber' : 'red')}>{s.rate}% in 2 weeks</span> : <span className="badge">No plan yet</span>}
              {s.upcoming && <span className="badge blue">Scheduled</span>}
            </>}
          </div>
        </Link>
        <button className="ghost sm" disabled={busy} aria-label={`${isArchived ? 'Restore' : 'Archive'} ${client.full_name || 'client'}`} onClick={() => { setActionError(''); if (isArchived) changeStatus(client, false); else setConfirming(client) }}>
          {isArchived ? 'Restore client' : 'Archive client'}
        </button>
      </div>
    )
  }

  return (
    <>
      <PageHead eyebrow="Coaching" title="Clients" sub={ready ? `${activeCount} active, ${clients.length - activeCount} archived` : undefined}>
        <button className="sm" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add client</button>
      </PageHead>
      <input placeholder="Search clients" aria-label="Search clients" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      <p role="status" className="small ok" aria-live="polite">{notice}</p>
      {actionError && !confirming && <p role="alert" className="err">{actionError}</p>}
      {loadError ? <div className="card"><p role="alert" className="err">{loadError}</p><button className="ghost sm" onClick={loadArchives}>Try again</button></div> : !ready && <Skeleton n={4} />}
      {ready && <>
        <section aria-labelledby="active-clients-heading">
          <div className="section-title"><h2 id="active-clients-heading">Active clients</h2><span className="badge">{active.length}</span></div>
          {active.length === 0 && <div className="card"><Empty icon="clients" title={q.trim() ? 'No matching active clients' : 'No active clients'}>{q.trim() ? 'Try another name or check the archive below.' : 'Add a client or restore someone from the archive below.'}</Empty></div>}
          <div className="g-auto">{active.map(c => card(c, false))}</div>
        </section>
        <section aria-labelledby="archived-clients-heading">
          <div className="section-title"><h2 id="archived-clients-heading">Archived clients</h2><span className="badge">{archived.length}</span></div>
          <p className="mute small">Previous clients. Their plans and history stay saved.</p>
          {archived.length === 0 && <p className="mute small">{q.trim() ? 'No matching archived clients.' : 'No archived clients yet.'}</p>}
          <div className="g-auto">{archived.map(c => card(c, true))}</div>
        </section>
      </>}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add client"><AddClient onDone={reload} onClose={() => setAdding(false)} /></Sheet>
      <Sheet open={!!confirming} onClose={() => { if (!busy) { setConfirming(null); setActionError('') } }} title="Archive client">
        <div className="stack">
          <p>Move {confirming?.full_name || 'this client'} to Archived clients? Their account, plans and history stay saved. They can still sign in. You can restore them at any time.</p>
          {actionError && <p role="alert" className="err">{actionError}</p>}
          <button disabled={busy} onClick={() => confirming && changeStatus(confirming, true)}>{busy ? 'Archiving...' : 'Confirm archive'}</button>
          <button className="ghost" disabled={busy} onClick={() => { setConfirming(null); setActionError('') }}>Cancel</button>
        </div>
      </Sheet>
    </>
  )
}

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d) }
