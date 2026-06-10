import { useState } from 'react'
import { useExercises } from '../hooks/useExercises'
import { useLanguage } from '../context/LanguageContext'
import './Schedule.css'

const DAY_KEYS = ['sc.day_sun', 'sc.day_mon', 'sc.day_tue', 'sc.day_wed', 'sc.day_thu', 'sc.day_fri', 'sc.day_sat']

export default function Schedule() {
  const { t } = useLanguage()
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
          <h1 className="schedule-title">{t('sc.title')}</h1>
          <p className="schedule-sub">{t('sc.subtitle', { days: trainingDaysCount, sessions: sessionCount })}</p>
        </div>
        <button
          className={`schedule-edit-btn${editing ? ' schedule-edit-btn--active' : ''}`}
          onClick={() => setEditing(e => !e)}
        >
          {editing ? t('sc.done') : t('sc.edit')}
        </button>
      </div>

      {editing && (
        <p className="schedule-edit-hint">{t('sc.edit_hint')}</p>
      )}

      <div className="week-grid">
        {DAY_KEYS.map((dayKey, idx) => {
          const dayName = t(dayKey)
          const sessionKey = daySession[idx]
          const isToday = idx === todayIdx
          const isRest = !sessionKey || sessionKey === 'rest'
          const data = isRest ? null : sessions[sessionKey]
          return (
            <div
              key={dayKey}
              className={`day-card ${isToday ? 'today' : ''} ${isRest ? 'rest' : ''} ${editing ? 'day-card--editable' : ''}`}
              onClick={editing ? () => cycleDay(idx) : undefined}
            >
              <div className="day-card-header">
                <div className="day-name">{dayName} {isToday && <span className="today-badge">{t('sc.today')}</span>}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!isRest && <div className="session-badge">{sessionKey}</div>}
                  {editing && <span className="day-cycle-hint">⇄</span>}
                </div>
              </div>
              {isRest ? (
                <div className="day-rest">{t('sc.rest')}</div>
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
