import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { useClients } from '../../hooks'
import { timeAgo } from '../../lib/dates'
import type { Message } from '../../types'
import { Avatar, Empty, PageHead, Skeleton } from '../../components/ui'

export default function Inbox() {
  const { profile } = useAuth()
  const { clients } = useClients()
  const [msgs, setMsgs] = useState<Message[] | null>(null)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(500)
    setMsgs((data ?? []) as Message[])
  }, [])
  useEffect(() => {
    load()
    const ch = supabase.channel('inbox').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => load()).subscribe()
    const t = setInterval(load, 30000)
    return () => { supabase.removeChannel(ch); clearInterval(t) }
  }, [load])

  if (!clients || !msgs) return <><PageHead eyebrow="Messages" title="Inbox" /><Skeleton n={4} /></>

  const rows = clients.map(c => {
    const mine = msgs.filter(m => m.client_id === c.id)
    return { c, last: mine[0], unread: mine.filter(m => !m.read_at && m.sender_id !== profile!.id).length }
  }).filter(r => (r.c.full_name || '').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? ''))

  return (
    <>
      <PageHead eyebrow="Messages" title="Inbox" />
      <input placeholder="Search clients" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      {rows.length === 0 && <div className="card"><Empty icon="inbox" title="No clients yet" /></div>}
      {rows.length > 0 && <div className="card tight"><div className="list">
        {rows.map(({ c, last, unread }) => (
          <Link key={c.id} to={`/inbox/${c.id}`} className="item">
            <Avatar name={c.full_name} size={44} />
            <span className="grow">
              <span className="row between nowrap" style={{ marginBottom: 0 }}><span className="title">{c.full_name || 'Unnamed'}</span>{last && <span className="mute small">{timeAgo(last.created_at)}</span>}</span>
              <span className="meta truncate" style={{ display: 'block', color: unread ? 'var(--ink)' : undefined }}>{last ? `${last.sender_id === profile!.id ? 'You: ' : ''}${last.body}` : 'No messages yet'}</span>
            </span>
            {unread > 0 && <span className="dot">{unread}</span>}
          </Link>
        ))}
      </div></div>}
    </>
  )
}
