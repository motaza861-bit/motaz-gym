import { useStorage } from './useStorage'
import { DEFAULT_PROGRAM } from '../data/workoutProgram'

export function useExercises() {
  return useStorage('motaz_exercises', DEFAULT_PROGRAM)
}
