import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { localDate, longDay, relDay, weekOf, timeAgo } from '../../lib/dates'
import { firstName, greeting } from '../../lib/util'
import { sum } from '../../lib/nutrition'
import { FORMAT_LABEL } from '../../lib/training'
import type { ClientWorkout, FoodLog, Message, Session, Targets, TasterSession, Workout } from '../../types'
import { MacroBar, PageHead, Ring, Skeleton, Tile } from '../../components/ui'
import { CheckinForm, Habits } from '../../components/Daily'
import Icon from '../../components/Icon'
import WeeklyCheckins from '../../components/WeeklyCheckins'
import ClientOnboarding from '../../components/ClientOnboarding'
import SessionBalance from '../../components/SessionBalance'

export default function Home() {
  const { profile } = useAuth()
  const [today] = useState(() => localDate())
  const [cws, setCws] = useState<ClientWorkout[]>([])
  const [workouts, setWorkouts] = useState<Record<string, Workout>>({})
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [targets, setTargets] = useState<Targets | null>(null)
  const [logs, setLogs] = useState<FoodLog[]>([])
  const [msg, setMsg] = useState<Message | null>(null)
  const [nextSession, setNextSession] = useState<Session | null>(null)
  const [taster, setTaster] = useState<TasterSession | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!profile) return
    let active = true
    const week = weekOf(today)
    ;(async () => {
      setLoadState('loading')
      try {
        const results = await Promise.all([
          supabase.from('client_workouts').select('*').eq('client_id', profile.id).gte('date', week[0]).order('date').limit(40),
          supabase.from('nutrition_targets').select('*').eq('client_id', profile.id).maybeSingle(),
          supabase.from('food_logs').select('*').eq('client_id', profile.id).eq('date', today),
          supabase.from('messages').select('*').neq('sender_id', profile.id).order('created_at', { ascending: false }).limit(1),
          supabase.from('bookings').select('session_id').eq('client_id', profile.id),
          supabase.from('taster_sessions').select('*').eq('client_id', profile.id).order('assessed_on', { ascending: false }).order('created_at', { ascending: false }).limit(1),
        ])
        if (results.some(result => result.error)) throw new Error('home read failed')
        const [cw, t, fl, m, b, ts] = results
        const list = (cw.data ?? []) as ClientWorkout[]
        const ids = [...new Set(list.map(x => x.workout_id))]
        const sessionIds = ((b.data ?? []) as { session_id: string }[]).map(x => x.session_id)
        const [w, it, se] = await Promise.all([
          ids.length ? supabase.from('workouts').select('*').in('id', ids) : Promise.resolve({ data: [], error: null }),
          ids.length ? supabase.from('workout_items').select('workout_id').in('workout_id', ids) : Promise.resolve({ data: [], error: null }),
          sessionIds.length ? supabase.from('sessions').select('*').in('id', sessionIds).gte('starts_at', new Date().toISOString()).order('starts_at').limit(1) : Promise.resolve({ data: [], error: null }),
        ])
        if (w.error || it.error || se.error) throw new Error('home detail read failed')
        if (!active) return
        const counts: Record<string, number> = {}
        for (const row of (it.data ?? []) as { workout_id: string }[]) counts[row.workout_id] = (counts[row.workout_id] ?? 0) + 1
        setCws(list); setTargets(t.data as Targets | null); setLogs((fl.data ?? []) as FoodLog[])
        setMsg(((m.data ?? []) as Message[])[0] ?? null); setTaster(((ts.data ?? []) as TasterSession[])[0] ?? null)
        setWorkouts(Object.fromEntries(((w.data ?? []) as Workout[]).map(x => [x.id, x])))
        setItemCounts(counts); setNextSession(((se.data ?? []) as Session[])[0] ?? null)
        setLoadState('ready')
      } catch {
        if (active) setLoadState('error')
      }
    })()
    return () => { active = false }
  }, [profile, today, retry])

  const week = weekOf(today)
  const todays = cws.filter(c => c.date === today)
  const upcoming = cws.find(c => c.date > today && c.status === 'scheduled')
  const thisWeek = cws.filter(c => c.date >= week[0] && c.date <= week[6])
  const doneWeek = thisWeek.filter(c => c.status === 'done').length
  const eaten = sum(logs)

  if (loadState === 'loading') return <><PageHead eyebrow={longDay(today)} title={`${greeting()}, ${firstName(profile?.full_name ?? '')}`} /><Skeleton n={5} /></>
  if (loadState === 'error') return <><PageHead eyebrow={longDay(today)} title={`${greeting()}, ${firstName(profile?.full_name ?? '')}`} /><section className="card" role="alert"><h2>We could not load your dashboard</h2><p className="mute">Your information has not been replaced or shown as empty. Check your connection and try again.</p><button onClick={() => setRetry(value => value + 1)}>Retry dashboard</button></section></>

  return (
    <>
      <PageHead eyebrow={longDay(today)} title={`${greeting()}, ${firstName(profile?.full_name ?? '')}`} />

      {taster && <div className="card goal-card">
        <span className="eyebrow">My fitness goal</span><h2>{taster.goal}</h2>
        <div className="row"><span className="badge red">Target {new Date(`${taster.target_date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
        {taster.client_summary && <><hr className="sep" /><p className="mute" style={{ margin: 0 }}>{taster.client_summary}</p></>}
        <Link to="/taster-session" className="link" style={{ display: 'inline-block', marginTop: 12 }}>View my taster session </Link>
      </div>}

      {todays.length > 0 ? todays.map(cw => {
        const w = workouts[cw.workout_id]
        const done = cw.status === 'done'
        return (
          <div key={cw.id} className="card hero">
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className={'badge ' + (done ? 'green' : 'red')}>{done ? 'Completed' : "Today's workout"}</span>
              {w && <span className="badge">{FORMAT_LABEL[w.format]}</span>}
            </div>
            <h2 style={{ fontSize: '1.5rem', margin: '6px 0 4px' }}>{w?.name ?? 'Workout'}</h2>
            <p className="mute" style={{ margin: '0 0 14px' }}>
              {itemCounts[cw.workout_id] ?? 0} exercises{w?.duration_min ? ` � about ${w.duration_min} min` : ''}
            </p>
            <Link to={`/workout/${cw.id}?returnTo=%2F`} className={'btn block' + (done ? ' soft' : '')} style={{ minHeight: 50 }}>
              <Icon name={done ? 'check' : 'play'} size={18} />{done ? 'View workout' : 'Start workout'}
            </Link>
          </div>
        )
      }) : (
        <div className="card hero">
          <span className="badge">Rest day</span>
          <h2 style={{ fontSize: '1.4rem', margin: '10px 0 4px' }}>Recover and refuel</h2>
          <p className="mute" style={{ margin: 0 }}>
            {upcoming ? <>Next up: <b style={{ color: 'var(--ink)' }}>{workouts[upcoming.workout_id]?.name ?? 'Workout'}</b> � {relDay(upcoming.date)}</> : 'No workouts scheduled yet. Your coach will add your programme here.'}
          </p>
        </div>
      )}

      <div className="grid g3" style={{ marginBottom: 12 }}>
        <Tile label="This week" value={`${doneWeek}/${thisWeek.length}`} foot="workouts done" />
        {profile && <SessionBalance clientId={profile.id} />}
        <Tile label="Calories" value={Math.round(eaten.kcal)} unit={targets?.kcal ? ` / ${targets.kcal}` : ' kcal'} foot="eaten today" />
      </div>

      <Link to="/nutrition" className="card click" style={{ display: 'flex', gap: 18, alignItems: 'center', color: 'var(--ink)' }}>
        <Ring value={eaten.kcal} max={targets?.kcal ?? 0} size={112} label={Math.round(eaten.kcal)} sub={targets?.kcal ? `of ${targets.kcal} kcal` : 'kcal'} />
        <div className="grow stack" style={{ gap: 12 }}>
          <MacroBar label="Protein" value={eaten.protein} target={targets?.protein ?? null} color="var(--protein)" />
          <MacroBar label="Carbs" value={eaten.carbs} target={targets?.carbs ?? null} color="var(--carbs)" />
          <MacroBar label="Fat" value={eaten.fat} target={targets?.fat ?? null} color="var(--fat)" />
        </div>
      </Link>

      {msg && (
        <Link to="/chat" className="card click" style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--ink)' }}>
          <span className="avatar" style={{ width: 40, height: 40, fontSize: 15 }}><Icon name="chat" size={18} /></span>
          <span className="grow">
            <span className="row between nowrap" style={{ marginBottom: 2 }}><b>Coach</b><span className="mute small">{timeAgo(msg.created_at)}</span></span>
            <span className="mute truncate" style={{ display: 'block' }}>{msg.body}</span>
          </span>
          {!msg.read_at && <span className="dot">1</span>}
        </Link>
      )}

      {nextSession && (
        <Link to="/book" className="card click" style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--ink)' }}>
          <span className="avatar" style={{ width: 40, height: 40 }}><Icon name="calendar" size={18} /></span>
          <span className="grow"><b>{nextSession.title}</b><br /><span className="mute small">{new Date(nextSession.starts_at).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span>
          <Icon name="chev" />
        </Link>
      )}

      <details className="card dashboard-disclosure" open>
        <summary><span><b>Today's coaching actions</b><small>Habits and daily check-in</small></span></summary>
        <div className="dashboard-disclosure-body"><Habits today={today} /><CheckinForm today={today} /></div>
      </details>

      <details className="card dashboard-disclosure">
        <summary><span><b>Progress and coaching profile</b><small>Weekly review and setup information</small></span></summary>
        <div className="dashboard-disclosure-body">{profile && <WeeklyCheckins clientId={profile.id} />}{profile && <ClientOnboarding key={profile.id} clientId={profile.id} />}</div>
      </details>
    </>
  )
}

