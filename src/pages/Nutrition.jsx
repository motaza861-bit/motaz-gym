import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useSelectedDate } from '../context/DateContext'
import { useMeals } from '../hooks/useMeals'
import { useTargets } from '../hooks/useTargets'
import { toLocalDateStr } from '../utils/dateHelpers'
import CalorieRing from '../components/CalorieRing'
import MacroBar from '../components/MacroBar'
import MealItem, { MealEditForm } from '../components/MealItem'
import DateStrip from '../components/DateStrip'
import './Nutrition.css'

function generateId() {
  return `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function Nutrition() {
  const { selectedDate } = useSelectedDate()
  const [nutritionLogs, setNutritionLogs] = useStorage('motaz_nutrition_logs', [])
  const [meals, setMeals] = useMeals()
  const [targets] = useTargets()
  const [editingId, setEditingId] = useState(null)

  const dateStr = toLocalDateStr(selectedDate)
  const dayLog = nutritionLogs.find(l => l.date === dateStr) ?? { date: dateStr, meals: [], calorieBump: 0 }
  const eatenIds = new Set(dayLog.meals.filter(m => m.eaten).map(m => m.id))
  const bump = dayLog.calorieBump ?? 0

  const eaten = meals.filter(m => eatenIds.has(m.id)).reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
  const totalCalories = Math.max(0, eaten.calories + bump)

  function updateDayLog(updater) {
    setNutritionLogs(prev => {
      const existing = prev.find(l => l.date === dateStr)
      const base = existing ?? { date: dateStr, meals: [], calorieBump: 0 }
      const updated = updater(base)
      return existing ? prev.map(l => l.date === dateStr ? updated : l) : [...prev, updated]
    })
  }

  function toggleMeal(mealId) {
    updateDayLog(base => {
      const alreadyEaten = base.meals.find(m => m.id === mealId)?.eaten
      const updatedMeals = alreadyEaten
        ? base.meals.map(m => m.id === mealId ? { ...m, eaten: false } : m)
        : [...base.meals.filter(m => m.id !== mealId), { id: mealId, eaten: true }]
      return { ...base, meals: updatedMeals }
    })
  }

  function adjustCalories(delta) {
    updateDayLog(base => ({ ...base, calorieBump: (base.calorieBump ?? 0) + delta }))
  }

  function saveMeal(updatedMeal) {
    if (editingId === 'new') {
      setMeals(prev => [...prev, { ...updatedMeal, id: generateId() }])
    } else {
      setMeals(prev => prev.map(m => m.id === editingId ? { ...m, ...updatedMeal } : m))
    }
    setEditingId(null)
  }

  function deleteMeal(mealId) {
    const name = meals.find(m => m.id === mealId)?.name ?? 'meal'
    if (!window.confirm(`Delete "${name}"?`)) return
    setMeals(prev => prev.filter(m => m.id !== mealId))
  }

  return (
    <div className="page nutrition">
      <DateStrip />

      <div className="nutrition-header">
        <h1 className="nutrition-title">Food Schedule 🥗</h1>
        <div className="nutrition-sub">
          {selectedDate.toLocaleDateString('en', { weekday: 'long' })} · {targets.calories} kcal target
        </div>
      </div>

      <div className="card">
        <CalorieRing eaten={totalCalories} target={targets.calories} />
        <div className="calorie-adjust">
          <button className="adjust-btn" onClick={() => adjustCalories(-100)}>−100</button>
          <span className="adjust-label">
            {bump > 0 ? `+${bump} extra kcal` : bump < 0 ? `${bump} kcal` : 'Quick adjust'}
          </span>
          <button className="adjust-btn" onClick={() => adjustCalories(100)}>+100</button>
        </div>
        <MacroBar label="Protein" value={eaten.protein} target={targets.protein} color="var(--red)" unit="g" />
        <MacroBar label="Carbs"   value={eaten.carbs}   target={targets.carbs}   color="var(--orange)" unit="g" />
        <MacroBar label="Fat"     value={eaten.fat}      target={targets.fat}     color="var(--yellow)" unit="g" />
      </div>

      <p className="section-title">Meal Plan</p>

      {meals.map(meal =>
        editingId === meal.id ? (
          <MealEditForm
            key={meal.id}
            meal={meal}
            onSave={saveMeal}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <MealItem
            key={meal.id}
            meal={meal}
            eaten={eatenIds.has(meal.id)}
            onToggle={() => toggleMeal(meal.id)}
            onEdit={() => setEditingId(meal.id)}
            onDelete={() => deleteMeal(meal.id)}
          />
        )
      )}

      {editingId === 'new' && (
        <MealEditForm
          meal={{ name: '', emoji: '🍽️', time: '', description: '', calories: 0, protein: 0, carbs: 0, fat: 0 }}
          onSave={saveMeal}
          onCancel={() => setEditingId(null)}
        />
      )}

      {editingId !== 'new' && (
        <button className="add-meal-btn" onClick={() => setEditingId('new')}>+ Add meal</button>
      )}
    </div>
  )
}
