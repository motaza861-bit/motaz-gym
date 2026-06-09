import { describe, it, expect } from 'vitest'
import { hasTier, FEATURES, TIER_NONE, TIER_1, TIER_2 } from '../../src/lib/tiers.js'

describe('hasTier', () => {
  it('grants when effective tier is the same as required', () => {
    expect(hasTier(TIER_1, TIER_1)).toBe(true)
    expect(hasTier(TIER_2, TIER_2)).toBe(true)
    expect(hasTier(TIER_NONE, TIER_NONE)).toBe(true)
  })

  it('grants when effective tier is higher than required', () => {
    expect(hasTier(TIER_2, TIER_1)).toBe(true)
    expect(hasTier(TIER_1, TIER_NONE)).toBe(true)
    expect(hasTier(TIER_2, TIER_NONE)).toBe(true)
  })

  it('denies when effective tier is lower than required', () => {
    expect(hasTier(TIER_NONE, TIER_1)).toBe(false)
    expect(hasTier(TIER_NONE, TIER_2)).toBe(false)
    expect(hasTier(TIER_1, TIER_2)).toBe(false)
  })

  it('treats unknown effective tier as none', () => {
    expect(hasTier('garbage', TIER_1)).toBe(false)
  })
})

describe('FEATURES map', () => {
  it('puts the AI Coach behind Tier 2', () => {
    expect(FEATURES.coach).toBe(TIER_2)
  })

  it('puts most write features behind Tier 1', () => {
    expect(FEATURES.log_workout).toBe(TIER_1)
    expect(FEATURES.log_nutrition).toBe(TIER_1)
    expect(FEATURES.barcode_scan).toBe(TIER_1)
    expect(FEATURES.ai_estimate).toBe(TIER_1)
    expect(FEATURES.ai_photo_scan).toBe(TIER_1)
  })
})
