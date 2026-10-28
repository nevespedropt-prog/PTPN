import type { ClientWorkout, OneRepMax, SetLog, SetStyle, WorkoutFormat, WorkoutItem } from '../types'
import { latestMax, loadKg } from './oneRepMax'

export const FORMAT_LABEL: Record<WorkoutFormat, string> = {
  standard: 'Sets', circuit: 'Circuit', amrap: 'AMRAP', emom: 'EMOM', intervals: 'Intervals',
}


/** Coaching instructions shown wherever a workout format is selected or performed. */
export const FORMAT_DESCRIPTION: Record<WorkoutFormat, string> = {
  standard: 'Build the session with any combination of single sets, supersets and tri-sets. Each exercise block follows its own rest rule.',
  circuit: 'Complete each exercise in sequence to finish one round. Take the prescribed rest, then repeat the circuit for the planned rounds.',
  amrap: 'Complete as many rounds as possible within the chosen time cap. Follow the exercise order and record the full rounds you complete.',
  emom: 'Start the prescribed exercise at the beginning of each minute. Finish the work, rest for the remainder of that minute, then start the next exercise on the next minute.',
  intervals: 'Alternate work and recovery periods. Complete the prescribed work effort, take the planned recovery, then repeat for the scheduled intervals.',
}

export const SET_STYLE_LABEL: Record<SetStyle, string> = { single: 'Single set', superset: 'Superset', triset: 'Tri-set' }
export const SET_STYLE_SIZE: Record<SetStyle, number> = { single: 1, superset: 2, triset: 3 }

export function setBlocks<T extends { set_style: SetStyle; group_label: string }>(items: T[]): { style: SetStyle; label: string; items: T[] }[] {
  const blocks: { style: SetStyle; label: string; items: T[] }[] = []
  for (const item of items) {
    const key = item.group_label || `single-${blocks.length}`
    const last = blocks[blocks.length - 1]
    if (last && last.label === key && last.style === item.set_style) last.items.push(item)
    else blocks.push({ style: item.set_style, label: key, items: [item] })
  }
  return blocks
}

export function normaliseSetRests<T extends { set_style: SetStyle; group_label: string; rest_sec: number | null }>(items: T[]): T[] {
  const next = items.map(item => ({ ...item }))
  for (const block of setBlocks(next)) {
    if (block.style === 'single') continue
    block.items.forEach((item, i) => {
      item.rest_sec = i === block.items.length - 1 && block.items.length === SET_STYLE_SIZE[block.style]
        ? item.rest_sec != null && item.rest_sec >= 60 && item.rest_sec <= 90 ? item.rest_sec : 75
        : 0
    })
  }
  return next
}

export function setStyleValidation(items: { set_style: SetStyle; group_label: string; rest_sec: number | null }[]): string {
  for (const block of setBlocks(items)) {
    const required = SET_STYLE_SIZE[block.style]
    if (block.items.length !== required) return `${SET_STYLE_LABEL[block.style]} blocks need exactly ${required} exercise${required === 1 ? '' : 's'}. Complete or remove the unfinished block.`
    if (block.style === 'single') continue
    if (block.items.slice(0, -1).some(item => (item.rest_sec ?? 0) !== 0)) return `${SET_STYLE_LABEL[block.style]} exercises must be back-to-back with no rest before the final exercise.`
    const rest = block.items[block.items.length - 1].rest_sec
    if (rest == null || rest < 60 || rest > 90) return `Rest after the final ${SET_STYLE_LABEL[block.style].toLowerCase()} exercise must be between 60 and 90 seconds.`
  }
  return ''
}

// ---------- weight ----------
/** The Weight text for an item. Old rows only have percent_1rm, so fall back to that as "75%". */
export const weightOf = (it: Pick<WorkoutItem, 'weight' | 'percent_1rm'>) =>
  it.weight?.trim() || (it.percent_1rm ? `${Number(it.percent_1rm)}%` : '')

