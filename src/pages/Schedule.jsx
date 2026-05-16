import { useExercises } from '../hooks/useExercises'
import './Schedule.css'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function Schedule() {
  const [program] = useExercises()
  const { sessions, daySession } = program
  const todayIdx = new Date().getDay()

  const trainingDaysCount = Object.values(daySession).filter(v => v !== 'rest').length
  const sessionCount = Object.keys(sessions).length

  return (
    <div className="page schedule-page">
      <h1 className="schedule-title">Training Schedule 📅</h1>
      <p className="schedule-sub">{trainingDaysCount} training days/week · {sessionCount} distinct sessions</p>

      <div className="week-grid">
        {DAY_NAMES.map((day, idx) => {
          const sessionKey = daySession[idx]
          const isToday = idx === todayIdx
          const isRest = !sessionKey || sessionKey === 'rest'
          const data = isRest ? null : sessions[sessionKey]
          return (
            <div key={day} className={`day-card ${isToday ? 'today' : ''} ${isRest ? 'rest' : ''}`}>
              <div className="day-card-header">
                <div className="day-name">{day} {isToday && <span className="today-badge">Today</span>}</div>
                {!isRest && <div className="session-badge">{sessionKey}</div>}
              </div>
              {isRest ? (
                <div className="day-rest">😴 Rest &amp; Recover</div>
              ) : data ? (
                <>
                  <div className="day-focus">{data.focus}</div>
                  <div className="day-muscles">{data.muscles}</div>
                  <div className="day-exercises">
                    {data.exercises.map(ex => (
                      <div key={ex.name} className="day-ex">
                        <span className="day-ex-name">{ex.name}</span>
                        <span className="day-ex-sets">{ex.sets}×{ex.reps}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
