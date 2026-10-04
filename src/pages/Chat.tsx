import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth'
import { clockTime, niceDate } from '../lib/dates'
import type { Message, Profile } from '../types'
import { Avatar, Empty } from '../components/ui'
import Icon from '../components/Icon'

export function Conversation({ clientId }: { clientId: string }) {
  const { profile } = useAuth()
  const me = profile!.id
  const [msgs, setMsgs] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const end = useRef<HTMLDivElement>(null)

  const markRead = useCallback(async () => {
    await supabase.rpc('mark_conversation_read', { p_client: clientId })
    window.dispatchEvent(new Event('ptpn:read'))
  }, [clientId])

  const load = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').eq('client_id', clientId).order('created_at').limit(300)
    setMsgs((data ?? []) as Message[])
    markRead()
  }, [clientId, markRead])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const ch = supabase.channel('chat-' + clientId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` }, p => {
        const m = p.new as Message
        setMsgs(cur => (cur.some(x => x.id === m.id) ? cur : [...cur, m]))
        if (m.sender_id !== me) markRead()
      })
      .subscribe()
    const t = setInterval(load, 20000) // fallback if realtime is unavailable
    return () => { supabase.removeChannel(ch); clearInterval(t) }
  }, [clientId, me, markRead, load])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs.length])

  async function send(e?: React.FormEvent) {
    e?.preventDefault()
    const body = text.trim()
    if (!body || busy) return
    setBusy(true); setErr('')
    const { data, error } = await supabase.from('messages').insert({ client_id: clientId, sender_id: me, body }).select().single()
    setBusy(false)
    if (error) return setErr(error.message)
    setText('')
    setMsgs(cur => (cur.some(x => x.id === (data as Message).id) ? cur : [...cur, data as Message]))
  }

  return (
    <div className="chat">
      <div className="stream">
        {msgs.length === 0 && <Empty icon="chat" title="No messages yet">Say hello. Messages show up here instantly.</Empty>}
        {msgs.map((m, i) => {
          const day = niceDate(m.created_at.slice(0, 10))
          const sep = i === 0 || day !== niceDate(msgs[i - 1].created_at.slice(0, 10)) ? <div className="day-sep" key={'d' + m.id}>{day}</div> : null
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {sep}
              <div className={'bubble ' + (m.sender_id === me ? 'me' : 'them')}>{m.body}<time>{clockTime(m.created_at)}{m.sender_id === me && m.read_at ? ' · Seen' : ''}</time></div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={send}>
        <textarea rows={1} placeholder="Write a message" value={text} onChange={e => setText(e.target.value)} aria-label="Message"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button className="icon" style={{ flex: 'none' }} disabled={busy || !text.trim()} aria-label="Send"><Icon name="send" size={18} /></button>
      </form>
      {err && <p className="err">{err}</p>}
    </div>
  )
}

export function ClientChat() {
  const { profile } = useAuth()
  return (
    <>
      <div className="page-head"><div><div className="eyebrow">Messages</div><h1>Your coach</h1></div></div>
      <Conversation clientId={profile!.id} />
    </>
  )
}

export function CoachChat() {
  const { clientId } = useParams()
  const [client, setClient] = useState<Profile | null>(null)
  useEffect(() => {
    if (clientId) supabase.from('profiles').select('*').eq('id', clientId).maybeSingle().then(({ data }) => setClient(data as Profile | null))
  }, [clientId])
  if (!clientId) return null
  return (
    <>
      <div className="row nowrap" style={{ marginBottom: 12 }}>
        <Link to="/inbox" className="btn icon" aria-label="Back to inbox"><Icon name="back" size={18} /></Link>
        <Avatar name={client?.full_name ?? ''} size={38} />
        <div className="grow"><b>{client?.full_name || 'Client'}</b><br /><Link to={`/clients/${clientId}`} className="small">View client profile</Link></div>
      </div>
      <Conversation clientId={clientId} />
    </>
  )
}
