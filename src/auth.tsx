import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session as AuthSession } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Profile } from './types'

interface AuthState { session: AuthSession | null; profile: Profile | null; loading: boolean }
const Ctx = createContext<AuthState>({ session: null, profile: null, loading: true })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {  setSession(data.session); if (!data.session) setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (!s) { setProfile(null); setLoading(false) } })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    // The last known profile lets the app open with no connection instead of showing "No profile found".
    const key = `ptpn-profile-${userId}`
    const cached = () => { try { const c = localStorage.getItem(key); return c ? (JSON.parse(c) as Profile) : null } catch { return null } }
    // With no connection the request retries for several seconds, so open straight from the saved copy.
    if (!navigator.onLine) { const c = cached(); if (c) { setProfile(c); setLoading(false) } }
    Promise.resolve(supabase.from('profiles').select('*').eq('id', userId).single())
      .then(({ data, error }) => { 
        if (data) { try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* storage full or blocked */ } setProfile(data as Profile) }
        else setProfile(error && !error.code ? cached() : null) // no error code means the request never reached the server
        setLoading(false)
      })
      .catch(() => { setProfile(cached()); setLoading(false) })
  }, [userId])

  return <Ctx.Provider value={{ session, profile, loading }}>{children}</Ctx.Provider>
}
