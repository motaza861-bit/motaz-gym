import { describe, it, expect } from 'vitest'
import { calcBMR, calcTDEE, calcMacros, ACTIVITY_MULTIPLIERS } from '../../src/utils/macroCalculator'

describe('calcBMR', () => {
  it('calculates male BMR (Miffin-St Jeor)', () => {
    // 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5 = 1805
    expect(calcBMR({ weight: 80, height: 180, age: 25, gender: 'male' })).toBe(1805)
  })
  it('calculates female BMR', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
    expect(calcBMR({ weight: 60, height: 165, age: 30, gender: 'female' })).toBe(1320.25)
  })
})

describe('calcTDEE', () => {
  it('applies the moderate activity multiplier', () => {
    expect(calcTDEE(1805, 'moderate')).toBe(Math.round(1805 * ACTIVITY_MULTIPLIERS.moderate))
  })
  it('applies the sedentary activity multiplier', () => {
    expect(calcTDEE(1805, 'sedentary')).toBe(Math.round(1805 * ACTIVITY_MULTIPLIERS.sedentary))
  })
})

describe('calcMacros', () => {
  const base = { weight: 80, height: 180, age: 25, gender: 'male', activityLevel: 'moderate' }

  it('sets protein to 2g per kg rounded to nearest 5', () => {
    const { protein } = calcMacros({ ...base, goal: 'recomp' })
    expect(protein).toBe(160) // 80*2 = 160
  })
  it('cut calories are 400 less than recomp', () => {
    const recomp = calcMacros({ ...base, goal: 'recomp' })
    const cut = calcMacros({ ...base, goal: 'cut' })
    expect(recomp.calories - cut.calories).toBe(400)
  })
  it('bulk calories are 250 more than recomp', () => {
    const recomp = calcMacros({ ...base, goal: 'recomp' })
    const bulk = calcMacros({ ...base, goal: 'bulk' })
    expect(bulk.calories - recomp.calories).toBe(250)
  })
  it('carbs and fat are positive', () => {
    const { carbs, fat } = calcMacros({ ...base, goal: 'recomp' })
    expect(carbs).toBeGreaterThan(0)
    expect(fat).toBeGreaterThan(0)
  })
})
