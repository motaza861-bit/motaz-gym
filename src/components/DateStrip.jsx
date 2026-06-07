import { useRef, useEffect } from 'react'
import { useSelectedDate } from '../context/DateContext'
import { useStorage } from '../hooks/useStorage'
import { toLocalDateStr } from '../utils/dateHelpers'
import './DateStrip.css'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_BEFORE = 30
const DAYS_AFTER = 60

function buildDays() {
  const today = new Date()
  const anchor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Array.from({ length: DAYS_BEFORE + DAYS_AFTER + 1 }, (_, i) => {
    const d = new Date(anchor)
    d.setDate(anchor.getDate() + i - DAYS_BEFORE)
    return d
  })
}

const DAYS = buildDays()

export default function DateStrip() {
  const { selectedDate, setSelectedDate } = useSelectedDate()
  const [workoutLogs] = useStorage('workout_logs', [])
  const [nutritionLogs] = useStorage('nutrition_logs', [])
  const scrollRef = useRef(null)

  const workoutDates = new Set(workoutLogs.filter(l => l.completed).map(l => l.date))
  const nutritionDates = new Set(
    nutritionLogs
      .filter(l =>
        (l.meals?.some(m => m.eaten)) ||
        ((l.quickLogs?.length ?? 0) > 0) ||
        ((l.calorieBump ?? 0) !== 0)
      )
      .map(l => l.date)
  )

  const todayStr = toLocalDateStr(new Date())
  const selectedStr = toLocalDateStr(selectedDate)

  useEffect(() => {
    if (!scrollRef.current) return
    const el = scrollRef.current.querySelector('.date-day.selected')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [selectedStr])

  return (
    <div className="date-strip" ref={scrollRef}>
      {DAYS.map(day => {
        const str = toLocalDateStr(day)
        const isSelected = str === selectedStr
        const isToday = str === todayStr
        const hasLog = workoutDates.has(str) || nutritionDates.has(str)
        return (
          <button
            key={str}
            className={`date-day${isSelected ? ' selected' : ''}${isToday && !isSelected ? ' today' : ''}`}
            onClick={() => setSelectedDate(new Date(day))}
          >
            <span className="date-day-label">{DAY_LABELS[day.getDay()]}</span>
            <span className="date-day-num">{day.getDate()}</span>
            {hasLog && <span className="date-day-dot" />}
          </button>
        )
      })}
    </div>
  )
}
