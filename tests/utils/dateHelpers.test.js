import { describe, it, expect } from 'vitest'
import { getTodaySession, getStreak, getWeekNumber } from '../../src/utils/dateHelpers'

// Mon/Tue/Thu/Fri training — matches the test dates used below
const DAY_SESSION = { 0: 'rest', 1: 'A', 2: 'B', 3: 'rest', 4: 'A', 5: 'B', 6: 'rest' }

describe('getTodaySession', () => {
  it('returns A on Monday', () => {
    expect(getTodaySession(new Date('2026-05-18'), DAY_SESSION)).toBe('A')
  })
  it('returns B on Tuesday', () => {
    expect(getTodaySession(new Date('2026-05-19'), DAY_SESSION)).toBe('B')
  })
  it('returns rest on Wednesday', () => {
    expect(getTodaySession(new Date('2026-05-20'), DAY_SESSION)).toBe('rest')
  })
  it('returns A on Thursday', () => {
    expect(getTodaySession(new Date('2026-05-21'), DAY_SESSION)).toBe('A')
  })
  it('returns rest on Sunday', () => {
    expect(getTodaySession(new Date('2026-05-17'), DAY_SESSION)).toBe('rest')
  })
})

describe('getStreak', () => {
  it('returns 0 with no logs', () => {
    expect(getStreak([], DAY_SESSION, new Date('2026-05-19'))).toBe(0)
  })
  it('returns 1 with only today logged', () => {
    const logs = [{ date: '2026-05-18', completed: true }] // Mon
    expect(getStreak(logs, DAY_SESSION, new Date('2026-05-18'))).toBe(1)
  })
  it('counts consecutive training days', () => {
    const logs = [
      { date: '2026-05-18', completed: true }, // Mon
      { date: '2026-05-19', completed: true }, // Tue
    ]
    expect(getStreak(logs, DAY_SESSION, new Date('2026-05-19'))).toBe(2)
  })
  it('stops streak at missed training day', () => {
    // Mon logged, Tue missed, Thu logged — streak from Thu is 1
    const logs = [
      { date: '2026-05-18', completed: true }, // Mon
      { date: '2026-05-22', completed: true }, // Thu (Tue missed)
    ]
    expect(getStreak(logs, DAY_SESSION, new Date('2026-05-22'))).toBe(1)
  })
})

describe('getWeekNumber', () => {
  it('returns 1 in the first week', () => {
    expect(getWeekNumber('2026-05-11', new Date('2026-05-13'))).toBe(1)
  })
  it('returns 2 in the second week', () => {
    expect(getWeekNumber('2026-05-11', new Date('2026-05-18'))).toBe(2)
  })
})
