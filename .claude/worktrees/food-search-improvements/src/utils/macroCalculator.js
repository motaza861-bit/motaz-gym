export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extreme: 1.9,
}

export const GOAL_ADJUSTMENTS = {
  recomp: 0,
  cut: -400,
  bulk: 250,
}

export function calcBMR({ weight, height, age, gender }) {
  const base = 10 * weight + 6.25 * height - 5 * age
  return gender === 'male' ? base + 5 : base - 161
}

export function calcTDEE(bmr, activityLevel) {
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55))
}

export function calcMacros({ weight, height, age, gender, activityLevel, goal }) {
  const bmr = calcBMR({ weight, height, age, gender })
  const tdee = calcTDEE(bmr, activityLevel)
  const adjustment = GOAL_ADJUSTMENTS[goal] ?? 0
  const calories = Math.round((tdee + adjustment) / 5) * 5
  const protein = Math.round((weight * 2) / 5) * 5
  const fat = Math.round((calories * 0.25 / 9) / 5) * 5
  const carbs = Math.round(((calories - protein * 4 - fat * 9) / 4) / 5) * 5
  return { calories, protein, carbs, fat }
}
