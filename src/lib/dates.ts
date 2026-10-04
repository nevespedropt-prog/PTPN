// Local calendar date as YYYY-MM-DD (not UTC, so "today" matches the user's wall clock).
export const localDate = (d: Date = new Date()) => d.toLocaleDateString('en-CA')

const parse = (iso: string) => new Date(iso + 'T12:00:00')

export const addDays = (iso: string, n: number) => { const d = parse(iso); d.setDate(d.getDate() + n); return localDate(d) }

export const lastDays = (n: number) =>
  Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return localDate(d) })

/** 1 = Monday ... 7 = Sunday */
export const weekday = (iso: string) => ((parse(iso).getDay() + 6) % 7) + 1

export const startOfWeek = (iso: string) => addDays(iso, 1 - weekday(iso))

export const weekOf = (iso: string) => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(iso), i))

export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000)

export const shortDay = (iso: string) => parse(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })

export const longDay = (iso: string) => parse(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

export const niceDate = (iso: string) => parse(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const dayParts = (iso: string) => {
  const d = parse(iso)
  return { w: d.toLocaleDateString('en-GB', { weekday: 'short' }), n: d.getDate() }
}

export const relDay = (iso: string) => {
  const diff = daysBetween(localDate(), iso)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return shortDay(iso)
}

export const timeAgo = (ts: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(ts).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export const clockTime = (ts: string) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
