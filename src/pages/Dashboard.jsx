import { useNavigate } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { getTodaySession, getStreak, getWeekNumber } from '../utils/dateHelpers'
import { SESSIONS } from '../data/workoutProgram'
import { MEALS, TARGETS } from '../data/nutritionPlan'
import WorkoutCard from '../components/WorkoutCard'
import MacroBar from '../components/MacroBar'
import PRAlert from '../components/PRAlert'
import './Dashboard.css'

const START_DATE = '2026-05-15'

export default function Dashboard() {
  const navigate = useNavigate()
  const [workoutLogs] = useStorage('motaz_workout_logs', [])
  const [nutritionLogs] = useStorage('motaz_nutrition_logs', [])

  const todayStr = new Date().toISOString().split('T')[0]
  const session = getTodaySession()
  const streak = getStreak(workoutLogs)
  const weekNum = getWeekNumber(START_DATE)

  const todayNutrition = nutritionLogs.find(l => l.date === todayStr)
  const eatenMealIds = new Set(todayNutrition?.meals?.filter(m => m.eaten).map(m => m.id) ?? [])

  const latestPR = workoutLogs
    .flatMap(log => log.prs ?? [])
    .sort((a, b) => b.date?.localeCompare(a.date))
    .at(0) ?? null

  return (
    <div className="page dashboard">
      <div className="dash-header">
        <div>
          <div className="dash-week">Week {weekNum} · {new Date().toLocaleDateString('en', { weekday: 'long' })}</div>
          <div className="dash-greeting">Let's go, <span>Motaz 🔥</span></div>
        </div>
        <div className="dash-header-right">
          <button className="dash-settings-btn" onClick={() => navigate('/settings')} title="Settings">⚙️</button>
          <div className="dash-avatar">M</div>
        </div>
      </div>

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
          <div className="rest-sub">Recover well — you train again tomorrow</div>
        </div>
      )}

      <p className="section-title">Today's Nutrition</p>
      <div className="card">
        {(() => {
          const eaten = MEALS.filter(m => eatenMealIds.has(m.id)).reduce(
            (acc, m) => ({ protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
            { protein: 0, carbs: 0, fat: 0 }
          )
          return (
            <>
              <MacroBar label="Protein" value={eaten.protein} target={TARGETS.protein} color="var(--red)" unit="g" />
              <MacroBar label="Carbs"   value={eaten.carbs}   target={TARGETS.carbs}   color="var(--orange)" unit="g" />
              <MacroBar label="Fat"     value={eaten.fat}      target={TARGETS.fat}     color="var(--yellow)" unit="g" />
            </>
          )
        })()}
      </div>

      {latestPR && <PRAlert pr={latestPR} />}
    </div>
  )
}
