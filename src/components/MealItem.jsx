// src/components/MealItem.jsx
import './MealItem.css'

export default function MealItem({ meal, eaten, onToggle }) {
  return (
    <div className={`meal-item ${eaten ? 'meal-eaten' : ''}`} onClick={onToggle}>
      <div className="meal-emoji">{meal.emoji}</div>
      <div className="meal-body">
        <div className="meal-name">{meal.name}</div>
        <div className="meal-time">{meal.time} · {meal.description}</div>
      </div>
      <div className="meal-right">
        <div className="meal-kcal">{meal.calories}</div>
        <div className={`meal-check ${eaten ? 'checked' : ''}`}>{eaten ? '✓' : ''}</div>
      </div>
    </div>
  )
}
