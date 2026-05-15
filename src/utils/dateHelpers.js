// src/utils/dateHelpers.js
import { DAY_SESSION } from '../data/workoutProgram'

/** Format a Date as YYYY-MM-DD using local time (timezone-safe) */
export function toLocalDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getTodaySession(date = new Date()) {
  return DAY_SESSION[date.getDay()]
}

export function getWeekNumber(startDateStr, today = new Date()) {
  // Parse date strings as local midnight to avoid UTC offset issues
  const [sy, sm, sd] = startDateStr.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffMs = current - start
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
}

// Training days: Mon=1, Tue=2, Thu=4, Fri=5
const TRAINING_DAYS = new Set([1, 2, 4, 5])

export function getStreak(logs, today = new Date()) {
  if (!logs.length) return 0

  const completedDates = new Set(
    logs.filter(l => l.completed).map(l => l.date)
  )

  let streak = 0
  // Normalize today to local midnight
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayStr = toLocalDateStr(todayLocal)

  const cursor = new Date(todayLocal)

  // Walk backwards through days
  for (let i = 0; i < 60; i++) {
    const dayOfWeek = cursor.getDay()
    const dateStr = toLocalDateStr(cursor)

    if (TRAINING_DAYS.has(dayOfWeek)) {
      if (completedDates.has(dateStr)) {
        streak++
      } else if (dateStr <= todayStr) {
        // Missed a past training day — streak ends
        break
      }
    }

    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}
