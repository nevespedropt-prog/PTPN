import type { FoodLog, Macros } from '../types'

export interface MealEntry extends Macros { name: string; amount_label: string }
export interface SavedMeal { id: string; client_id: string; name: string; items: MealEntry[] }

/** Copy nutrition snapshots only, never source row IDs, dates or ownership. */
export function mealEntries(rows: unknown): MealEntry[] {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) throw new Error('This meal needs between 1 and 100 entries.')
  return rows.map(row => {
    if (!row || typeof row !== 'object' || typeof row.name !== 'string' || !row.name.trim() || typeof row.amount_label !== 'string') {
      throw new Error('This saved meal contains an invalid entry.')
    }
    const numbers = ['kcal', 'protein', 'carbs', 'fat'].map(k => {
      const value = row[k]
      if ((typeof value !== 'number' && typeof value !== 'string') || value === '') throw new Error('This meal has invalid nutrition values.')
      const n = Number(value)
      if (!Number.isFinite(n) || n < 0) throw new Error('This meal has invalid nutrition values.')
      return n
    })
    return { name: row.name, amount_label: row.amount_label, kcal: numbers[0], protein: numbers[1], carbs: numbers[2], fat: numbers[3] }
  })
}

export function mealLogRows(rows: unknown, clientId: string, date: string, meal: FoodLog['meal_type']) {
  return mealEntries(rows).map(item => ({ ...item, client_id: clientId, date, meal_type: meal }))
}