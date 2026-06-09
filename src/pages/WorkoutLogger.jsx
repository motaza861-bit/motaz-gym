import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { useSelectedDate } from '../context/DateContext'
import { getTodaySession, toLocalDateStr } from '../utils/dateHelpers'
import { detectPR } from '../utils/prDetector'
import { useExercises } from '../hooks/useExercises'
import { useLanguage } from '../context/LanguageContext'
import ExerciseBlock from '../components/ExerciseBlock'
import ExerciseEditForm from '../components/ExerciseEditForm'
import RestTimer from '../components/RestTimer'
import DateStrip from '../components/DateStrip'
import Paywall from '../components/Paywall'
import { useSubscription } from '../hooks/useSubscription'
import { hasTier, TIER_1 } from '../lib/tiers'
import './WorkoutLogger.css'
import './Classes.css'

function buildInitialSets(exercise) {
  return Array.from({ length: exercise.sets }, () => ({
    weight: 0, reps: 0, completed: false, type: 'S', rpe: null,
  }))
}

function getPreviousSets(exerciseName, workoutLogs, excludeDate) {
  const sorted = [...workoutLogs]
    .filter(l => l.completed && l.date !== excludeDate)
    .sort((a, b) => b.date.localeCompare(a.date))
  for (const log of sorted) {
    const ex = log.exercises?.find(e => e.name === exerciseName)
    if (ex) return ex.sets
  }
  return null
}

