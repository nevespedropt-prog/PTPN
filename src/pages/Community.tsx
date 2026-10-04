import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import { addDays, daysBetween, localDate, niceDate, timeAgo } from '../lib/dates'
import { pct } from '../lib/util'
import type { Challenge, Post } from '../types'
import { Avatar, Empty, PageHead, Seg, Sheet, Skeleton } from '../components/ui'
import Icon from '../components/Icon'

function Feed() {
  const { profile } = useAuth()
  const coach = profile?.role === 'coach'
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [when, setWhen] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('posts').select('*').order('pinned', { ascending: false }).order('publish_at', { ascending: false }).limit(50)
    setPosts((data ?? []) as Post[])
  }, [])
  useEffect(() => { load() }, [load])

  async function post(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('posts').insert({ author_id: profile!.id, body: body.trim(), pinned, publish_at: when ? new Date(when).toISOString() : new Date().toISOString() })
    if (error) return setErr(error.message)
    setBody(''); setPinned(false); setWhen(''); load()
  }
  async function remove(id: string) { if (confirm('Delete this post?')) { await supabase.from('posts').delete().eq('id', id); load() } }
  async function togglePin(p: Post) { await supabase.from('posts').update({ pinned: !p.pinned }).eq('id', p.id); load() }

  return (
    <>
      {coach && (
        <form className="card stack" onSubmit={post}>
          <textarea rows={3} placeholder="Share an update, tip or announcement with your clients" value={body} onChange={e => setBody(e.target.value)} required maxLength={4000} />
          <div className="row" style={{ marginBottom: 0 }}>
            <label className="row small mute" style={{ marginBottom: 0 }}><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> Pin to top</label>
            <label className="row small mute grow" style={{ marginBottom: 0 }}>Schedule <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={{ minHeight: 38, maxWidth: 210 }} /></label>
            <button>{when ? 'Schedule' : 'Post'}</button>
          </div>
          {err && <span className="err">{err}</span>}
        </form>
      )}
      {!posts && <Skeleton n={3} />}
      {posts && posts.length === 0 && <div className="card"><Empty icon="megaphone" title="No announcements yet">{coach ? 'Post your first update above.' : 'Your coach will post updates here.'}</Empty></div>}
      {posts && posts.length > 0 && (
        <div className="card">
          {posts.map(p => (
            <div key={p.id} className="post">
              <div className="row nowrap" style={{ marginBottom: 0 }}>
                <Avatar name="Coach" size={34} />
                <div className="grow"><b>Coach</b> <span className="mute small">· {new Date(p.publish_at) > new Date() ? `Scheduled ${niceDate(p.publish_at.slice(0, 10))}` : timeAgo(p.publish_at)}</span></div>
                {p.pinned && <span className="badge amber">Pinned</span>}
              </div>
              <p>{p.body}</p>
              {coach && <div className="row" style={{ marginTop: 8, marginBottom: 0 }}><button className="link" onClick={() => togglePin(p)}>{p.pinned ? 'Unpin' : 'Pin'}</button><button className="link" onClick={() => remove(p.id)}>Delete</button></div>}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

interface Row { client_id: string; display_name: string; total: number }

function ChallengeSheet({ c, onClose }: { c: Challenge; onClose: () => void }) {
  const { profile } = useAuth()
  const coach = profile?.role === 'coach'
  const [board, setBoard] = useState<Row[] | null>(null)
  const [mine, setMine] = useState(0)
  const [value, setValue] = useState('')
  const [err, setErr] = useState('')
  const today = localDate()
  const active = c.start_date <= today && today <= c.end_date

  const load = useCallback(async () => {
    const [b, m] = await Promise.all([
      supabase.rpc('challenge_leaderboard', { p_challenge: c.id }),
      coach ? Promise.resolve({ data: [] }) : supabase.from('challenge_entries').select('value').eq('challenge_id', c.id).eq('client_id', profile!.id),
    ])
    setBoard(((b.data ?? []) as Row[]).map(r => ({ ...r, total: Number(r.total) })))
    setMine(((m.data ?? []) as { value: number }[]).reduce((n, r) => n + Number(r.value), 0))
  }, [c.id, coach, profile])
  useEffect(() => { load() }, [load])

  async function log(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const { data: ex } = await supabase.from('challenge_entries').select('id, value').eq('challenge_id', c.id).eq('client_id', profile!.id).eq('date', today).maybeSingle()
    const add = Number(value)
    const { error } = ex
      ? await supabase.from('challenge_entries').update({ value: Number(ex.value) + add }).eq('id', ex.id)
      : await supabase.from('challenge_entries').insert({ challenge_id: c.id, client_id: profile!.id, date: today, value: add })
    if (error) return setErr(error.message)
    setValue(''); load()
  }
  async function del() { if (confirm('Delete this challenge and all entries?')) { await supabase.from('challenges').delete().eq('id', c.id); onClose() } }

  return (
    <div className="stack">
      <p className="mute" style={{ margin: 0 }}>{c.description}</p>
      <p className="small mute" style={{ margin: 0 }}>{niceDate(c.start_date)} to {niceDate(c.end_date)}{c.goal ? ` · Goal ${c.goal.toLocaleString()} ${c.unit}` : ''}</p>
      {!coach && active && (
        <form className="row nowrap" onSubmit={log} style={{ marginBottom: 0 }}>
          <input type="number" min="0" step="any" inputMode="decimal" placeholder={`Add ${c.unit || 'amount'} for today`} value={value} onChange={e => setValue(e.target.value)} required />
          <button style={{ flex: 'none' }}>Log</button>
        </form>
      )}
      {!coach && <p className="small" style={{ margin: 0 }}>Your total: <b>{mine.toLocaleString()} {c.unit}</b>{c.goal ? ` (${pct(mine, Number(c.goal))}% of goal)` : ''}</p>}
      {err && <span className="err">{err}</span>}
      <h3>Leaderboard</h3>
      {!board && <Skeleton n={2} />}
      {board && board.length === 0 && <p className="mute">No entries yet. Be the first.</p>}
      <div>
        {board?.map((r, i) => (
          <div key={r.client_id} className={`leader top${i + 1}` + (r.client_id === profile?.id ? ' me' : '')}>
            <span className="rank">{i + 1}</span><Avatar name={r.display_name} size={34} />
            <b className="grow">{r.display_name}{r.client_id === profile?.id ? ' (you)' : ''}</b>
            <span className="num" style={{ fontWeight: 700 }}>{r.total.toLocaleString()} <span className="mute small">{c.unit}</span></span>
          </div>
        ))}
      </div>
      {coach && <button className="danger" onClick={del}>Delete challenge</button>}
    </div>
  )
}

function Challenges() {
  const { profile } = useAuth()
  const coach = profile?.role === 'coach'
  const [rows, setRows] = useState<Challenge[] | null>(null)
  const [open, setOpen] = useState<Challenge | null>(null)
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ name: '', description: '', unit: '', goal: '', start_date: localDate(), end_date: addDays(localDate(), 14) })
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('challenges').select('*').order('end_date', { ascending: false })
    setRows((data ?? []) as Challenge[])
  }, [])
  useEffect(() => { load() }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('challenges').insert({ ...f, goal: f.goal ? Number(f.goal) : null, created_by: profile!.id })
    if (error) return setErr(error.message)
    setAdding(false); load()
  }
  const today = localDate()
  const status = (c: Challenge) => (c.end_date < today ? 'Ended' : c.start_date > today ? 'Upcoming' : `${daysBetween(today, c.end_date)} days left`)

  return (
    <>
      {coach && <button className="soft block" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}><Icon name="plus" size={18} />New challenge</button>}
      {!rows && <Skeleton n={2} />}
      {rows && rows.length === 0 && <div className="card"><Empty icon="trophy" title="No challenges yet">{coach ? 'Create one to get your clients competing.' : 'Challenges from your coach will show up here.'}</Empty></div>}
      <div className="g-auto">
        {rows?.map(c => (
          <div key={c.id} className="card click" onClick={() => setOpen(c)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setOpen(c) }}>
            <div className="row between"><span className={'badge ' + (c.end_date < today ? '' : 'red')}>{status(c)}</span><Icon name="trophy" size={18} /></div>
            <h2 style={{ margin: '4px 0' }}>{c.name}</h2>
            <p className="mute small" style={{ margin: 0 }}>{c.description}</p>
          </div>
        ))}
      </div>
      <Sheet open={!!open} onClose={() => { setOpen(null); load() }} title={open?.name ?? ''}>{open && <ChallengeSheet c={open} onClose={() => { setOpen(null); load() }} />}</Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)} title="New challenge">
        <form className="stack" onSubmit={create}>
          <input placeholder="Name, e.g. October steps" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required />
          <textarea rows={2} placeholder="What is it about?" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          <div className="inline-inputs">
            <label className="field">Unit<input placeholder="steps, km, reps" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} /></label>
            <label className="field">Goal (optional)<input type="number" min="1" value={f.goal} onChange={e => setF({ ...f, goal: e.target.value })} /></label>
            <label className="field">Starts<input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} required /></label>
            <label className="field">Ends<input type="date" value={f.end_date} min={f.start_date} onChange={e => setF({ ...f, end_date: e.target.value })} required /></label>
          </div>
          <button>Create challenge</button>
          {err && <span className="err">{err}</span>}
        </form>
      </Sheet>
    </>
  )
}

export default function Community() {
  const [tab, setTab] = useState<'feed' | 'challenges'>('feed')
  return (
    <>
      <PageHead eyebrow="Community" title="Community" />
      <Seg value={tab} onChange={setTab} options={[{ value: 'feed', label: 'Announcements' }, { value: 'challenges', label: 'Challenges' }]} />
      {tab === 'feed' ? <Feed /> : <Challenges />}
    </>
  )
}
