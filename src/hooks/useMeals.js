import { useStorage } from './useStorage'
import { DEFAULT_MEALS } from '../data/nutritionPlan'

export function useMeals() {
  return useStorage('meals', DEFAULT_MEALS)
}
