import { describe, it, expect } from 'vitest'
import { detectPR, getPRs } from '../../src/utils/prDetector'

const makeLog = (date, exerciseName, sets) => ({
  date,
  completed: true,
  exercises: [{ name: exerciseName, sets }],
})

describe('detectPR', () => {
  it('detects first-ever PR (no prior logs)', () => {
    const sets = [{ weight: 100, reps: 5, completed: true, type: 'S' }]
    const pr = detectPR('Bench Press', sets, [])
    expect(pr).toEqual({ exercise: 'Bench Press', weight: 100, previousBest: 0 })
  })

  it('returns null with no history and no completed sets', () => {
    const sets = [{ weight: 0, reps: 5, completed: false, type: 'S' }]
    expect(detectPR('Bench Press', sets, [])).toBeNull()
  })

  it('detects new weight PR from working sets', () => {
    const history = [makeLog('2026-05-12', 'Bench Press', [
      { weight: 90, reps: 5, completed: true, type: 'S' },
    ])]
    const newSets = [{ weight: 100, reps: 5, completed: true, type: 'S' }]
    const result = detectPR('Bench Press', newSets, history)
    expect(result).toEqual({ exercise: 'Bench Press', weight: 100, previousBest: 90 })
  })

  it('returns null when weight is not a new PR', () => {
    const history = [makeLog('2026-05-12', 'Bench Press', [
      { weight: 105, reps: 5, completed: true, type: 'T' },
    ])]
    const newSets = [{ weight: 100, reps: 5, completed: true, type: 'S' }]
    expect(detectPR('Bench Press', newSets, history)).toBeNull()
  })

  it('ignores warm-up sets when detecting PR', () => {
    const history = [makeLog('2026-05-12', 'Bench Press', [
      { weight: 90, reps: 5, completed: true, type: 'S' },
    ])]
    // warm-up at 100kg should not count as PR over history working max of 90kg
    const newSets = [
      { weight: 100, reps: 3, completed: true, type: 'W' },
      { weight: 85, reps: 8, completed: true, type: 'S' },
    ]
    expect(detectPR('Bench Press', newSets, history)).toBeNull()
  })

  it('ignores drop sets when detecting PR', () => {
    const history = [makeLog('2026-05-12', 'Bench Press', [
      { weight: 90, reps: 5, completed: true, type: 'S' },
    ])]
    const newSets = [
      { weight: 95, reps: 5, completed: true, type: 'T' },
      { weight: 120, reps: 5, completed: true, type: 'D' }, // drop set should not count
    ]
    const result = detectPR('Bench Press', newSets, history)
    expect(result).toEqual({ exercise: 'Bench Press', weight: 95, previousBest: 90 })
  })

  it('handles legacy sets with no type field (backward compat)', () => {
    const history = [makeLog('2026-05-12', 'Bench Press', [
      { weight: 90, reps: 5, completed: true }, // no type field
    ])]
    const newSets = [{ weight: 95, reps: 5, completed: true, type: 'S' }]
    const result = detectPR('Bench Press', newSets, history)
    expect(result).toEqual({ exercise: 'Bench Press', weight: 95, previousBest: 90 })
  })
})

describe('getPRs', () => {
  it('returns empty array with no logs', () => {
    expect(getPRs([])).toEqual([])
  })

  it('returns the best working-set weight per exercise across all logs', () => {
    const logs = [
      makeLog('2026-05-12', 'Bench Press', [{ weight: 90, reps: 8, completed: true, type: 'S' }]),
      makeLog('2026-05-15', 'Bench Press', [{ weight: 100, reps: 8, completed: true, type: 'T' }]),
    ]
    const prs = getPRs(logs)
    expect(prs).toContainEqual({ exercise: 'Bench Press', weight: 100, date: '2026-05-15' })
  })
})
