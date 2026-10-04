import type { ClientWorkout, OneRepMax, WorkoutFormat, WorkoutItem } from '../types'
import { latestMax, loadKg } from './oneRepMax'

export const FORMAT_LABEL: Record<WorkoutFormat, string> = {
  standard: 'Straight sets', circuit: 'Circuit', amrap: 'AMRAP', emom: 'EMOM', intervals: 'Intervals',
}

export const prescription = (it: WorkoutItem) => {
  const parts: string[] = []
  if (it.sets && it.reps) parts.push(`${it.sets} × ${it.reps}`)
  else if (it.sets) parts.push(`${it.sets} sets`)
  else if (it.reps) parts.push(it.reps)
  if (it.percent_1rm) parts.push(`@ ${Number(it.percent_1rm)}%`)
  else if (it.load) parts.push(`@ ${it.load}`)
  if (it.tempo) parts.push(`tempo ${it.tempo}`)
  return parts.join(' ')
}

export const workingLoad = (it: WorkoutItem, maxes: OneRepMax[]) => {
  if (!it.percent_1rm) return null
  const m = latestMax(it.exercise_name, maxes)
  return m ? loadKg(Number(it.percent_1rm), Number(m.weight_kg)) : undefined
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
      const it = itemsById.get(itemId)
      if (!it) continue
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
