import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useClients } from '../../hooks'
import { localDate, niceDate } from '../../lib/dates'
import type { ClientWorkout } from '../../types'
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
  const today = localDate()

  useEffect(() => {
    supabase.from('client_workouts').select('*').order('date', { ascending: false }).limit(500).then(({ data }) => setCws((data ?? []) as ClientWorkout[]))
  }, [])

  const list = (clients ?? []).filter(c => (c.full_name || '').toLowerCase().includes(q.toLowerCase()))
  const stat = (id: string) => {
    const mine = cws.filter(c => c.client_id === id)
    const due = mine.filter(c => c.date >= daysAgo(14) && c.date <= today)
    const done = due.filter(c => c.status === 'done')
    const last = mine.filter(c => c.status === 'done')[0]
    return { rate: due.length ? Math.round((done.length / due.length) * 100) : null, last, upcoming: mine.some(c => c.date >= today && c.status === 'scheduled') }
  }

  return (
    <>
      <PageHead eyebrow="Coaching" title="Clients" sub={clients ? `${clients.length} total` : undefined}>
        <button className="sm" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add client</button>
      </PageHead>
      <input placeholder="Search clients" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      {!clients && <Skeleton n={4} />}
      {clients && clients.length === 0 && <div className="card"><Empty icon="clients" title="No clients yet">Add your first client to start building their plan.</Empty></div>}
      <div className="g-auto">
        {list.map(c => {
          const s = stat(c.id)
          return (
            <Link key={c.id} to={`/clients/${c.id}`} className="card click" style={{ color: 'var(--ink)' }}>
              <div className="row nowrap" style={{ marginBottom: 10 }}>
                <Avatar name={c.full_name} size={46} />
                <div className="grow"><b>{c.full_name || 'Unnamed'}</b><br /><span className="mute small">{s.last ? `Last workout ${niceDate(s.last.date)}` : 'No workouts yet'}</span></div>
                <Icon name="chev" />
              </div>
              <div className="row" style={{ marginBottom: 0 }}>
                {s.rate !== null ? <span className={'badge ' + (s.rate >= 70 ? 'green' : s.rate >= 40 ? 'amber' : 'red')}>{s.rate}% in 2 weeks</span> : <span className="badge">No plan yet</span>}
                {s.upcoming && <span className="badge blue">Scheduled</span>}
              </div>
            </Link>
          )
        })}
      </div>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add client"><AddClient onDone={reload} onClose={() => setAdding(false)} /></Sheet>
    </>
  )
}

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d) }
