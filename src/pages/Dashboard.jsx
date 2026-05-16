import { useNavigate } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { useExercises } from '../hooks/useExercises'
import { useSelectedDate } from '../context/DateContext'
import { getTodaySession, getStreak, getWeekNumber, toLocalDateStr } from '../utils/dateHelpers'
import { useMeals } from '../hooks/useMeals'
import { useTargets } from '../hooks/useTargets'
import WorkoutCard from '../components/WorkoutCard'
import MacroBar from '../components/MacroBar'
import PRAlert from '../components/PRAlert'
import DateStrip from '../components/DateStrip'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const { selectedDate } = useSelectedDate()
  const [program] = useExercises()
  const [workoutLogs] = useStorage('motaz_workout_logs', [])
  const [nutritionLogs] = useStorage('motaz_nutrition_logs', [])
  const [profile] = useStorage('motaz_profile', {})
  const [meals] = useMeals()
  const [targets] = useTargets()

  const now = new Date()
  const selectedStr = toLocalDateStr(selectedDate)
  const sessionKey = getTodaySession(selectedDate, program.daySession)
  const session = program.sessions[sessionKey]
  const streak = getStreak(workoutLogs, program.daySession, now)

  const startDate = workoutLogs.length > 0
    ? [...workoutLogs].sort((a, b) => a.date.localeCompare(b.date))[0].date
    : toLocalDateStr(now)
  const weekNum = getWeekNumber(startDate, selectedDate)

  const todayNutrition = nutritionLogs.find(l => l.date === selectedStr)
  const eatenMealIds = new Set(todayNutrition?.meals?.filter(m => m.eaten).map(m => m.id) ?? [])

  const eaten = meals.filter(m => eatenMealIds.has(m.id)).reduce(
    (acc, m) => ({ protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
    { protein: 0, carbs: 0, fat: 0 }
  )

  const trainingDays = new Set(
    Object.entries(program.daySession)
      .filter(([, v]) => v !== 'rest')
      .map(([k]) => Number(k))
  )

  const daysUntilNext = (() => {
    for (let i = 1; i <= 7; i++) {
      if (trainingDays.has((now.getDay() + i) % 7)) return i
    }
    return 1
  })()
  const nextTrainingLabel = daysUntilNext === 1 ? 'tomorrow' : `in ${daysUntilNext} days`

  const latestPR = workoutLogs
    .flatMap(log => log.prs ?? [])
    .sort((a, b) => b.date?.localeCompare(a.date))
    .at(0) ?? null

  const userName = profile.name || 'Champ'

  return (
    <div className="page dashboard">
      <div className="dash-header">
        <div>
          <div className="dash-week">Week {weekNum} · {selectedDate.toLocaleDateString('en', { weekday: 'long' })}</div>
          <div className="dash-greeting">Let's go, <span>{userName} 🔥</span></div>
        </div>
        <div className="dash-header-right">
          <button className="dash-settings-btn" onClick={() => navigate('/settings')} title="Settings">⚙️</button>
          <div className="dash-avatar">{userName[0]?.toUpperCase() ?? '?'}</div>
        </div>
      </div>

      <DateStrip />

      <div className="dash-pills">
        <div className="pill hot">🔥 {streak}-day streak</div>
        <div className="pill">💪 {workoutLogs.filter(l => l.completed).length} sessions</div>
      </div>

      {sessionKey !== 'rest' && session && (
        <WorkoutCard
          session={session}
          sessionLabel={sessionKey}
          onStart={() => navigate('/workout')}
        />
      )}

      {(!session || sessionKey === 'rest') && (
        <div className="card rest-card">
          <div className="rest-emoji">😴</div>
          <div className="rest-title">Rest Day</div>
          <div className="rest-sub">Recover well — you train again {nextTrainingLabel}</div>
        </div>
      )}

      <p className="section-title">Today's Nutrition</p>
      <div className="card">
        <MacroBar label="Protein" value={eaten.protein} target={targets.protein} color="var(--red)" unit="g" />
        <MacroBar label="Carbs"   value={eaten.carbs}   target={targets.carbs}   color="var(--orange)" unit="g" />
        <MacroBar label="Fat"     value={eaten.fat}      target={targets.fat}     color="var(--yellow)" unit="g" />
      </div>

      {latestPR && <PRAlert pr={latestPR} />}
    </div>
  )
}
