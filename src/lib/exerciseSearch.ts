import type { Exercise } from '../types'

// Words coaches type that are not a substring of the muscle label ("calf" vs "Calves").
const ALIAS: Record<string, string> = { calf: 'calves', abs: 'core', abdominals: 'core', abdominal: 'core', pecs: 'chest', pec: 'chest', lats: 'back', lat: 'back', delts: 'shoulders', delt: 'shoulders', hams: 'hamstrings', hammies: 'hamstrings', glute: 'glutes', quad: 'quads' }

const hit = (text: string, token: string) => text.includes(token) || (ALIAS[token] !== undefined && text.includes(ALIAS[token]))

/**
 * Search the library by name, muscle, equipment or type. Every typed word has to match one of them, so "bicep" finds every
 * biceps exercise whatever it is called, and "bicep cable" narrows it. Exercises for the typed muscle come first, then the
 * ones whose name starts with what was typed, then the rest.
 */
export function searchExercises<T extends Pick<Exercise, 'name' | 'muscle' | 'equipment' | 'category'>>(rows: T[], query: string): T[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return rows
  const scored: { row: T; rank: number }[] = []
  for (const row of rows) {
    const name = row.name.toLowerCase(), muscle = row.muscle.toLowerCase()
    const all = `${name} ${muscle} ${row.equipment.toLowerCase()} ${row.category.toLowerCase()}`
    if (!tokens.every(t => hit(all, t))) continue
    const muscleHit = tokens.some(t => hit(muscle, t))
    scored.push({ row, rank: muscleHit ? 0 : name.startsWith(tokens[0]) ? 1 : 2 })
  }
  return scored.sort((a, b) => a.rank - b.rank || a.row.name.localeCompare(b.row.name)).map(s => s.row)
}
