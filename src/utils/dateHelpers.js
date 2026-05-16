export function toLocalDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getTodaySession(date = new Date(), daySession = {}) {
  return daySession[date.getDay()] ?? 'rest'
}

export function getWeekNumber(startDateStr, today = new Date()) {
  const [sy, sm, sd] = startDateStr.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffMs = current - start
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
}

export function getStreak(logs, daySession = {}, today = new Date()) {
  if (!logs.length) return 0

  const trainingDays = new Set(
    Object.entries(daySession)
      .filter(([, v]) => v !== 'rest')
      .map(([k]) => Number(k))
  )
  if (!trainingDays.size) return 0

  const completedDates = new Set(
    logs.filter(l => l.completed).map(l => l.date)
  )

  let streak = 0
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayStr = toLocalDateStr(todayLocal)
  const cursor = new Date(todayLocal)

  for (let i = 0; i < 60; i++) {
    const dayOfWeek = cursor.getDay()
    const dateStr = toLocalDateStr(cursor)

    if (trainingDays.has(dayOfWeek)) {
      if (completedDates.has(dateStr)) {
        streak++
      } else if (dateStr <= todayStr) {
        break
      }
    }

    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}
