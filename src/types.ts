export type Role = 'client' | 'coach'
export interface Profile { id: string; full_name: string; role: Role }
export interface Programme { id: string; client_id: string; name: string; notes: string; active: boolean }
export interface ProgrammeExercise {
  id: string; programme_id: string; day_label: string; exercise: string
  sets: number | null; reps: string | null; notes: string; sort: number; percent_1rm: number | null
}
export interface Measurement { id: string; client_id: string; date: string; weight_kg: number | null; body_fat_pct: number | null; notes: string }
export interface Session { id: string; starts_at: string; duration_min: number; title: string }
export interface Booking { id: string; session_id: string; client_id: string }
export interface Habit { id: string; client_id: string; name: string; kind: 'check' | 'number'; unit: string; target: number | null; active: boolean; sort: number }
export interface HabitLog { id: string; habit_id: string; client_id: string; date: string; value: number }
export interface Checkin { id: string; client_id: string; date: string; mood: number | null; energy: number | null; sleep_hours: number | null; note: string }
export interface Metric { id: string; client_id: string; name: string; unit: string; lower_is_better: boolean; active: boolean }
export interface MetricLog { id: string; metric_id: string; client_id: string; date: string; value: number }
export interface OneRepMax { id: string; client_id: string; exercise: string; weight_kg: number; date: string }
