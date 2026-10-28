export type AssessmentSex = 'female' | 'male'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra'

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary', light: 'Lightly active', moderate: 'Moderately active', very: 'Very active', extra: 'Extremely active',
}

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725, extra: 1.9 }

export function ageOn(dateOfBirth: string, today = new Date()) {
  const born = new Date(`${dateOfBirth}T12:00:00`)
  let age = today.getFullYear() - born.getFullYear()
  if (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) age--
  return age
}

export function bmi(weightKg: number, heightCm: number) {
  return Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10
}

/** Mifflin-St Jeor resting energy expenditure multiplied by activity level. */
export function maintenanceCalories(weightKg: number, heightCm: number, age: number, sex: AssessmentSex, activity: ActivityLevel) {
  const resting = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
  return Math.max(0, Math.round(resting * ACTIVITY_FACTOR[activity]))
}

