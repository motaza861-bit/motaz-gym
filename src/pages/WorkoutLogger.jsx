// src/pages/WorkoutLogger.jsx
import { useState, useEffect, useRef } from 'react'
import { useStorage } from '../hooks/useStorage'
import { getTodaySession, toLocalDateStr } from '../utils/dateHelpers'
import { detectPR } from '../utils/prDetector'
import { SESSIONS } from '../data/workoutProgram'
import ExerciseBlock from '../components/ExerciseBlock'
import RestTimer from '../components/RestTimer'
import './WorkoutLogger.css'

function buildInitialSets(exercise) {
  return Array.from({ length: exercise.sets }, () => ({
    weight: 0, reps: 0, completed: false, type: 'S', rpe: null,
  }))
}

function getPreviousSets(exerciseName, workoutLogs) {
  const sorted = [...workoutLogs]
    .filter(l => l.completed)
    .sort((a, b) => b.date.localeCompare(a.date))
  for (const log of sorted) {
    const ex = log.exercises?.find(e => e.name === exerciseName)
    if (ex) return ex.sets
  }
  return null
}

export default function WorkoutLogger() {
  const [workoutLogs, setWorkoutLogs] = useStorage('motaz_workout_logs', [])
  const now = new Date()
  const sessionKey = getTodaySession(now)
  const session = SESSIONS[sessionKey]

  const [exerciseSets, setExerciseSets] = useState(() =>
    session ? Object.fromEntries(session.exercises.map(ex => [ex.name, buildInitialSets(ex)])) : {}
  )
  // Maps original exercise name → replacement name for this session only
  const [swappedExercises, setSwappedExercises] = useState({})
  const [swapTarget, setSwapTarget] = useState(null)
  const [swapInput, setSwapInput] = useState('')
  const [activeRest, setActiveRest] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (!session || sessionKey === 'rest') {
    return (
      <div className="page workout-logger">
        <div className="logger-rest">
          <div className="logger-rest-emoji">😴</div>
          <h2>Rest Day</h2>
          <p>No training today — recover and come back tomorrow.</p>
        </div>
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
    if (!window.confirm('Finish workout and save? This will overwrite any previous log for today.')) return
    const todayStr = toLocalDateStr(new Date())
    // Save swapped names in the log so future ghost targets look up the right exercise
    const exercises = session.exercises.map(ex => ({
      name: swappedExercises[ex.name] ?? ex.name,
      sets: exerciseSets[ex.name],
    }))

    const prs = exercises
      .map(ex => detectPR(ex.name, ex.sets, workoutLogs))
      .filter(Boolean)
      .map(pr => ({ ...pr, date: todayStr }))

    const log = {
      date: todayStr,
      session: sessionKey,
      startedAt: startedAt.current,
      completedAt: Date.now(),
      completed: true,
      exercises,
      prs,
    }

    setWorkoutLogs(prev => [...prev.filter(l => l.date !== todayStr), log])

    alert(prs.length
      ? `Workout complete! 🏆 ${prs.length} new PR${prs.length > 1 ? 's' : ''}!`
      : 'Workout complete! Great work 💪'
    )
  }

  return (
    <div className="page workout-logger">
      <div className="logger-header">
        <div>
          <div className="logger-title">{session.name}</div>
          <div className="logger-sub">{session.muscles}</div>
        </div>
        <div className="logger-timer">⏱ {elapsedDisplay}</div>
      </div>

      {session.exercises.map(ex => {
        const effectiveName = swappedExercises[ex.name] ?? ex.name
        const previousSets = getPreviousSets(effectiveName, workoutLogs)

        return (
          <div key={ex.name}>
            {swapTarget === ex.name ? (
              <div className="swap-overlay card">
                <div className="swap-title">Replace exercise</div>
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
                  <button className="swap-cancel" onClick={() => { setSwapTarget(null); setSwapInput('') }}>Cancel</button>
                  <button className="swap-confirm" onClick={() => confirmSwap(ex.name)}>Swap</button>
                </div>
              </div>
            ) : (
              <ExerciseBlock
                exercise={{ ...ex, name: effectiveName }}
                sets={exerciseSets[ex.name] ?? []}
                onSetUpdate={(i, field, val) => handleSetUpdate(ex.name, i, field, val)}
                previousSets={previousSets}
                onSwap={() => { setSwapTarget(ex.name); setSwapInput(effectiveName) }}
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

      <button className="btn-primary" onClick={handleFinish}>
        ✅ Finish Workout
      </button>
    </div>
  )
}
