export type Role = 'client' | 'coach'
export interface Profile { id: string; full_name: string; role: Role; created_at?: string }

export interface Measurement { id: string; client_id: string; date: string; weight_kg: number | null; body_fat_pct: number | null; notes: string }
export interface TasterSession {
  id: string; client_id: string; assessed_on: string; goal: string; target_date: string; date_of_birth: string
  sex: 'female' | 'male'; activity_level: 'sedentary' | 'light' | 'moderate' | 'very' | 'extra'
  height_cm: number; weight_kg: number; target_weight_kg: number; body_fat_pct: number | null; target_body_fat_pct: number | null
  bmi: number; target_bmi: number; bmr_kcal: number; target_bmr_kcal: number; estimated_maintenance_kcal: number
  job_description: string; fitness_level: 'beginner' | 'intermediate' | 'advanced' | 'athlete'; diet: string
  goal_metric_label: string; goal_metric_current: string; goal_metric_target: string; goal_metric_unit: string; new_habit: string
  emergency_contact_name: string; emergency_contact_phone: string; emergency_contact_email: string
  parq_answers: import('./lib/parq').ParqAnswers
  parq_health_details: string; parq_injury_details: string; parq_medication_details: string; parq_allergy_details: string
  parq_health_storage_consent: boolean; parq_health_storage_consented_at: string | null
  parq_exercise_consent: boolean; parq_consented_at: string | null
  target_kcal: number; target_protein: number; target_carbs: number; target_fat: number
  client_summary: string; coach_notes: string; created_by: string; created_at: string; updated_at: string
}
export interface FitnessAssessmentItem {
  id: string; taster_session_id: string; exercise_id: string | null; exercise_name: string; category: string
  result: string; unit: string; notes: string; sort: number
}
export interface Session { id: string; starts_at: string; duration_min: number; title: string }
export interface Booking { id: string; session_id: string; client_id: string }

export interface Habit { id: string; client_id: string; name: string; kind: 'check' | 'number'; unit: string; target: number | null; active: boolean; sort: number }
export interface HabitLog { id: string; habit_id: string; client_id: string; date: string; value: number }
export interface Checkin { id: string; client_id: string; date: string; mood: number | null; energy: number | null; sleep_hours: number | null; note: string }

export interface Metric { id: string; client_id: string; name: string; unit: string; lower_is_better: boolean; active: boolean }
export interface MetricLog { id: string; metric_id: string; client_id: string; date: string; value: number }
export interface OneRepMax { id: string; client_id: string; exercise: string; weight_kg: number; date: string }

// training
export type Category = 'strength' | 'cardio' | 'mobility' | 'plyometric' | 'core'
export interface Exercise { id: string; name: string; muscle: string; equipment: string; category: Category; instructions: string; video_url: string; created_by: string | null }
export type WorkoutFormat = 'standard' | 'circuit' | 'amrap' | 'emom' | 'intervals'
export type SetStyle = 'single' | 'superset' | 'triset'
export interface Workout { id: string; name: string; description: string; format: WorkoutFormat; duration_min: number | null; rounds: number | null; created_by: string | null; created_at?: string }
export interface WorkoutItem {
  id: string; workout_id: string; exercise_id: string | null; exercise_name: string; sort: number; group_label: string; set_style: SetStyle
  sets: number | null; reps: string; load: string; percent_1rm: number | null; rest_sec: number | null; tempo: string; notes: string
  /** kg ("80"), percent of the client's max ("75%") or text ("bodyweight"). `load` is now shown as Effort (e.g. RPE 8). */
  weight: string
  cardio_time: string; cardio_distance_km: number | null; cardio_speed_kmh: number | null
}
export interface Program { id: string; name: string; description: string; goal: string; level: string; weeks: number; created_by: string | null }
export interface ProgramDay { id: string; program_id: string; week: number; day: number; workout_id: string }
export interface SetLog { reps: string; kg: string; done: boolean; time?: string; distance?: string; speed?: string }
export interface WorkoutAlternative {
  id: string; workout_item_id: string; exercise_id: string; exercise_name: string; is_cardio: boolean
  sets: number; reps: string; rest_sec: number; notes: string
  cardio_time: string; cardio_distance_km: number | null; cardio_speed_kmh: number | null
}
export interface ExerciseChoice { alternative_id: string; item: WorkoutItem; is_cardio: boolean }
export interface WorkoutTimer { elapsed_sec: number; started_at: string | null; running: boolean }
export interface WorkoutLog { items?: Record<string, SetLog[]>; exercise_choices?: Record<string, ExerciseChoice>; rounds?: number; seconds?: number; timer?: WorkoutTimer }
export interface ClientWorkout {
  id: string; client_id: string; workout_id: string; date: string; program_id: string | null; status: 'scheduled' | 'done' | 'skipped'
  log: WorkoutLog; rating: number | null; client_note: string; completed_at: string | null
}

// nutrition
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export interface Food { id: string; name: string; serving_label: string; serving_g: number; kcal: number; protein: number; carbs: number; fat: number; created_by: string | null }
export interface Recipe {
  id: string; name: string; meal_type: MealType; description: string; prep_min: number | null
  kcal: number; protein: number; carbs: number; fat: number; ingredients: string[]; steps: string[]; tags: string[]; created_by: string | null
  image_url?: string | null
}
export interface MealPlanTemplate {
  id: string; name: string; goal: string; kcal: number; description: string; image_url: string | null; plan_no: number | null
}
export interface TemplateItem { id: string; template_id: string; day: number; meal_type: MealType; recipe_id: string; servings: number; sort: number }
export interface Targets { client_id: string; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; notes: string }
export interface MealPlanItem { id: string; client_id: string; day: number; meal_type: MealType; recipe_id: string; servings: number; sort: number }
export interface FoodLog {
  id: string; client_id: string; date: string; meal_type: MealType; name: string; amount_label: string
  kcal: number; protein: number; carbs: number; fat: number; food_id: string | null; recipe_id: string | null
}
export interface Macros { kcal: number; protein: number; carbs: number; fat: number }

// engagement
export interface Message { id: string; client_id: string; sender_id: string; body: string; created_at: string; read_at: string | null }
export interface ProgressPhoto { id: string; client_id: string; path: string; pose: 'front' | 'side' | 'back' | 'other'; date: string }
export interface Post { id: string; author_id: string; body: string; pinned: boolean; publish_at: string; created_at: string }
export interface Challenge { id: string; name: string; description: string; unit: string; goal: number | null; start_date: string; end_date: string }
export interface ChallengeEntry { id: string; challenge_id: string; client_id: string; date: string; value: number }
export interface Resource { id: string; title: string; url: string; category: string; description: string }

export interface ClientHealth {
  client_id: string; allergies: string; health_conditions: string; medications: string; emergency_contact: string
  consent_data: boolean; consent_health: boolean; consent_accurate: boolean; consent_version: number; consented_at: string | null; updated_at?: string
}

