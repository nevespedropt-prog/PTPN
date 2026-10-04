// Local calendar date as YYYY-MM-DD (not UTC, so "today" matches the user's wall clock).
export const localDate = (d: Date = new Date()) => d.toLocaleDateString('en-CA')

export const lastDays = (n: number) =>
  Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return localDate(d) })

export const shortDay = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })

export const dayParts = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  return { w: d.toLocaleDateString('en-GB', { weekday: 'short' }), n: d.getDate() }
}
