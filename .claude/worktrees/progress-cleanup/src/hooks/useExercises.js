import { useStorage } from './useStorage'
import { DEFAULT_PROGRAM } from '../data/workoutProgram'

export function useExercises() {
  return useStorage('exercises', DEFAULT_PROGRAM)
}
