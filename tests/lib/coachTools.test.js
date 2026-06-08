import { describe, it, expect } from 'vitest'
import { applyModifyWorkout, applyLogFood } from '../../src/lib/coachTools.js'

const baseProgram = {
  sessions: {
    A: { name: 'Push', focus: 'Chest', muscles: 'Chest, Tri', exercises: [{ name: 'Squat', sets: 3, reps: '5' }] },
  },
  daySession: { 0: 'rest', 1: 'A', 2: 'rest', 3: 'rest', 4: 'rest', 5: 'rest', 6: 'rest' },
}

describe('applyModifyWorkout', () => {
  it('adds an exercise to a session', () => {
    const next = applyModifyWorkout(baseProgram, {
      operation: 'add_exercise',
      sessionKey: 'A',
      exerciseName: 'Bench Press',
      sets: 3,
      reps: '8-10',
    })
    expect(next.sessions.A.exercises).toHaveLength(2)
    expect(next.sessions.A.exercises[1].name).toBe('Bench Press')
    expect(next.sessions.A.exercises[1].sets).toBe(3)
    expect(next.sessions.A.exercises[1].reps).toBe('8-10')
  })

  it('removes an exercise by name', () => {
    const next = applyModifyWorkout(baseProgram, {
      operation: 'remove_exercise',
      sessionKey: 'A',
      exerciseName: 'Squat',
    })
    expect(next.sessions.A.exercises).toHaveLength(0)
  })

  it('updates exercise sets and reps', () => {
    const next = applyModifyWorkout(baseProgram, {
      operation: 'update_exercise',
      sessionKey: 'A',
      exerciseName: 'Squat',
      sets: 5,
      reps: '3',
    })
    expect(next.sessions.A.exercises[0].sets).toBe(5)
    expect(next.sessions.A.exercises[0].reps).toBe('3')
  })

  it('adds a new session', () => {
    const next = applyModifyWorkout(baseProgram, {
      operation: 'add_session',
      sessionKey: 'B',
      newName: 'Pull',
    })
    expect(next.sessions.B.name).toBe('Pull')
    expect(next.sessions.B.exercises).toEqual([])
  })

  it('renames a session', () => {
    const next = applyModifyWorkout(baseProgram, {
      operation: 'rename_session',
      sessionKey: 'A',
      newName: 'Upper',
    })
    expect(next.sessions.A.name).toBe('Upper')
  })

  it('changes a weekday assignment', () => {
    const next = applyModifyWorkout(baseProgram, {
      operation: 'change_day_session',
      weekday: 1,
      newSessionKey: 'rest',
    })
    expect(next.daySession[1]).toBe('rest')
  })

  it('returns the original program unchanged when operation is unknown', () => {
    const next = applyModifyWorkout(baseProgram, { operation: 'nonsense' })
    expect(next).toEqual(baseProgram)
  })
})

describe('applyLogFood', () => {
  const today = '2026-06-08'
  const existingLogs = []

  it('creates a new day log when none exists and appends items', () => {
    const params = {
      items: [
        { name: 'Chicken breast', emoji: '🍗', grams: 150,
          per100g: { calories: 165, protein: 31, carbs: 0, fat: 4 } },
      ],
    }
    const next = applyLogFood(existingLogs, today, params)
    expect(next).toHaveLength(1)
    expect(next[0].date).toBe(today)
    expect(next[0].quickLogs).toHaveLength(1)
    const entry = next[0].quickLogs[0]
    expect(entry.name).toBe('Chicken breast')
    expect(entry.portionG).toBe(150)
    expect(entry.calories).toBe(Math.round(165 * 1.5))
    expect(entry.protein).toBe(Math.round(31 * 1.5))
    expect(entry._source).toBe('ai-chat')
  })

  it('appends to an existing day log without losing prior quickLogs', () => {
    const initial = [{
      date: today,
      meals: [],
      quickLogs: [{ id: 'q1', name: 'Apple', emoji: '🍎', portionG: 100, calories: 52, protein: 0, carbs: 14, fat: 0 }],
      calorieBump: 0,
    }]
    const params = { items: [{ name: 'Egg', emoji: '🥚', grams: 50, per100g: { calories: 143, protein: 13, carbs: 1, fat: 10 } }] }
    const next = applyLogFood(initial, today, params)
    expect(next[0].quickLogs).toHaveLength(2)
    expect(next[0].quickLogs[0].name).toBe('Apple')
    expect(next[0].quickLogs[1].name).toBe('Egg')
  })
})