export type ParsedWeight = { kind: 'kg'; kg: number } | { kind: 'percent'; percent: number } | { kind: 'text'; text: string } | { kind: 'none' }
/** "80" or "80 kg" is kilos, "75%" is a percent of the client's max, anything else is shown as typed. */
export function parseWeight(raw: string): ParsedWeight {
  const t = raw.trim()
  if (!t) return { kind: 'none' }
  const pct = t.match(/^(\d+(?:[.,]\d+)?)\s*%$/)
  if (pct) return { kind: 'percent', percent: Number(pct[1].replace(',', '.')) }
  const kg = t.match(/^(\d+(?:[.,]\d+)?)\s*(?:kg|kgs)?$/i)
  if (kg) return { kind: 'kg', kg: Number(kg[1].replace(',', '.')) }
  return { kind: 'text', text: t }
}

// ---------- cardio ----------
export type CardioField = 'sets' | 'time' | 'distance' | 'speed' | 'rest'
/** Which cardio fields make sense for each workout style. */
export const CARDIO_FIELDS: Record<WorkoutFormat, CardioField[]> = {
  standard: ['sets', 'time', 'distance', 'speed', 'rest'],
  intervals: ['sets', 'time', 'speed', 'rest'],  // work time and speed per interval, with rest between
  emom: ['sets', 'time', 'speed'],               // fixed minute, how fast
  amrap: ['time', 'distance'],                   // fixed time, how far
  circuit: ['time', 'distance'],                 // a station: time or distance
}
export const CARDIO_STYLE_HINT: Record<WorkoutFormat, string> = {
  standard: 'Follow the rest rule shown for this exercise block.',
  intervals: 'Repeat the work effort and prescribed recovery for each interval.',
  emom: 'Start on the minute and rest for the remainder before the next effort.',
  amrap: 'Complete this target on each round until the workout time cap.',
  circuit: 'Complete this station, continue to the next, then repeat the circuit.',
}

/** Build the exercise blocks implied by the selected workout format. */
export function formatGroups(items: WorkoutItem[], format: WorkoutFormat) {
  const sorted = [...items].sort((a, b) => a.sort - b.sort)
  if (format === 'standard') {
    let superset = 0, triset = 0
    return setBlocks(sorted).map(block => ({
      label: block.style === 'single' ? 'Single set' : block.style === 'superset' ? `Superset ${++superset}` : `Tri-set ${++triset}`,
      items: block.items,
    }))
  }
  if (format === 'circuit' || format === 'amrap') return sorted.length ? [{ label: format === 'amrap' ? 'AMRAP sequence' : 'Circuit', items: sorted }] : []
  if (format === 'emom') return sorted.map((item, i) => ({ label: `Minute ${i + 1}`, items: [item] }))
  if (format === 'intervals') return sorted.map((item, i) => ({ label: `Interval ${i + 1}`, items: [item] }))
  return groupItems(sorted)
}

