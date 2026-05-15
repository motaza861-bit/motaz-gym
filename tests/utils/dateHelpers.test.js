// tests/utils/dateHelpers.test.js
import { describe, it, expect } from 'vitest'
import { getTodaySession, getStreak, getWeekNumber } from '../../src/utils/dateHelpers'

describe('getTodaySession', () => {
  it('returns A on Monday', () => {
    const monday = new Date('2026-05-18') // Monday
    expect(getTodaySession(monday)).toBe('A')
  })
  it('returns B on Tuesday', () => {
    const tuesday = new Date('2026-05-19')
    expect(getTodaySession(tuesday)).toBe('B')
  })
  it('returns rest on Wednesday', () => {
    const wednesday = new Date('2026-05-20')
    expect(getTodaySession(wednesday)).toBe('rest')
  })
  it('returns A on Thursday', () => {
    const thursday = new Date('2026-05-21')
    expect(getTodaySession(thursday)).toBe('A')
  })
  it('returns rest on Sunday', () => {
    const sunday = new Date('2026-05-17')
    expect(getTodaySession(sunday)).toBe('rest')
  })
})

describe('getStreak', () => {
  it('returns 0 with no logs', () => {
    expect(getStreak([], new Date('2026-05-19'))).toBe(0)
  })
  it('returns 1 with only today logged', () => {
    const logs = [{ date: '2026-05-18', completed: true }] // Mon
    expect(getStreak(logs, new Date('2026-05-18'))).toBe(1)
  })
  it('counts consecutive training days', () => {
    const logs = [
      { date: '2026-05-18', completed: true }, // Mon
      { date: '2026-05-19', completed: true }, // Tue
    ]
    expect(getStreak(logs, new Date('2026-05-19'))).toBe(2)
  })
  it('stops streak at missed training day', () => {
    // Mon logged, Tue missed, Thu logged — streak from Thu is 1
    const logs = [
      { date: '2026-05-18', completed: true }, // Mon
      { date: '2026-05-22', completed: true }, // Thu (Tue missed)
    ]
    expect(getStreak(logs, new Date('2026-05-22'))).toBe(1)
  })
})

describe('getWeekNumber', () => {
  it('returns 1 in the first week', () => {
    const start = '2026-05-11'
    expect(getWeekNumber(start, new Date('2026-05-13'))).toBe(1)
  })
  it('returns 2 in the second week', () => {
    const start = '2026-05-11'
    expect(getWeekNumber(start, new Date('2026-05-18'))).toBe(2)
  })
})
