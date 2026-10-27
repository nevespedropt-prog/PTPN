import { useCallback, useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from './auth'
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

const pageTabs = new Map<string, string>()

/** Remember navigation tabs in this browser tab, separately for each account/page/section. */
export function usePageTab<T extends string | number>(scope: string, allowed: readonly T[], initial: T, param = 'tab', preferInitial = false): [T, (next: T) => void] {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const [search, setSearch] = useSearchParams()
  const key = 'ptpn:tab:' + (profile?.id ?? 'guest') + ':' + pathname + ':' + scope
  const requested = search.get(param)
  let remembered: string | null = pageTabs.get(key) ?? null
  try { remembered ??= sessionStorage.getItem(key) } catch { /* URL navigation still works when storage is blocked. */ }
  const requestedValue = allowed.find(option => String(option) === requested)
  const rememberedValue = allowed.find(option => String(option) === remembered)
  const value = requestedValue ?? (requested !== null || preferInitial ? initial : rememberedValue ?? initial)
  useEffect(() => {
    pageTabs.set(key, String(value))
    try { sessionStorage.setItem(key, String(value)) } catch { /* Optional navigation preference only. */ }
  }, [key, value])
  const select = (next: T) => {
    if (!allowed.includes(next)) return
    pageTabs.set(key, String(next))
    try { sessionStorage.setItem(key, String(next)) } catch { /* Keep navigation usable. */ }
    setSearch(previous => { const params = new URLSearchParams(previous); params.set(param, String(next)); return params }, { replace: true })
  }
  return [value, select]
}

/** Detail pages return to their explicit origin, with a safe internal fallback. */
export function useReturnTo(fallback: string): string {
  const { state } = useLocation()
  const target = state?.returnTo
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') && !target.includes('\\')
    ? target : fallback
}
