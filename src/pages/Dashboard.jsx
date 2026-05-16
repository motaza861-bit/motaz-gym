import { useNavigate } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { useSelectedDate } from '../context/DateContext'
import { getTodaySession, getStreak, getWeekNumber, toLocalDateStr } from '../utils/dateHelpers'
import { SESSIONS } from '../data/workoutProgram'
import { useMeals } from '../hooks/useMeals'
import { useTargets } from '../hooks/useTargets'
import WorkoutCard from '../components/WorkoutCard'
import MacroBar from '../components/MacroBar'
import PRAlert from '../components/PRAlert'
import DateStrip from '../components/DateStrip'
import './Dashboard.css'

const START_DATE = '2026-05-15'
const TRAINING_DAYS_SET = new Set([1, 2, 4, 5])

export default function Dashboard() {
  const navigate = useNavigate()
  const { selectedDate } = useSelectedDate()
  const [workoutLogs] = useStorage('motaz_workout_logs', [])
  const [nutritionLogs] = useStorage('motaz_nutrition_logs', [])
  const [meals] = useMeals()
  const [targets] = useTargets()

  const now = new Date()
  const selectedStr = toLocalDateStr(selectedDate)
  const session = getTodaySession(selectedDate)
  const streak = getStreak(workoutLogs, now)
  const weekNum = getWeekNumber(START_DATE, selectedDate)

  const todayNutrition = nutritionLogs.find(l => l.date === selectedStr)
  const eatenMealIds = new Set(todayNutrition?.meals?.filter(m => m.eaten).map(m => m.id) ?? [])

  const eaten = meals.filter(m => eatenMealIds.has(m.id)).reduce(
    (acc, m) => ({ protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
    { protein: 0, carbs: 0, fat: 0 }
  )

  const daysUntilNext = (() => {
    for (let i = 1; i <= 7; i++) {
      if (TRAINING_DAYS_SET.has((now.getDay() + i) % 7)) return i
    }
    return 1
  })()
  const nextTrainingLabel = daysUntilNext === 1 ? 'tomorrow' : `in ${daysUntilNext} days`

  const latestPR = workoutLogs
    .flatMap(log => log.prs ?? [])
    .sort((a, b) => b.date?.localeCompare(a.date))
    .at(0) ?? null

  return (
    <div className="page dashboard">
      <div className="dash-header">
        <div>
          <div className="dash-week">Week {weekNum} · {selectedDate.toLocaleDateString('en', { weekday: 'long' })}</div>
          <div className="dash-greeting">Let's go, <span>Motaz 🔥</span></div>
        </div>
        <div className="dash-header-right">
          <button className="dash-settings-btn" onClick={() => navigate('/settings')} title="Settings">⚙️</button>
          <div className="dash-avatar">M</div>
        </div>
      </div>

      <DateStrip />

      <div className="dash-pills">
        <div className="pill hot">🔥 {streak}-day streak</div>
        <div className="pill">💪 {workoutLogs.filter(l => l.completed).length} sessions</div>
      </div>

      {session !== 'rest' && SESSIONS[session] && (
        <WorkoutCard
          session={SESSIONS[session]}
          sessionLabel={session}
          onStart={() => navigate('/workout')}
        />
      )}

      {session === 'rest' && (
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
