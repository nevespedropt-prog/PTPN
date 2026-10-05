export type Role = 'client' | 'coach'
export interface Profile { id: string; full_name: string; role: Role; created_at?: string }

export interface Measurement { id: string; client_id: string; date: string; weight_kg: number | null; body_fat_pct: number | null; notes: string }
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
export interface Workout { id: string; name: string; description: string; format: WorkoutFormat; duration_min: number | null; rounds: number | null; created_by: string | null; created_at?: string }
export interface WorkoutItem {
  id: string; workout_id: string; exercise_id: string | null; exercise_name: string; sort: number; group_label: string
  sets: number | null; reps: string; load: string; percent_1rm: number | null; rest_sec: number | null; tempo: string; notes: string
}
export interface Program { id: string; name: string; description: string; goal: string; level: string; weeks: number; created_by: string | null }
export interface ProgramDay { id: string; program_id: string; week: number; day: number; workout_id: string }
export interface SetLog { reps: string; kg: string; done: boolean }
export interface WorkoutLog { items?: Record<string, SetLog[]>; rounds?: number; seconds?: number }
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
