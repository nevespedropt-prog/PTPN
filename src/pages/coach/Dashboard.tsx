import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { useClients } from '../../hooks'
import { addDays, daysBetween, localDate, longDay, niceDate, timeAgo, weekOf } from '../../lib/dates'
import { firstName, greeting } from '../../lib/util'
import type { Checkin, ClientWorkout, Message, Session, Workout } from '../../types'
import { Avatar, Empty, PageHead, Skeleton, Tile } from '../../components/ui'
import Icon from '../../components/Icon'

interface Data { cws: ClientWorkout[]; checkins: Checkin[]; msgs: Message[]; sessions: Session[]; workouts: Record<string, Workout> }

export default function Dashboard() {
  const { profile } = useAuth()
  const { clients } = useClients()
  const [d, setD] = useState<Data | null>(null)
  const [today] = useState(() => localDate())

  useEffect(() => {
    ;(async () => {
      const from = addDays(today, -14)
      const [cw, ck, ms, se] = await Promise.all([
        supabase.from('client_workouts').select('*').gte('date', from).order('date', { ascending: false }).limit(400),
        supabase.from('checkins').select('*').gte('date', addDays(today, -7)).order('date', { ascending: false }),
        supabase.from('messages').select('*').is('read_at', null).neq('sender_id', profile!.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('sessions').select('*').gte('starts_at', new Date().toISOString()).order('starts_at').limit(5),
      ])
      const cws = (cw.data ?? []) as ClientWorkout[]
      const ids = [...new Set(cws.map(c => c.workout_id))]
      const w = ids.length ? ((await supabase.from('workouts').select('*').in('id', ids)).data ?? []) as Workout[] : []
      setD({ cws, checkins: (ck.data ?? []) as Checkin[], msgs: (ms.data ?? []) as Message[], sessions: (se.data ?? []) as Session[], workouts: Object.fromEntries(w.map(x => [x.id, x])) })
    })()
  }, [profile, today])

  if (!clients || !d) return <><PageHead eyebrow="Overview" title="Dashboard" /><Skeleton n={4} /></>

  const nameOf = (id: string) => clients.find(c => c.id === id)?.full_name || 'Client'
  const week = weekOf(today)
  const thisWeek = d.cws.filter(c => c.date >= week[0] && c.date <= week[6])
  const due = thisWeek.filter(c => c.date <= today)
  const done = due.filter(c => c.status === 'done').length
  const compliance = due.length ? Math.round((done / due.length) * 100) : null

  // clients who need attention
  const attention = clients.map(c => {
    const mine = d.cws.filter(x => x.client_id === c.id)
    const lastDone = mine.filter(x => x.status === 'done').sort((a, b) => b.date.localeCompare(a.date))[0]
    const missed = mine.filter(x => x.date < today && x.status === 'scheduled').length
    const lowMood = d.checkins.find(k => k.client_id === c.id && (k.mood ?? 5) <= 2)
    const reasons: string[] = []
    if (missed >= 2) reasons.push(`${missed} missed workouts`)
    if (!lastDone && mine.length) reasons.push('No workouts completed yet')
    else if (lastDone && daysBetween(lastDone.date, today) >= 7) reasons.push(`No workout for ${daysBetween(lastDone.date, today)} days`)
    if (lowMood) reasons.push('Low mood check-in')
    if (!mine.length) reasons.push('Nothing scheduled')
    return { c, reasons }
  }).filter(x => x.reasons.length).slice(0, 6)

  const recent = d.cws.filter(c => c.status === 'done').sort((a, b) => (b.completed_at ?? b.date).localeCompare(a.completed_at ?? a.date)).slice(0, 6)
  const unreadBy = new Map<string, number>()
  for (const m of d.msgs) unreadBy.set(m.client_id, (unreadBy.get(m.client_id) ?? 0) + 1)

  return (
    <>
      <PageHead eyebrow={longDay(today)} title={`${greeting()}, ${firstName(profile?.full_name ?? '')}`} />
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <Tile label="Clients" value={clients.length} />
        <Tile label="Week compliance" value={compliance === null ? '–' : `${compliance}%`} accent={compliance !== null && compliance < 50 ? '#ff7a87' : undefined} foot={`${done} of ${due.length} due done`} />
        <Tile label="Unread" value={d.msgs.length} foot="messages" accent={d.msgs.length ? 'var(--red)' : undefined} />
        <Tile label="Check-ins" value={new Set(d.checkins.filter(k => k.date >= addDays(today, -1)).map(k => k.client_id)).size} foot="in the last 2 days" />
      </div>

      <div className="split">
        <div>
          <div className="section-title" style={{ marginTop: 6 }}><h2>Needs attention</h2></div>
          <div className="card tight">
            {attention.length === 0 && <Empty icon="check" title="All caught up">{clients.length ? 'Everyone is on track.' : 'Add your first client to get started.'}</Empty>}
            <div className="list">
              {attention.map(({ c, reasons }) => (
                <Link key={c.id} to={`/clients/${c.id}`} className="item">
                  <Avatar name={c.full_name} size={40} />
                  <span className="grow"><span className="title">{c.full_name || 'Unnamed'}</span><br /><span className="meta">{reasons.join(' · ')}</span></span>
                  <Icon name="chev" />
                </Link>
              ))}
            </div>
          </div>

          <div className="section-title"><h2>Recent workouts</h2></div>
          <div className="card tight">
            {recent.length === 0 && <Empty icon="train" title="No completed workouts yet" />}
            <div className="list">
              {recent.map(c => (
                <Link key={c.id} to={`/workout/${c.id}`} className="item">
                  <Avatar name={nameOf(c.client_id)} size={36} />
                  <span className="grow"><span className="title">{nameOf(c.client_id)}</span><br /><span className="meta">{d.workouts[c.workout_id]?.name ?? 'Workout'} · {niceDate(c.date)}</span></span>
                  {c.rating && <span className="badge amber">{'★'.repeat(c.rating)}</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="section-title" style={{ marginTop: 6 }}><h2>Inbox</h2><Link to="/inbox">Open</Link></div>
          <div className="card tight">
            {unreadBy.size === 0 && <Empty icon="inbox" title="Inbox zero" />}
            <div className="list">
              {[...unreadBy].map(([id, n]) => {
                const last = d.msgs.find(m => m.client_id === id)!
                return (
                  <Link key={id} to={`/inbox/${id}`} className="item">
                    <Avatar name={nameOf(id)} size={36} />
                    <span className="grow"><span className="title">{nameOf(id)}</span><br /><span className="meta truncate" style={{ display: 'block' }}>{last.body} · {timeAgo(last.created_at)}</span></span>
                    <span className="dot">{n}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="section-title"><h2>Upcoming sessions</h2><Link to="/slots">Manage</Link></div>
          <div className="card tight">
            {d.sessions.length === 0 && <Empty icon="calendar" title="No sessions scheduled" />}
            <div className="list">
              {d.sessions.map(s => (
                <div key={s.id} className="item"><span className="grow"><span className="title">{new Date(s.starts_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><br /><span className="meta">{s.title} · {s.duration_min} min</span></span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
