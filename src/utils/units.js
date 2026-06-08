const LBS_PER_KG = 2.20462

export function kgToDisplay(kg, unit) {
  if (kg == null) return ''
  if (unit === 'lbs') return Math.round(kg * LBS_PER_KG * 10) / 10
  return Math.round(kg * 10) / 10
}

export function displayToKg(value, unit) {
  const n = parseFloat(value)
  if (!isFinite(n) || n <= 0) return null
  return unit === 'lbs' ? n / LBS_PER_KG : n
}

export function unitLabel(unit) {
  return unit === 'lbs' ? 'lbs' : 'kg'
}
