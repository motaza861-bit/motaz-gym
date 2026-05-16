import { useStorage } from './useStorage'
import { DEFAULT_MEALS } from '../data/nutritionPlan'

export function useMeals() {
  return useStorage('motaz_meals', DEFAULT_MEALS)
}
