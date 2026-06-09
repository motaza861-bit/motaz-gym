import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { useSelectedDate } from '../context/DateContext'
import { useMeals } from '../hooks/useMeals'
import { useTargets } from '../hooks/useTargets'
import { toLocalDateStr } from '../utils/dateHelpers'
import { useLanguage } from '../context/LanguageContext'
import CalorieRing from '../components/CalorieRing'
import MacroBar from '../components/MacroBar'
import MealItem, { MealEditForm } from '../components/MealItem'
import DateStrip from '../components/DateStrip'
import './Nutrition.css'

function generateId() {
  return `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function Nutrition() {
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedDate } = useSelectedDate()
  const [nutritionLogs, setNutritionLogs] = useStorage('nutrition_logs', [])
  const [meals, setMeals] = useMeals()
  const [targets] = useTargets()
  const [editingId, setEditingId] = useState(null)

  const dateStr = toLocalDateStr(selectedDate)
  const dayLog = nutritionLogs.find(l => l.date === dateStr) ?? { date: dateStr, meals: [], quickLogs: [], calorieBump: 0 }

  // Pick up food entry returned from FoodSearchPage / FoodScannerPage
  useEffect(() => {
    const entry = location.state?.quickLog
    if (!entry) return
    setNutritionLogs(prev => {
      const existing = prev.find(l => l.date === dateStr)
      const base = existing ?? { date: dateStr, meals: [], quickLogs: [], calorieBump: 0 }
      if ((base.quickLogs ?? []).some(q => q.id === entry.id)) return prev
      const updated = { ...base, quickLogs: [...(base.quickLogs ?? []), entry] }
      return existing ? prev.map(l => l.date === dateStr ? updated : l) : [...prev, updated]
    })
    window.history.replaceState({}, document.title)
  }, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const eatenIds = new Set(dayLog.meals.filter(m => m.eaten).map(m => m.id))
  const quickLogs = dayLog.quickLogs ?? []
  const bump = dayLog.calorieBump ?? 0

  const mealSum = meals.filter(m => eatenIds.has(m.id)).reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
  const quickSum = quickLogs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories ?? 0),
      protein: acc.protein + (l.protein ?? 0),
      carbs: acc.carbs + (l.carbs ?? 0),
      fat: acc.fat + (l.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
  const eaten = {
    calories: mealSum.calories + quickSum.calories,
    protein:  mealSum.protein  + quickSum.protein,
    carbs:    mealSum.carbs    + quickSum.carbs,
    fat:      mealSum.fat      + quickSum.fat,
  }
  const totalCalories = Math.max(0, eaten.calories + bump)

  function updateDayLog(updater) {
    setNutritionLogs(prev => {
      const existing = prev.find(l => l.date === dateStr)
      const base = existing ?? { date: dateStr, meals: [], quickLogs: [], calorieBump: 0 }
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
    if (!window.confirm(t('nu.delete_confirm', { name }))) return
    setMeals(prev => prev.filter(m => m.id !== mealId))
  }

  function toggleFavorite(mealId) {
    setMeals(prev => prev.map(m => m.id === mealId ? { ...m, favorite: !m.favorite } : m))
  }

  function addQuickLog(entry) {
    updateDayLog(base => ({
      ...base,
      quickLogs: [...(base.quickLogs ?? []), entry],
    }))
  }

  function deleteQuickLog(id) {
    if (!window.confirm(t('nu.delete_quick'))) return
    updateDayLog(base => ({
      ...base,
      quickLogs: (base.quickLogs ?? []).filter(l => l.id !== id),
    }))
  }

  const favMeals = meals.filter(m => m.favorite)

  return (
    <div className="page nutrition">
      <DateStrip />

      <div className="nutrition-header">
        <div className="nutrition-header-row">
          <h1 className="nutrition-title">{t('nu.title')}</h1>
          <div className="nutrition-header-btns">
            <button className="nutrition-scan-btn" onClick={() => navigate('/food-search')} aria-label="Search food">🔍</button>
            <button className="nutrition-scan-btn" onClick={() => navigate('/food-scan')} aria-label="Scan food">📷</button>
          </div>
        </div>
        <div className="nutrition-sub">
          {selectedDate.toLocaleDateString(lang, { weekday: 'long' })} · {targets.calories} {t('nu.kcal_target')}
        </div>
      </div>

      <div className="card">
        <CalorieRing eaten={totalCalories} target={targets.calories} />
        <div className="calorie-adjust">
          <button className="adjust-btn" onClick={() => adjustCalories(-100)}>−100</button>
          <span className="adjust-label">
            {bump > 0 ? `+${bump} extra kcal` : bump < 0 ? `${bump} kcal` : t('nu.quick_adjust')}
          </span>
          <button className="adjust-btn" onClick={() => adjustCalories(100)}>+100</button>
        </div>
        <MacroBar label="Protein" value={eaten.protein} target={targets.protein} color="var(--accent)" unit="g" />
        <MacroBar label="Carbs"   value={eaten.carbs}   target={targets.carbs}   color="var(--orange)" unit="g" />
        <MacroBar label="Fat"     value={eaten.fat}      target={targets.fat}     color="var(--yellow)" unit="g" />
      </div>

      {/* Favorites quick-add */}
      {favMeals.length > 0 && (
        <>
          <p className="section-title">{t('nu.favorites')}</p>
          <div className="fav-row">
            {favMeals.map(meal => (
              <button
                key={meal.id}
                className={`fav-chip${eatenIds.has(meal.id) ? ' fav-chip-eaten' : ''}`}
                onClick={() => toggleMeal(meal.id)}
              >
                <span className="fav-chip-emoji">{meal.emoji}</span>
                <span className="fav-chip-name">{meal.name}</span>
                <span className="fav-chip-kcal">{meal.calories} kcal</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Today's quick food log (from search) */}
      {quickLogs.length > 0 && (
        <>
          <p className="section-title">{t('nu.quick_log')}</p>
          {quickLogs.map(log => (
            <div key={log.id} className="quick-log-item">
              <span className="quick-log-emoji">{log.emoji}</span>
              <div className="quick-log-body">
                <span className="quick-log-name">
                  {log._aiEstimate && <span className="quick-log-ai" title="AI estimate">✨ </span>}
                  {log.name}
                </span>
                <span className="quick-log-portion">{log.portionG}g</span>
              </div>
              <span className="quick-log-kcal">{log.calories} kcal</span>
              <button className="quick-log-del" onClick={() => deleteQuickLog(log.id)} aria-label="Delete">🗑</button>
            </div>
          ))}
        </>
      )}

      <p className="section-title">{t('nu.meal_plan')}</p>

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
            onFavorite={() => toggleFavorite(meal.id)}
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
        <button className="add-meal-btn" onClick={() => setEditingId('new')}>{t('nu.add_meal')}</button>
      )}

    </div>
  )
}
