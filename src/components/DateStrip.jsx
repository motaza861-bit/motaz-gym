import { useSelectedDate } from '../context/DateContext'
import { useStorage } from '../hooks/useStorage'
import { toLocalDateStr } from '../utils/dateHelpers'
import './DateStrip.css'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDays(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayOfWeek = d.getDay()
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return day
  })
}

export default function DateStrip() {
  const { selectedDate, setSelectedDate } = useSelectedDate()
  const [workoutLogs] = useStorage('motaz_workout_logs', [])

  const completedDates = new Set(workoutLogs.filter(l => l.completed).map(l => l.date))
  const todayStr = toLocalDateStr(new Date())
  const selectedStr = toLocalDateStr(selectedDate)
  const days = getWeekDays(selectedDate)

  function shiftWeek(delta) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + delta * 7)
    setSelectedDate(d)
  }

  return (
    <div className="date-strip">
      <button className="date-strip-arrow" onClick={() => shiftWeek(-1)}>‹</button>
      <div className="date-strip-days">
        {days.map((day, i) => {
          const str = toLocalDateStr(day)
          const isSelected = str === selectedStr
          const isToday = str === todayStr
          const hasLog = completedDates.has(str)
          return (
            <button
              key={str}
              className={`date-day${isSelected ? ' selected' : ''}${isToday && !isSelected ? ' today' : ''}`}
              onClick={() => setSelectedDate(new Date(day))}
            >
              <span className="date-day-label">{DAY_LABELS[i]}</span>
              <span className="date-day-num">{day.getDate()}</span>
              {hasLog && <span className="date-day-dot" />}
            </button>
          )
        })}
      </div>
      <button className="date-strip-arrow" onClick={() => shiftWeek(1)}>›</button>
    </div>
  )
}
