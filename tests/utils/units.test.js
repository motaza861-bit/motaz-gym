import { describe, it, expect } from 'vitest'
import { kgToDisplay, displayToKg, unitLabel } from '../../src/utils/units.js'

describe('kgToDisplay', () => {
  it('rounds kg to 1 decimal when unit is kg', () => {
    expect(kgToDisplay(75, 'kg')).toBe(75)
    expect(kgToDisplay(75.45, 'kg')).toBe(75.5)
  })

  it('converts kg to lbs and rounds to 1 decimal when unit is lbs', () => {
    expect(kgToDisplay(100, 'lbs')).toBe(220.5)
    expect(kgToDisplay(1, 'lbs')).toBe(2.2)
  })

  it('returns empty string for nullish input', () => {
    expect(kgToDisplay(null, 'kg')).toBe('')
    expect(kgToDisplay(undefined, 'lbs')).toBe('')
  })
})

describe('displayToKg', () => {
  it('passes through positive kg input', () => {
    expect(displayToKg('75', 'kg')).toBe(75)
    expect(displayToKg('75.5', 'kg')).toBe(75.5)
  })

  it('converts lbs input back to kg', () => {
    const result = displayToKg('220.5', 'lbs')
    expect(result).toBeCloseTo(100, 1)
  })

  it('returns null for non-positive or invalid input', () => {
    expect(displayToKg('', 'kg')).toBeNull()
    expect(displayToKg('0', 'kg')).toBeNull()
    expect(displayToKg('-5', 'kg')).toBeNull()
    expect(displayToKg('abc', 'lbs')).toBeNull()
  })

  it('round-trips kg → lbs → kg within rounding tolerance', () => {
    const original = 82.5
    const displayed = kgToDisplay(original, 'lbs')
    const back = displayToKg(String(displayed), 'lbs')
    expect(back).toBeCloseTo(original, 1)
  })
})

describe('unitLabel', () => {
  it('returns "lbs" for lbs', () => {
    expect(unitLabel('lbs')).toBe('lbs')
  })
  it('returns "kg" for kg or anything else', () => {
    expect(unitLabel('kg')).toBe('kg')
    expect(unitLabel(undefined)).toBe('kg')
    expect(unitLabel('foo')).toBe('kg')
  })
})
