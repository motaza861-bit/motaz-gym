import { useStorage } from './useStorage'
import { DEFAULT_TARGETS } from '../data/nutritionPlan'

export function useTargets() {
  return useStorage('motaz_targets', DEFAULT_TARGETS)
}