function generateClsId() {
  return `cls_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function WorkoutLogger() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [program, setProgramRaw] = useExercises()
  const SESSIONS = program.sessions
  const [workoutLogs, setWorkoutLogsRaw] = useStorage('workout_logs', [])
  const [classes, setClassesRaw] = useStorage('motaz_classes', [])
  const { effectiveTier } = useSubscription()
  const canWrite = hasTier(effectiveTier, TIER_1)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const gate = (raw) => (...args) => { if (!canWrite) { setPaywallOpen(true); return } raw(...args) }
  const setProgram = gate(setProgramRaw)
  const setWorkoutLogs = gate(setWorkoutLogsRaw)
  const setClasses = gate(setClassesRaw)
  const { selectedDate } = useSelectedDate()
  const sessionKey = getTodaySession(selectedDate, program.daySession)
  const session = SESSIONS[sessionKey]

  const [wlTab, setWlTab] = useState('workout')

  const [exerciseSets, setExerciseSets] = useState(() =>
    session ? Object.fromEntries(session.exercises.map(ex => [ex.name, buildInitialSets(ex)])) : {}
  )
  const [swappedExercises, setSwappedExercises] = useState({})
  const [swapTarget, setSwapTarget] = useState(null)
  const [swapInput, setSwapInput] = useState('')
  const [activeRest, setActiveRest] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const startedAt = useRef(Date.now())

  // Classes state
  const [clsAdding, setClsAdding] = useState(false)
  const [clsForm, setClsForm] = useState({ name: '', duration: '', note: '' })

  useEffect(() => {
    if (!timerRunning) return
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [timerRunning])

  useEffect(() => {
    setExerciseSets(
      session ? Object.fromEntries(session.exercises.map(ex => [ex.name, buildInitialSets(ex)])) : {}
    )
    setSwappedExercises({})
    setSwapTarget(null)
    setSwapInput('')
    setElapsed(0)
    setTimerRunning(false)
    setEditingId(null)
    startedAt.current = Date.now()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey])

  const dateStr = toLocalDateStr(selectedDate)
  const dayClasses = classes.filter(c => c.date === dateStr)

  function saveClass() {
    if (!clsForm.name.trim()) return
    setClasses(prev => [...prev, {
      id: generateClsId(),
      date: dateStr,
      name: clsForm.name.trim(),
      duration: clsForm.duration ? parseInt(clsForm.duration) : null,
      note: clsForm.note.trim() || null,
    }])
    setClsForm({ name: '', duration: '', note: '' })
    setClsAdding(false)
  }

  function deleteClass(id) {
    if (!window.confirm(t('cl.delete_confirm'))) return
    setClasses(prev => prev.filter(c => c.id !== id))
  }

  const tabRow = (
    <div className="wl-tab-row">
      <button
        className={`wl-tab${wlTab === 'workout' ? ' wl-tab-active' : ''}`}
        onClick={() => setWlTab('workout')}
      >🏋️ {t('nav.workout')}</button>
      <button
        className={`wl-tab${wlTab === 'classes' ? ' wl-tab-active' : ''}`}
        onClick={() => setWlTab('classes')}
      >🧘 {t('nav.classes')}</button>
    </div>
  )

  if (!session || sessionKey === 'rest') {
    return (
      <div className="page workout-logger">
        <button className="wl-schedule-link" onClick={() => navigate('/schedule')}>
          📅 Schedule
        </button>
        <DateStrip />
        {tabRow}
        {wlTab === 'workout' && (
          <div className="logger-rest">
            <div className="logger-rest-emoji">😴</div>
            <h2>{t('wl.rest_title')}</h2>
            <p>{t('wl.rest_sub')}</p>
          </div>
        )}
        {wlTab === 'classes' && renderClasses()}
      </div>
    )
  }

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const elapsedDisplay = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`

  function handleSetUpdate(exerciseName, setIndex, field, value) {
    setExerciseSets(prev => {
      const updated = prev[exerciseName].map((s, i) =>
        i === setIndex ? { ...s, [field]: value } : s
      )
      if (field === 'completed' && value === true) {
        const ex = session.exercises.find(e => e.name === exerciseName)
        setActiveRest({ exerciseName, seconds: ex.rest })
      }
      return { ...prev, [exerciseName]: updated }
    })
  }

  function confirmSwap(originalName) {
    const trimmed = swapInput.trim()
    if (trimmed && trimmed !== originalName) {
      setSwappedExercises(prev => ({ ...prev, [originalName]: trimmed }))
    }
    setSwapTarget(null)
    setSwapInput('')
  }

  function handleFinish() {
    if (!window.confirm(t('wl.finish_confirm'))) return

    const exercises = session.exercises.map(ex => ({
      name: swappedExercises[ex.name] ?? ex.name,
      sets: exerciseSets[ex.name],
    }))

    const prs = exercises
      .map(ex => detectPR(ex.name, ex.sets, workoutLogs))
      .filter(Boolean)
      .map(pr => ({ ...pr, date: dateStr }))

    const log = {
      date: dateStr,
      session: sessionKey,
      startedAt: startedAt.current,
      completedAt: Date.now(),
      completed: true,
      exercises,
      prs,
    }

    setWorkoutLogs(prev => [...prev.filter(l => l.date !== dateStr), log])

    alert(prs.length
      ? t('wl.saved_prs', { n: prs.length, s: prs.length > 1 ? 's' : '' })
      : t('wl.saved')
    )
  }

  function saveExercise(updated) {
    setProgram(prev => {
      const exercises = editingId === 'new'
        ? [...prev.sessions[sessionKey].exercises, updated]
        : prev.sessions[sessionKey].exercises.map(ex => ex.name === editingId ? updated : ex)
      return {
        ...prev,
        sessions: {
          ...prev.sessions,
          [sessionKey]: { ...prev.sessions[sessionKey], exercises },
        },
      }
    })
    if (editingId !== 'new' && editingId !== updated.name) {
      setExerciseSets(prev => {
        const { [editingId]: old, ...rest } = prev
        return { ...rest, [updated.name]: old ?? buildInitialSets(updated) }
      })
    } else if (editingId === 'new') {
      setExerciseSets(prev => ({ ...prev, [updated.name]: buildInitialSets(updated) }))
    }
    setEditingId(null)
  }

  function deleteExercise(name) {
    if (!window.confirm(t('wl.delete_confirm', { name }))) return
    setProgram(prev => ({
      ...prev,
      sessions: {
        ...prev.sessions,
        [sessionKey]: {
          ...prev.sessions[sessionKey],
          exercises: prev.sessions[sessionKey].exercises.filter(ex => ex.name !== name),
        },
      },
    }))
    setExerciseSets(prev => { const { [name]: _, ...rest } = prev; return rest })
  }

  function renderClasses() {
    return (
      <div className="wl-classes">
        <h2 className="classes-title">{t('cl.title')}</h2>

        {dayClasses.length === 0 && !clsAdding && (
          <p className="classes-empty">{t('cl.empty')}</p>
        )}

        {dayClasses.map(cls => (
          <div key={cls.id} className="class-card card">
            <div className="class-card-main">
              <div className="class-card-name">{cls.name}</div>
              {(cls.duration || cls.note) && (
                <div className="class-card-meta">
                  {cls.duration && <span>{cls.duration} min</span>}
                  {cls.duration && cls.note && <span className="class-meta-sep">·</span>}
                  {cls.note && <span>{cls.note}</span>}
                </div>
              )}
            </div>
            <button className="class-delete-btn" onClick={() => deleteClass(cls.id)} aria-label="Delete">🗑</button>
          </div>
        ))}

        {clsAdding && (
          <div className="class-add-form card">
            <div className="class-form-field">
              <label className="class-form-label">{t('cl.class_name')}</label>
              <input
                className="class-form-input"
                type="text"
                placeholder={t('cl.class_name_ph')}
                value={clsForm.name}
                autoFocus
                onChange={e => setClsForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && saveClass()}
              />
            </div>
            <div className="class-form-field">
              <label className="class-form-label">{t('cl.duration')}</label>
              <input
                className="class-form-input"
                type="number"
                inputMode="numeric"
                placeholder="60"
                value={clsForm.duration}
                onChange={e => setClsForm(f => ({ ...f, duration: e.target.value }))}
              />
            </div>
            <div className="class-form-field">
              <label className="class-form-label">{t('cl.note')}</label>
              <input
                className="class-form-input"
                type="text"
                value={clsForm.note}
                onChange={e => setClsForm(f => ({ ...f, note: e.target.value }))}
              />
            </div>
            <div className="class-form-actions">
              <button className="class-btn-cancel" onClick={() => { setClsAdding(false); setClsForm({ name: '', duration: '', note: '' }) }}>
                {t('cl.cancel')}
              </button>
              <button className="class-btn-save" onClick={saveClass} disabled={!clsForm.name.trim()}>
                {t('cl.save')}
              </button>
            </div>
          </div>
        )}

        {!clsAdding && (
          <button className="class-add-btn" onClick={() => setClsAdding(true)}>
            {t('cl.add')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="page workout-logger">
      <button className="wl-schedule-link" onClick={() => navigate('/schedule')}>
        📅 Schedule
      </button>
      <DateStrip />
      {tabRow}

      {wlTab === 'workout' && (
        <>
          <div className="logger-header">
            <div>
              <div className="logger-title">{session.name}</div>
              <div className="logger-sub">{session.muscles}</div>
            </div>
            <button
              className={`logger-timer${timerRunning ? ' logger-timer--running' : ' logger-timer--idle'}`}
              onClick={() => setTimerRunning(r => !r)}
              aria-label={timerRunning ? 'Pause timer' : 'Start timer'}
            >
              {timerRunning ? `⏱ ${elapsedDisplay}` : elapsed > 0 ? `▶ ${elapsedDisplay}` : '▶ Start'}
            </button>
          </div>

          {session.exercises.map(ex => {
            const effectiveName = swappedExercises[ex.name] ?? ex.name
            const previousSets = getPreviousSets(effectiveName, workoutLogs, dateStr)

            return (
              <div key={ex.name}>
                {editingId === ex.name ? (
                  <ExerciseEditForm
                    exercise={ex}
                    onSave={saveExercise}
                    onCancel={() => setEditingId(null)}
                  />
                ) : swapTarget === ex.name ? (
                  <div className="swap-overlay card">
                    <div className="swap-title">{t('wl.replace')}</div>
                    <input
                      className="swap-input"
                      type="text"
                      value={swapInput}
                      placeholder={effectiveName}
                      autoFocus
                      onChange={e => setSwapInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && confirmSwap(ex.name)}
                    />
                    <div className="swap-actions">
                      <button className="swap-cancel" onClick={() => { setSwapTarget(null); setSwapInput('') }}>{t('wl.cancel')}</button>
                      <button className="swap-confirm" onClick={() => confirmSwap(ex.name)}>{t('wl.swap')}</button>
                    </div>
                  </div>
                ) : (
                  <ExerciseBlock
                    exercise={{ ...ex, name: effectiveName }}
                    sets={exerciseSets[ex.name] ?? []}
                    onSetUpdate={(i, field, val) => handleSetUpdate(ex.name, i, field, val)}
                    previousSets={previousSets}
                    onSwap={swappedExercises[ex.name] ? undefined : () => { setSwapTarget(ex.name); setSwapInput(effectiveName) }}
                    onEdit={() => setEditingId(ex.name)}
                    onDelete={() => deleteExercise(ex.name)}
                  />
                )}
                {activeRest?.exerciseName === ex.name && activeRest.seconds > 0 && (
                  <RestTimer
                    seconds={activeRest.seconds}
                    onDone={() => setActiveRest(null)}
                  />
                )}
              </div>
            )
          })}

          {editingId === 'new' && (
            <ExerciseEditForm
              exercise={null}
              onSave={saveExercise}
              onCancel={() => setEditingId(null)}
            />
          )}

          {editingId === null && (
            <button className="add-exercise-btn" onClick={() => setEditingId('new')}>{t('wl.add_exercise')}</button>
          )}

          <button className="btn-primary" onClick={handleFinish}>
            {t('wl.finish')}
          </button>
        </>
      )}

      {wlTab === 'classes' && renderClasses()}

      {paywallOpen && (
        <div className="paywall-modal-bg" onClick={() => setPaywallOpen(false)}>
          <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
            <Paywall feature="log_workout" />
          </div>
        </div>
      )}
    </div>
  )
}