/** "20:00", "1:30:00", "90s", "20 min" or a plain number (minutes) to minutes. */
export function parseMinutes(raw: string | undefined): number | null {
  const t = (raw ?? '').trim().toLowerCase()
  if (!t) return null
  let m = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/)
  if (m) return m[3] !== undefined ? Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60 : Number(m[1]) + Number(m[2]) / 60
  m = t.match(/^(\d+(?:[.,]\d+)?)\s*(s|sec|secs|seconds?)$/)
  if (m) return Number(m[1].replace(',', '.')) / 60
  m = t.match(/^(\d+(?:[.,]\d+)?)\s*(m|min|mins|minutes?)?$/)
  if (m) return Number(m[1].replace(',', '.'))
  return null
}
export function fmtMinutes(min: number): string {
  const total = Math.round(min * 60), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
const num = (v: string | undefined) => { const n = parseFloat((v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null }
const round1 = (n: number) => String(Math.round(n * 10) / 10)

/** When two of time, distance and speed are known, fill the third. Never overwrites something the client typed. */
export function fillCardio(s: SetLog): SetLog {
  const min = parseMinutes(s.time), km = num(s.distance), kmh = num(s.speed)
  const out = { ...s }
  if (min && km && !kmh) out.speed = round1(km / (min / 60))
  else if (km && kmh && !min) out.time = fmtMinutes((km / kmh) * 60)
  else if (min && kmh && !km) out.distance = round1(kmh * (min / 60))
  return out
}

export const cardioPrescription = (it: WorkoutItem, format: WorkoutFormat) => {
  const f = CARDIO_FIELDS[format]
  const parts: string[] = []
  if (f.includes('sets') && it.sets && it.sets > 1) parts.push(`${it.sets} ×`)
  if (it.cardio_time) parts.push(it.cardio_time.includes(':') || /[a-z]/i.test(it.cardio_time) ? it.cardio_time : `${it.cardio_time} min`)
  if (it.cardio_distance_km) parts.push(`${Number(it.cardio_distance_km)} km`)
  if (it.cardio_speed_kmh) parts.push(`@ ${Number(it.cardio_speed_kmh)} km/h`)
  if (f.includes('rest') && it.rest_sec) parts.push(`rest ${it.rest_sec} s`)
  if (it.reps) parts.push(it.reps)
  return parts.join(' ')
}

// ---------- strength ----------
export const prescription = (it: WorkoutItem) => {
  const parts: string[] = []
  if (it.sets && it.reps) parts.push(`${it.sets} × ${it.reps}`)
  else if (it.sets) parts.push(`${it.sets} sets`)
  else if (it.reps) parts.push(it.reps)
  const w = weightOf(it)
  if (w) parts.push(parseWeight(w).kind === 'kg' ? `@ ${w.replace(/\s*kgs?$/i, '')} kg` : `@ ${w}`)
  if (it.tempo && !/^burpees?$/i.test(it.exercise_name.trim())) parts.push(`tempo ${it.tempo}`)
  if (it.rest_sec != null) parts.push(`rest ${it.rest_sec} s`)
  return parts.join(' ')
}

/** Working weight in kg: from a percent of the client's max (undefined when no max is recorded), or the kg typed in Weight. */
export const workingLoad = (it: WorkoutItem, maxes: OneRepMax[]) => {
  const pw = parseWeight(weightOf(it))
  if (pw.kind === 'kg') return pw.kg
  if (pw.kind !== 'percent') return null
  const m = latestMax(it.exercise_name, maxes)
  return m ? loadKg(pw.percent, Number(m.weight_kg)) : undefined
}

/** Groups consecutive items sharing a non-empty group_label (supersets / circuits). */
export function groupItems(items: WorkoutItem[]) {
  const sorted = [...items].sort((a, b) => a.sort - b.sort)
  const groups: { label: string; items: WorkoutItem[] }[] = []
  for (const it of sorted) {
    const last = groups[groups.length - 1]
    if (it.group_label && last && last.label === it.group_label) last.items.push(it)
    else groups.push({ label: it.group_label, items: [it] })
  }
  return groups
}

/** Epley estimate. */
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : Math.round(kg * (1 + reps / 30) * 10) / 10)

export interface PR { exercise: string; kg: number; reps: number; e1rm: number; date: string }

/** Best estimated 1RM per exercise across completed workouts. */
export function personalRecords(done: ClientWorkout[], itemsById: Map<string, WorkoutItem>): PR[] {
  const best = new Map<string, PR>()
  for (const cw of done) {
    for (const [itemId, sets] of Object.entries(cw.log?.items ?? {})) {
      const choice = cw.log?.exercise_choices?.[itemId]
      const it = choice?.item ?? itemsById.get(itemId)
      if (!it || choice?.is_cardio) continue
      for (const s of sets) {
        const kg = parseFloat(s.kg), reps = parseInt(s.reps)
        if (!s.done || !(kg > 0) || !(reps > 0)) continue
        const est = e1rm(kg, reps)
        const key = it.exercise_name.trim().toLowerCase()
        const cur = best.get(key)
        if (!cur || est > cur.e1rm) best.set(key, { exercise: it.exercise_name, kg, reps, e1rm: est, date: cw.date })
      }
    }
  }
  return [...best.values()].sort((a, b) => b.e1rm - a.e1rm)
}

export const setsDone = (cw: ClientWorkout) =>
  Object.values(cw.log?.items ?? {}).reduce((n, sets) => n + sets.filter(s => s.done).length, 0)

export const volumeKg = (cw: ClientWorkout) =>
  Object.values(cw.log?.items ?? {}).reduce((v, sets) => v + sets.reduce((a, s) => a + (s.done ? (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0) : 0), 0), 0)

