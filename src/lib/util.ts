export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

export const initials = (name: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?'

/** Stable hue from a string, for avatars and recipe art. */
export const hue = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h }

export const firstName = (name: string) => (name || '').trim().split(/\s+/)[0] || 'there'

export const r1 = (n: number) => Math.round(n * 10) / 10

export const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0)

export const fmtSeconds = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export const demoUrl = (name: string, url?: string) =>
  url || `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' exercise form')}`
