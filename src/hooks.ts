import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import type { Profile } from './types'

/** Unread messages sent to me. RLS limits clients to their own conversation; the coach sees all. */
export function useUnread(me: string | undefined) {
  const [count, setCount] = useState(0)
  const { pathname } = useLocation()
  const load = useCallback(async () => {
    if (!me) return
    const { count: c } = await supabase.from('messages').select('id', { count: 'exact', head: true }).is('read_at', null).neq('sender_id', me)
    setCount(c ?? 0)
  }, [me])

  useEffect(() => { load() }, [load, pathname])
  useEffect(() => {
    if (!me) return
    const t = setInterval(load, 30000)
    const ch = supabase.channel('unread-' + me)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => load())
      .subscribe()
    const onRead = () => load()
    window.addEventListener('ptpn:read', onRead)
    return () => { clearInterval(t); supabase.removeChannel(ch); window.removeEventListener('ptpn:read', onRead) }
  }, [me, load])
  return count
}

/** All client profiles (coach only; RLS returns just the caller's own row for clients). */
export function useClients() {
  const [clients, setClients] = useState<Profile[] | null>(null)
  const reload = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'client').order('full_name')
    setClients((data ?? []) as Profile[])
  }, [])
  useEffect(() => { reload() }, [reload])
  return { clients, reload }
}
