import type { Food, Macros, MealPlanItem, MealType, Recipe, Targets } from '../types'

export const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
export const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' }

export const zero = (): Macros => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 })

export const sum = (rows: Macros[]): Macros =>
  rows.reduce((t, r) => ({ kcal: t.kcal + Number(r.kcal), protein: t.protein + Number(r.protein), carbs: t.carbs + Number(r.carbs), fat: t.fat + Number(r.fat) }), zero())

/** Food macros are per 100 g. */
export const forGrams = (f: Food, grams: number): Macros => ({
  kcal: Math.round((f.kcal * grams) / 100),
  protein: Math.round((f.protein * grams) / 10) / 10,
  carbs: Math.round((f.carbs * grams) / 10) / 10,
  fat: Math.round((f.fat * grams) / 10) / 10,
})

export const forServings = (r: Macros, servings: number): Macros => ({
  kcal: Math.round(r.kcal * servings),
  protein: Math.round(r.protein * servings * 10) / 10,
  carbs: Math.round(r.carbs * servings * 10) / 10,
  fat: Math.round(r.fat * servings * 10) / 10,
})

/** Simple targets from bodyweight: 2 g/kg protein, 0.8 g/kg fat, carbs fill the rest. */
export const suggestTargets = (kcal: number, weightKg: number) => {
  const protein = Math.round(weightKg * 2)
  const fat = Math.round(weightKg * 0.8)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, carbs, fat }
}

const SPLIT: Record<MealType, number> = { breakfast: 0.25, lunch: 0.32, dinner: 0.33, snack: 0.1 }

/**
 * Builds a 7-day plan from the recipe book: for each day and meal, picks the recipe whose calories best fit
 * that meal's share of the target (servings scaled 0.5 to 2), preferring higher protein and avoiding repeats.
 */
export function generateWeek(recipes: Recipe[], t: Targets, clientId: string): Omit<MealPlanItem, 'id'>[] {
  const kcal = t.kcal || 2000
  const out: Omit<MealPlanItem, 'id'>[] = []
  const used = new Map<string, number>()
  for (let day = 1; day <= 7; day++) {
    for (const meal of ['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]) {
      const pool = recipes.filter(r => r.meal_type === meal && r.kcal > 0)
      if (!pool.length) continue
      const goal = kcal * SPLIT[meal]
      let best: { r: Recipe; s: number; score: number } | null = null
      for (const r of pool) {
        const servings = Math.min(2, Math.max(0.5, Math.round((goal / r.kcal) * 2) / 2))
        const off = Math.abs(r.kcal * servings - goal) / goal
        const proteinBonus = (r.protein * 4) / Math.max(1, r.kcal) // share of calories from protein
        const repeat = (used.get(r.id) ?? 0) * 0.35
        const score = off - proteinBonus * 0.6 + repeat + ((r.id.charCodeAt(0) + day) % 7) * 0.01
        if (!best || score < best.score) best = { r, s: servings, score }
      }
      if (best) {
        used.set(best.r.id, (used.get(best.r.id) ?? 0) + 1)
        out.push({ client_id: clientId, day, meal_type: meal, recipe_id: best.r.id, servings: best.s, sort: 0 })
      }
    }
  }
  return out
}

/**
 * Random recipe for one meal. Candidates are the recipes of that meal type; each is scored on how close its calories
 * (at 0.5 to 2 servings) land to what the client has left for that meal, then one of the best few is picked at random.
 */
export function pickRandomMeal(recipes: Recipe[], meal: MealType, goalKcal: number, exclude: string[] = []): { recipe: Recipe; servings: number } | null {
  const pool = recipes.filter(r => r.meal_type === meal && r.kcal > 0)
  const fresh = pool.filter(r => !exclude.includes(r.id))
  const from = fresh.length ? fresh : pool
  if (!from.length) return null
  const scored = from.map(r => {
    const servings = Math.min(2, Math.max(0.5, Math.round((goalKcal / r.kcal) * 2) / 2))
    return { recipe: r, servings, off: Math.abs(r.kcal * servings - goalKcal) / goalKcal }
  }).sort((a, b) => a.off - b.off)
  const top = scored.slice(0, Math.min(6, scored.length))
  return top[Math.floor(Math.random() * top.length)]
}

/** Default share of the daily target for one meal. */
export const mealGoal = (meal: MealType, dailyKcal: number | null, leftKcal: number | null) =>
  Math.max(150, Math.min(leftKcal !== null && leftKcal > 0 ? leftKcal : Infinity, (dailyKcal || 2000) * SPLIT[meal]))
