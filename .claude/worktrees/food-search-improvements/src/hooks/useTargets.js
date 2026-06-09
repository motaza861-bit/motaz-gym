import { useStorage } from './useStorage'
import { DEFAULT_TARGETS } from '../data/nutritionPlan'

export function useTargets() {
  return useStorage('targets', DEFAULT_TARGETS)
}
