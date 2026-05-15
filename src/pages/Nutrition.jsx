// src/pages/Nutrition.jsx
import { useStorage } from '../hooks/useStorage'
import { toLocalDateStr } from '../utils/dateHelpers'
import { MEALS, TARGETS } from '../data/nutritionPlan'
import CalorieRing from '../components/CalorieRing'
import MacroBar from '../components/MacroBar'
import MealItem from '../components/MealItem'
import './Nutrition.css'

export default function Nutrition() {
  const [nutritionLogs, setNutritionLogs] = useStorage('motaz_nutrition_logs', [])
  const now = new Date()
  const todayStr = toLocalDateStr(now)
  const todayLog = nutritionLogs.find(l => l.date === todayStr) ?? { date: todayStr, meals: [], calorieBump: 0 }

  const eatenIds = new Set(todayLog.meals.filter(m => m.eaten).map(m => m.id))
  const bump = todayLog.calorieBump ?? 0

  const eaten = MEALS.filter(m => eatenIds.has(m.id)).reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const totalCalories = eaten.calories + bump

  function updateLog(changes) {
    setNutritionLogs(prev => {
      const existing = prev.find(l => l.date === todayStr)
      const updated = { ...(existing ?? { date: todayStr, meals: [], calorieBump: 0 }), ...changes }
      return existing
        ? prev.map(l => l.date === todayStr ? updated : l)
        : [...prev, updated]
    })
  }

  function toggleMeal(mealId) {
    const meals = todayLog.meals
    const alreadyEaten = meals.find(m => m.id === mealId)?.eaten
    const updatedMeals = alreadyEaten
      ? meals.map(m => m.id === mealId ? { ...m, eaten: false } : m)
      : [...meals.filter(m => m.id !== mealId), { id: mealId, eaten: true }]
    updateLog({ meals: updatedMeals })
  }

  function adjustCalories(delta) {
    updateLog({ calorieBump: bump + delta })
  }

  return (
    <div className="page nutrition">
      <div className="nutrition-header">
        <h1 className="nutrition-title">Food Schedule 🥗</h1>
        <div className="nutrition-sub">
          {now.toLocaleDateString('en', { weekday: 'long' })} · Recomp · {TARGETS.calories} kcal target
        </div>
      </div>

      <div className="card">
        <CalorieRing eaten={totalCalories} target={TARGETS.calories} />

        <div className="calorie-adjust">
          <button className="adjust-btn" onClick={() => adjustCalories(-100)}>−100</button>
          <span className="adjust-label">
            {bump > 0 ? `+${bump} extra kcal` : bump < 0 ? `${bump} kcal` : 'Quick adjust'}
          </span>
          <button className="adjust-btn" onClick={() => adjustCalories(100)}>+100</button>
        </div>

        <MacroBar label="Protein" value={eaten.protein} target={TARGETS.protein} color="var(--red)" unit="g" />
        <MacroBar label="Carbs"   value={eaten.carbs}   target={TARGETS.carbs}   color="var(--orange)" unit="g" />
        <MacroBar label="Fat"     value={eaten.fat}      target={TARGETS.fat}     color="var(--yellow)" unit="g" />
      </div>

      <p className="section-title">Meal Plan</p>
      {MEALS.map(meal => (
        <MealItem
          key={meal.id}
          meal={meal}
          eaten={eatenIds.has(meal.id)}
          onToggle={() => toggleMeal(meal.id)}
        />
      ))}
    </div>
  )
}
