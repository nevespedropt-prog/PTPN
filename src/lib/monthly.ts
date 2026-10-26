import type { ClientWorkout, Measurement } from '../types'

/** Calendar arithmetic avoids timezone/DST shifts at month boundaries. */
export function shiftMonth(month: string, offset: number): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month')
  const [year, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, m - 1 + offset, 1, 12))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}
export function monthWindow(month: string, today: string) {
  const start = month + '-01'
  const next = shiftMonth(month, 1) + '-01'
  if (start > today) throw new Error('Future reports are not available')
  const last = new Date(Date.parse(next + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
  return { start, end: last < today ? last : today, previous: shiftMonth(month, -1) + '-01', partial: today.slice(0, 7) === month }
}
type Point = { x: string; y: number }
const dayNumber = (date: string) => Date.parse(date + 'T12:00:00Z') / 86400000
const validWeight = (v: number | null) => v != null && Number.isFinite(Number(v)) && Number(v) > 0
const validFat = (v: number | null) => v != null && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100

function dailyValues(rows: Measurement[], key: 'weight_kg' | 'body_fat_pct'): Point[] {
  const byDay = new Map<string, number[]>()
  for (const row of rows) {
    const value = row[key]
    if (!(key === 'weight_kg' ? validWeight(value) : validFat(value))) continue
    const values = byDay.get(row.date) ?? []
    values.push(Number(value)); byDay.set(row.date, values)
  }
  return [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([x, ys]) => ({ x, y: ys.reduce((a, b) => a + b, 0) / ys.length }))
}
export function monthlySummary(workouts: ClientWorkout[], measurements: Measurement[], start: string, end: string) {
  const due = workouts.filter(w => w.date >= start && w.date <= end)
  const done = due.filter(w => w.status === 'done')
  const allWeights = dailyValues(measurements, 'weight_kg').filter(p => p.x <= end)
  const weights = allWeights.filter(p => p.x >= start)
  const trend = weights.map(p => {
    const days = allWeights.filter(q => dayNumber(p.x) - dayNumber(q.x) >= 0 && dayNumber(p.x) - dayNumber(q.x) <= 6)
    return { x: p.x, y: Math.round(days.reduce((n, q) => n + q.y, 0) / days.length * 10) / 10 }
  })
  const fat = dailyValues(measurements, 'body_fat_pct').filter(p => p.x >= start && p.x <= end).map(p => ({ ...p, y: Math.round(p.y * 10) / 10 }))
  return { due: due.length, done: done.length, trainingDays: new Set(done.map(w => w.date)).size, weights, trend, fat }
}
