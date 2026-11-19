import type { Exercise } from '../types'

// Words coaches type that are not a substring of the muscle label ("calf" vs "Calves").
const ALIAS: Record<string, string> = { calf: 'calves', abs: 'core', abdominals: 'core', abdominal: 'core', pecs: 'chest', pec: 'chest', lats: 'back', lat: 'back', delts: 'shoulders', delt: 'shoulders', hams: 'hamstrings', hammies: 'hamstrings', glute: 'glutes', quad: 'quads' }

// Everyday and alternative gym names, so what people type finds the standard machine.
const PHRASES: [RegExp, string][] = [
  [/\bleg curls?\b/g, 'hamstring curl'],
  [/\b(butterfly|pec ?fly|peck? ?deck|pec ?dec|chest fly) ?(machine)?\b/g, 'pec deck'],
  [/\blat pull ?downs?( machine)?\b/g, 'lat pulldown'],
  [/\b(quad|thigh) (machine|extension)s?\b/g, 'leg extension'],
  [/\bcalf (machine|press)\b/g, 'calf raise'],
  [/\bshoulder machine\b/g, 'shoulder press'],
  [/\bchest machine\b/g, 'chest press'],
  [/\bouter thigh( machine)?\b|\bhip abductor\b/g, 'hip abduction'],
  [/\bhip adductor\b|\badductor machine\b/g, 'hip adduction'],
  [/\bglute (machine|press)\b/g, 'glute kickback'],
  [/\bsit ?up machine\b|\bcrunch machine\b/g, 'ab crunch'],
]
const normaliseQuery = (query: string) => PHRASES.reduce((q, [re, to]) => q.replace(re, to), query.trim().toLowerCase())

const hit = (text: string, token: string) => text.includes(token) || (ALIAS[token] !== undefined && text.includes(ALIAS[token]))

/**
 * Search the library by name, muscle, equipment or type. Every typed word has to match one of them, so "bicep" finds every
 * biceps exercise whatever it is called, and "bicep cable" narrows it. Exercises for the typed muscle come first, then the
 * ones whose name starts with what was typed, then the rest.
 */
export function searchExercises<T extends Pick<Exercise, 'name' | 'muscle' | 'equipment' | 'category'>>(rows: T[], query: string): T[] {
  const tokens = normaliseQuery(query).split(/\s+/).filter(Boolean)
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

// ---- Equipment groups: the first row of the exercise library ----
export const EQUIPMENT_TILES = ['No equipment', 'Dumbbells', 'Resistance bands', 'TRX', 'Machines', 'Barbells', 'Kettlebells', 'Other'] as const
export type EquipmentTile = (typeof EQUIPMENT_TILES)[number]
export const MACHINE_KINDS = ['Machine', 'Cable', 'Smith'] as const
export type MachineKind = (typeof MACHINE_KINDS)[number]

const GROUP_RULES: [Exclude<EquipmentTile, 'Other'>, RegExp][] = [
  ['No equipment', /^(bodyweight|none|partner|vest|floor)$/],
  ['Dumbbells', /dumbbell/],
  ['Resistance bands', /band/],
  ['TRX', /trx/],
  ['Machines', /machine|^cable$|smith/],
  ['Barbells', /barbell|^ez bar$|trap bar/],
  ['Kettlebells', /kettlebell/],
]
const tokensOf = (equipment: string) => equipment.toLowerCase().split(/\s+or\s+|\s+and\s+|,/).map(t => t.trim()).filter(Boolean)

/** Equipment label ("Band or cable") to the tiles it belongs under. Cables and Smith machine live under Machines. */
export function equipmentGroups(equipment: string): EquipmentTile[] {
  const found = new Set<EquipmentTile>()
  for (const t of tokensOf(equipment)) for (const [group, re] of GROUP_RULES) if (re.test(t)) found.add(group)
  return found.size ? [...found] : ['Other']
}

/** Inside Machines: selectorised or plate-loaded machine, cable station, or Smith machine. */
export function machineKinds(equipment: string): MachineKind[] {
  const kinds = new Set<MachineKind>()
  for (const t of tokensOf(equipment)) {
    if (/smith/.test(t)) kinds.add('Smith'); else if (/^cable$/.test(t)) kinds.add('Cable'); else if (/machine/.test(t)) kinds.add('Machine')
  }
  return [...kinds]
}

/** Matching exercises grouped by main muscle, biggest group first. */
export function groupByMuscle<T extends Pick<Exercise, 'muscle'>>(rows: T[]): { muscle: string; rows: T[] }[] {
  const map = new Map<string, T[]>()
  for (const r of rows) map.set(r.muscle, [...(map.get(r.muscle) ?? []), r])
  return [...map].map(([muscle, list]) => ({ muscle, rows: list })).sort((a, b) => b.rows.length - a.rows.length || a.muscle.localeCompare(b.muscle))
}

// ---- "Did you mean": close matches when nothing matches what was typed ----
// Edit distance where swapping two neighbouring letters (bicpe, bicep) counts as one slip.
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
  }
  return d[a.length][b.length]
}
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function similarExercises<T extends Pick<Exercise, 'name' | 'muscle' | 'equipment'>>(rows: T[], query: string, limit = 5): T[] {
  const tokens = normaliseQuery(query).split(/\s+/).filter(t => t.length > 1)
  if (!tokens.length) return []
  const scored: { row: T; score: number }[] = []
  for (const row of rows) {
    const words = `${row.name} ${row.muscle} ${row.equipment}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    let score = 0, all = true
    for (const t of tokens) {
      const limitFor = t.length >= 8 ? 2 : t.length >= 3 ? 1 : 0
      const best = Math.min(...words.map(w => Math.min(distance(t, w), w.startsWith(t) ? 0 : 99)))
      if (best > limitFor) { all = false; break }
      score += best
    }
    if (!all && squash(row.name).includes(squash(tokens.join(' ')))) { all = true; score = 0 }
    if (all) scored.push({ row, score })
  }
  return scored.sort((a, b) => a.score - b.score || a.row.name.localeCompare(b.row.name)).slice(0, limit).map(s => s.row)
}
