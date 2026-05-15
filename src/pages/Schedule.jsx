// src/pages/Schedule.jsx
import { SESSIONS } from '../data/workoutProgram'
import './Schedule.css'

const WEEK = [
  { day: 'Monday',    session: 'A' },
  { day: 'Tuesday',   session: 'B' },
  { day: 'Wednesday', session: 'rest' },
  { day: 'Thursday',  session: 'A' },
  { day: 'Friday',    session: 'B' },
  { day: 'Saturday',  session: 'rest' },
  { day: 'Sunday',    session: 'rest' },
]

const TODAY_NAME = new Date().toLocaleDateString('en', { weekday: 'long' })

export default function Schedule() {
  return (
    <div className="page schedule-page">
      <h1 className="schedule-title">Training Schedule 📅</h1>
      <p className="schedule-sub">4-day Full Body A/B · Evidence-based recomp program</p>

      <div className="week-grid">
        {WEEK.map(({ day, session }) => {
          const isToday = day === TODAY_NAME
          const isRest = session === 'rest'
          const data = isRest ? null : SESSIONS[session]
          return (
            <div key={day} className={`day-card ${isToday ? 'today' : ''} ${isRest ? 'rest' : ''}`}>
              <div className="day-card-header">
                <div className="day-name">{day} {isToday && <span className="today-badge">Today</span>}</div>
                {!isRest && <div className="session-badge">{session}</div>}
              </div>
              {isRest ? (
                <div className="day-rest">😴 Rest &amp; Recover</div>
              ) : (
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
              )}
            </div>
          )
        })}
      </div>

      <div className="protocol-box">
        <div className="protocol-title">Training Protocol</div>
        <div className="protocol-item">📦 <strong>Sets:</strong> 3–4 · <strong>Reps:</strong> 6–12 · <strong>Intensity:</strong> 60–80% 1RM</div>
        <div className="protocol-item">⏱ <strong>Rest:</strong> 2–3 min compounds · 1 min accessories</div>
        <div className="protocol-item">🎯 Stop 1–2 reps shy of failure for best recomp results</div>
      </div>
    </div>
  )
}
