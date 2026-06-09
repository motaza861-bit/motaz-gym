export const TIER_NONE = 'none'
export const TIER_1    = 'tier1'
export const TIER_2    = 'tier2'

const RANK = { none: 0, tier1: 1, tier2: 2 }

export function hasTier(effective, required) {
  const e = RANK[effective] ?? 0
  const r = RANK[required] ?? 0
  return e >= r
}

export const FEATURES = {
  log_workout:    TIER_1,
  log_nutrition:  TIER_1,
  body_weight:    TIER_1,
  big_three:      TIER_1,
  one_rm:         TIER_1,
  barcode_scan:   TIER_1,
  ai_estimate:    TIER_1,
  ai_photo_scan:  TIER_1,
  detect_muscles: TIER_1,
  meal_text:      TIER_1,
  coach:          TIER_2,
}
