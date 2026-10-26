import type { ExerciseChoice, WorkoutAlternative, WorkoutItem, WorkoutLog } from '../types'

/** Preserve the session's selected prescription without changing the template. */
export function alternativeChoice(base: WorkoutItem, alternative: WorkoutAlternative): ExerciseChoice {
  return { alternative_id: alternative.id, is_cardio: alternative.is_cardio, item: {
    ...base, exercise_id: alternative.exercise_id, exercise_name: alternative.exercise_name,
    sets: alternative.sets, reps: alternative.reps, rest_sec: alternative.rest_sec, notes: alternative.notes,
    weight: '', percent_1rm: null, load: '', tempo: '', cardio_time: alternative.cardio_time,
    cardio_distance_km: alternative.cardio_distance_km, cardio_speed_kmh: alternative.cardio_speed_kmh,
  } }
}
export function performedItems(items: WorkoutItem[], log: WorkoutLog): WorkoutItem[] {
  const known = new Set(items.map(i => i.id))
  return [...items.map(i => log.exercise_choices?.[i.id]?.item ?? i),
    ...Object.values(log.exercise_choices ?? {}).filter(c => !known.has(c.item.id)).map(c => c.item)]
}
export function samePreviousExercise(item: WorkoutItem, original: WorkoutItem | undefined, previous: WorkoutLog | null): boolean {
  const earlier = previous?.exercise_choices?.[item.id]?.item ?? original
  if (!earlier) return false
  return item.exercise_id && earlier.exercise_id ? item.exercise_id === earlier.exercise_id : item.exercise_name.trim().toLowerCase() === earlier.exercise_name.trim().toLowerCase()
}
