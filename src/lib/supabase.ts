import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

// Empty or malformed values (e.g. unset GitHub variables) must show the setup
// message instead of crashing createClient on load.
function validUrl(value: string | undefined) {
  try { return Boolean(value && /^https?:$/.test(new URL(value).protocol)) } catch { return false }
}

export const configured = validUrl(url) && Boolean(key)
export const supabase = createClient(configured ? url! : 'http://localhost', configured ? key! : 'missing')
