import { useState } from 'react'
import { useExercises } from '../hooks/useExercises'
import './Schedule.css'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function Schedule() {
  const [program, setProgram] = useExercises()
  const { sessions, daySession } = program
  const todayIdx = new Date().getDay()
  const [editing, setEditing] = useState(false)

  const trainingDaysCount = Object.values(daySession).filter(v => v !== 'rest').length
  const sessionCount = Object.keys(sessions).length

  function cycleDay(idx) {
    const options = [...Object.keys(sessions), 'rest']
    const current = daySession[idx] ?? 'rest'
    const next = options[(options.indexOf(current) + 1) % options.length]
    setProgram(p => ({ ...p, daySession: { ...p.daySession, [idx]: next } }))
  }

  return (
    <div className="page schedule-page">
      <div className="schedule-header-row">
        <div>
          <h1 className="schedule-title">Training Schedule 📅</h1>
          <p className="schedule-sub">{trainingDaysCount} training days/week · {sessionCount} distinct sessions</p>
        </div>
        <button
          className={`schedule-edit-btn${editing ? ' schedule-edit-btn--active' : ''}`}
          onClick={() => setEditing(e => !e)}
        >
          {editing ? 'Done' : '✏️ Edit'}
        </button>
      </div>

      {editing && (
        <p className="schedule-edit-hint">Tap a day to cycle through sessions</p>
      )}

      <div className="week-grid">
        {DAY_NAMES.map((day, idx) => {
          const sessionKey = daySession[idx]
          const isToday = idx === todayIdx
          const isRest = !sessionKey || sessionKey === 'rest'
          const data = isRest ? null : sessions[sessionKey]
          return (
            <div
              key={day}
              className={`day-card ${isToday ? 'today' : ''} ${isRest ? 'rest' : ''} ${editing ? 'day-card--editable' : ''}`}
              onClick={editing ? () => cycleDay(idx) : undefined}
            >
              <div className="day-card-header">
                <div className="day-name">{day} {isToday && <span className="today-badge">Today</span>}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!isRest && <div className="session-badge">{sessionKey}</div>}
                  {editing && <span className="day-cycle-hint">⇄</span>}
                </div>
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
