import type { OneRepMax } from '../types'

const norm = (s: string) => s.trim().toLowerCase()

/** `maxes` must be sorted newest first; returns the most recent max for that exercise name. */
export const latestMax = (exercise: string, maxes: OneRepMax[]) => maxes.find(m => norm(m.exercise) === norm(exercise))

/** Working weight for a percentage of a 1RM, rounded to the nearest 2.5 kg plate step. */
export const loadKg = (percent: number, max: number) => Math.round((percent / 100) * max / 2.5) * 2.5

export const sortMaxes = (rows: OneRepMax[]) => [...rows].sort((a, b) => b.date.localeCompare(a.date))
