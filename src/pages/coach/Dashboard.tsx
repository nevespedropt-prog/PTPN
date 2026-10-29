import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { addDays, daysBetween, localDate, longDay, niceDate, timeAgo, weekOf } from '../../lib/dates'
import { firstName, greeting } from '../../lib/util'
import { parqAlerts } from '../../lib/parq'
import type { Checkin, ClientWorkout, Message, Profile, Session, TasterSession, Workout } from '../../types'
import { Avatar, Empty, PageHead, Skeleton, Tile } from '../../components/ui'
import Icon from '../../components/Icon'
import { TechniqueReviewQueue } from '../../components/ExerciseFeedback'
import { WeeklyReviewQueue } from '../../components/WeeklyCheckins'

interface Data { clients: Profile[]; archived: string[]; cws: ClientWorkout[]; checkins: Checkin[]; msgs: Message[]; sessions: Session[]; tasters: TasterSession[]; workouts: Record<string, Workout> }

export default function Dashboard() {
  const { profile } = useAuth()
  const [d, setD] = useState<Data | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState(false)
  const [queueCounts, setQueueCounts] = useState<{ weekly: number | null; technique: number | null }>({ weekly: null, technique: null })
  const today = localDate()

  useEffect(() => {
    if (!profile?.id) return
    let active = true
    setD(null); setError(false); setQueueCounts({ weekly: null, technique: null })
    ;(async () => {
      try {
        const [cw, ck, ms, se, people, archives, tasters] = await Promise.all([
          supabase.from('client_workouts').select('*').gte('date', addDays(today, -13)).lte('date', today).order('date', { ascending: false }).limit(1000),
          supabase.from('checkins').select('*').gte('date', addDays(today, -6)).lte('date', today).order('date', { ascending: false }).limit(1000),
          supabase.from('messages').select('*').is('read_at', null).neq('sender_id', profile.id).order('created_at', { ascending: false }).limit(1000),
          supabase.from('sessions').select('*').gte('starts_at', new Date().toISOString()).order('starts_at').limit(5),
          supabase.from('profiles').select('*').eq('role', 'client').order('full_name').limit(1000),
          supabase.from('client_archives').select('client_id').limit(1000),
          supabase.from('taster_sessions').select('*').order('assessed_on', { ascending: false }).order('created_at', { ascending: false }).limit(1000),
        ])
        // Never present failed or potentially truncated reads as complete totals.
        const results = [cw, ck, ms, people, archives, tasters]
        if (se.error || results.some(r => r.error || (r.data?.length ?? 0) >= 1000)) throw new Error('Dashboard unavailable')
        const cws = (cw.data ?? []) as ClientWorkout[]
        const ids = [...new Set(cws.map(c => c.workout_id))]
        const w = ids.length ? await supabase.from('workouts').select('*').in('id', ids).limit(1000) : { data: [], error: null }
        if (w.error || (w.data?.length ?? 0) >= 1000) throw new Error('Workouts unavailable')
        if (active) setD({ clients: (people.data ?? []) as Profile[], archived: (archives.data ?? []).map(x => x.client_id), cws, checkins: (ck.data ?? []) as Checkin[], msgs: (ms.data ?? []) as Message[], sessions: (se.data ?? []) as Session[], tasters: (tasters.data ?? []) as TasterSession[], workouts: Object.fromEntries((w.data as Workout[] ?? []).map(x => [x.id, x])) })
      } catch { if (active) setError(true) }
    })()
    return () => { active = false }
  }, [profile?.id, today, refresh])

  if (error) return <><PageHead eyebrow="Overview" title="Dashboard" /><div className="card" role="alert"><p>Could not load the dashboard. Please retry.</p><button onClick={() => setRefresh(n => n + 1)}>Retry dashboard</button></div></>
  if (!d) return <><PageHead eyebrow="Overview" title="Dashboard" /><Skeleton n={4} /></>

  const clients = d.clients.filter(c => !d.archived.includes(c.id))
  const activeIds = new Set(clients.map(c => c.id))
  const activeWorkouts = d.cws.filter(c => activeIds.has(c.client_id))
  const activeCheckins = d.checkins.filter(c => activeIds.has(c.client_id))
  const nameOf = (id: string) => d.clients.find(c => c.id === id)?.full_name || 'Client'
  const week = weekOf(today)
  const thisWeek = activeWorkouts.filter(c => c.date >= week[0] && c.date <= week[6])
  const due = thisWeek.filter(c => c.date <= today)
  const done = due.filter(c => c.status === 'done').length
  const compliance = due.length ? Math.round((done / due.length) * 100) : null

  // clients who need attention
  const attention = clients.map(c => {
    const mine = activeWorkouts.filter(x => x.client_id === c.id)
    const lastDone = mine.filter(x => x.status === 'done').sort((a, b) => b.date.localeCompare(a.date))[0]
    const missed = mine.filter(x => x.date < today && x.status === 'scheduled').length
    const latestCheckin = activeCheckins.find(k => k.client_id === c.id)
    const lowMood = (latestCheckin?.mood ?? 5) <= 2
    const reasons: string[] = []
    if (missed >= 2) reasons.push(`${missed} missed workouts`)
    if (!lastDone && mine.length) reasons.push('No completed workout in the last 14 days')
    else if (lastDone && daysBetween(lastDone.date, today) >= 7) reasons.push(`No workout for ${daysBetween(lastDone.date, today)} days`)
    if (lowMood) reasons.push('Latest check-in: low mood')
    if (!mine.length) reasons.push('No workouts scheduled in the last 14 days')
    return { c, reasons, priority: missed + (lowMood ? 3 : 0) }
  }).filter(x => x.reasons.length).sort((a, b) => b.priority - a.priority || a.c.full_name.localeCompare(b.c.full_name))

  const recent = activeWorkouts.filter(c => c.status === 'done').sort((a, b) => (b.completed_at ?? b.date).localeCompare(a.completed_at ?? a.date)).slice(0, 6)
  const unreadBy = new Map<string, number>()
  for (const m of d.msgs) unreadBy.set(m.client_id, (unreadBy.get(m.client_id) ?? 0) + 1)
  const latestTasters = new Map<string, TasterSession>()
  for (const taster of d.tasters) if (!latestTasters.has(taster.client_id)) latestTasters.set(taster.client_id, taster)
  const healthRisks = clients.map(client => {
    const taster = latestTasters.get(client.id)
    if (!taster) return null
    const alerts = parqAlerts(taster.parq_answers)
    const details = [taster.parq_health_details, taster.parq_injury_details, taster.parq_medication_details, taster.parq_allergy_details].filter(Boolean)
    return alerts.length || details.length ? { client, alerts, details } : null
  }).filter((item): item is NonNullable<typeof item> => !!item)
  const urgentAttention = attention.filter(item => item.priority >= 3).length
  const routineAttention = attention.length - urgentAttention
  const priorities = [
    healthRisks.length > 0 ? { label: 'Health-screening alerts', detail: 'Important client risks to review before coaching', count: healthRisks.length, href: '#health-alerts', panel: '' } : null,
    urgentAttention > 0 ? { label: 'Urgent client follow-up', detail: 'Low mood or multiple missed workouts', count: urgentAttention, href: '#needs-attention', panel: 'coach-activity' } : null,
    d.msgs.length > 0 ? { label: 'Unread messages', detail: `${unreadBy.size} conversation${unreadBy.size === 1 ? '' : 's'} awaiting a reply`, count: d.msgs.length, href: '#dashboard-inbox', panel: 'coach-activity' } : null,
    (queueCounts.weekly ?? 0) > 0 ? { label: 'Weekly reviews', detail: 'Client check-ins awaiting feedback', count: queueCounts.weekly!, href: '#weekly-reviews', panel: 'coach-reviews' } : null,
    (queueCounts.technique ?? 0) > 0 ? { label: 'Technique reviews', detail: 'Exercise videos awaiting feedback', count: queueCounts.technique!, href: '#technique-reviews', panel: 'coach-reviews' } : null,
    routineAttention > 0 ? { label: 'Routine client follow-up', detail: 'Training inactivity or no recent schedule', count: routineAttention, href: '#needs-attention', panel: 'coach-activity' } : null,
  ].filter((item): item is NonNullable<typeof item> => !!item)
  const prioritiesLoaded = queueCounts.weekly !== null && queueCounts.technique !== null

  return (
    <>
      <PageHead eyebrow={longDay(today)} title={`${greeting()}, ${firstName(profile?.full_name ?? '')}`} />
      <section className="card tight" aria-label="Today's priorities" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}><div><h2 style={{ margin: 0 }}>Today's priorities</h2><p className="mute small" style={{ margin: '4px 0 0' }}>Highest-impact coaching actions first.</p></div><button className="soft sm" onClick={() => setRefresh(n => n + 1)}>Refresh dashboard</button></div>
        {!prioritiesLoaded && priorities.length === 0 ? <p role="status" className="mute">Checking priorities...</p> : priorities.length === 0 ? <Empty icon="check" title="All caught up">No client actions need attention right now.</Empty> : <div className="list" style={{ marginTop: 10 }}>
          {priorities.map((item, index) => <a className="item" href={item.href} key={item.label} onClick={() => { if (item.panel) document.getElementById(item.panel)?.setAttribute('open', '') }}>
            <span className="badge amber" aria-label={`Priority ${index + 1}`}>{index + 1}</span>
            <span className="grow"><span className="title">{item.label}</span><br /><span className="meta">{item.detail}</span></span>
            <span className="badge">{item.count}</span><Icon name="chev" />
          </a>)}
        </div>}
      </section>
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <Tile label="Active clients" value={clients.length} />
        <Tile label="Week compliance" value={compliance === null ? '-' : `${compliance}%`} accent={compliance !== null && compliance < 50 ? '#ff7a87' : undefined} foot={`${done} of ${due.length} due done`} />
        <Tile label="Unread" value={d.msgs.length} foot="messages" accent={d.msgs.length ? 'var(--gold)' : undefined} />
        <Tile label="Check-ins" value={new Set(activeCheckins.filter(k => k.date >= addDays(today, -1)).map(k => k.client_id)).size} foot="in the last 2 days" />
      </div>

      {healthRisks.length > 0 && <section id="health-alerts" className="card tight consent-card" aria-label="Client health alerts" style={{ marginBottom: 12, scrollMarginTop: 80 }}>
        <div><span className="eyebrow">Coach awareness</span><h2 style={{ margin: '5px 0 0' }}>Health-screening alerts</h2></div>
        <div className="list" style={{ marginTop: 10 }}>{healthRisks.map(({ client, alerts, details }) => <Link key={client.id} to={`/clients/${client.id}`} className="item">
          <Avatar name={client.full_name} size={40} />
          <span className="grow"><span className="title">{client.full_name}</span><br /><span className="meta">{[...alerts, ...details].join(' � ')}</span></span><Icon name="chev" />
        </Link>)}</div>
      </section>}

      <details id="coach-reviews" className="card dashboard-disclosure">
        <summary><span><b>Client reviews</b><small>{Math.max(0, queueCounts.weekly ?? 0) + Math.max(0, queueCounts.technique ?? 0)} awaiting feedback</small></span></summary>
        <div className="dashboard-disclosure-body"><div id="weekly-reviews" style={{ scrollMarginTop: 80 }}><WeeklyReviewQueue key={refresh} clients={clients} onCount={count => setQueueCounts(current => ({ ...current, weekly: count }))} /></div>
        <div id="technique-reviews" style={{ scrollMarginTop: 80 }}><TechniqueReviewQueue key={refresh} clients={clients} onCount={count => setQueueCounts(current => ({ ...current, technique: count }))} /></div></div>
      </details>
      <details id="coach-activity" className="card dashboard-disclosure" defaultOpen={attention.length > 0 || d.msgs.length > 0}>
        <summary><span><b>Client activity</b><small>Follow-ups, messages, workouts and sessions</small></span></summary>
        <div className="dashboard-disclosure-body"><div className="split">
        <div>
          <div id="needs-attention" className="section-title" style={{ marginTop: 6, scrollMarginTop: 80 }}><h2>Needs attention</h2></div>
          <p className="mute small">Active clients, based on the last 14 days of training and latest check-in in the last 7 days.</p>
          <div className="card tight" role="region" aria-label="Clients needing attention">
            {attention.length === 0 && <Empty icon="check" title="All caught up">{clients.length ? 'Everyone is on track.' : 'Add your first client to get started.'}</Empty>}
            <div className="list">
              {attention.map(({ c, reasons }) => (
                <Link key={c.id} to={`/clients/${c.id}`} className="item">
                  <Avatar name={c.full_name} size={40} />
                  <span className="grow"><span className="title">{c.full_name || 'Unnamed'}</span><br /><span className="meta">{reasons.join(' � ')}</span></span>
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
                  <span className="grow"><span className="title">{nameOf(c.client_id)}</span><br /><span className="meta">{d.workouts[c.workout_id]?.name ?? 'Workout'} � {niceDate(c.date)}</span></span>
                  {c.rating && <span className="badge amber">{'?'.repeat(c.rating)}</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div id="dashboard-inbox" className="section-title" style={{ marginTop: 6, scrollMarginTop: 80 }}><h2>Inbox</h2><Link to="/inbox">Open</Link></div>
          <div className="card tight" role="region" aria-label="Unread conversations">
            {unreadBy.size === 0 && <Empty icon="inbox" title="Inbox zero" />}
            <div className="list">
              {[...unreadBy].map(([id, n]) => {
                const last = d.msgs.find(m => m.client_id === id)!
                return (
                  <Link key={id} to={`/inbox/${id}`} className="item">
                    <Avatar name={nameOf(id)} size={36} />
                    <span className="grow"><span className="title">{nameOf(id)}</span><br /><span className="meta truncate" style={{ display: 'block' }}>{last.body} � {timeAgo(last.created_at)}</span></span>
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
                <div key={s.id} className="item"><span className="grow"><span className="title">{new Date(s.starts_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><br /><span className="meta">{s.title} � {s.duration_min} min</span></span></div>
              ))}
            </div>
          </div>
        </div>
        </div></div>
      </details>
    </>
  )
}

