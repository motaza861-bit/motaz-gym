import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../src/lib/sync', () => ({
  pushKey: vi.fn().mockResolvedValue(undefined),
  isLoggedIn: vi.fn(() => false),
}))

import { useExercises } from '../../src/hooks/useExercises'
import { DEFAULT_PROGRAM } from '../../src/data/workoutProgram'

beforeEach(() => localStorage.clear())

describe('useExercises', () => {
  it('returns DEFAULT_PROGRAM when nothing in storage', () => {
    const { result } = renderHook(() => useExercises())
    expect(result.current[0]).toEqual(DEFAULT_PROGRAM)
  })

  it('persists a custom program to localStorage', () => {
    const { result } = renderHook(() => useExercises())
    const custom = { sessions: { A: { name: 'Test', focus: 'Test', muscles: 'All', exercises: [] } }, daySession: { 0: 'rest', 1: 'A', 2: 'rest', 3: 'rest', 4: 'rest', 5: 'rest', 6: 'rest' } }
    act(() => result.current[1](custom))
    expect(JSON.parse(localStorage.getItem('exercises'))).toEqual(custom)
  })
})
