import { useStorage } from './useStorage'

const EMPTY = {}

export function useWeightUnit() {
  const [profile] = useStorage('profile', EMPTY)
  return profile?.weightUnit ?? 'kg'
}
