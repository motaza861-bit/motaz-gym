import { useState } from 'react'
import './MealItem.css'

export function MealEditForm({ meal, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: meal.name ?? '',
    emoji: meal.emoji ?? '🍽️',
    time: meal.time ?? '',
    description: meal.description ?? '',
    calories: meal.calories ?? 0,
    protein: meal.protein ?? 0,
    carbs: meal.carbs ?? 0,
    fat: meal.fat ?? 0,
  })

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
  }

  function handleSave() {
    if (!form.name.trim()) return
    onSave({
      ...form,
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
    })
  }

  return (
    <div className="meal-edit-form">
      <div className="meal-edit-title">{meal.id ? 'Edit meal' : 'New meal'}</div>
      <div className="meal-edit-grid">
        <label className="meal-edit-label">
          Name
          <input className="meal-edit-input" value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="e.g. Lunch" />
        </label>
        <label className="meal-edit-label">
          Emoji
          <input className="meal-edit-input meal-edit-emoji" value={form.emoji}
            onChange={e => set('emoji', e.target.value)} maxLength={2} />
        </label>
        <label className="meal-edit-label">
          Time
          <input className="meal-edit-input" value={form.time}
            onChange={e => set('time', e.target.value)} placeholder="e.g. 1:00 PM" />
        </label>
        <label className="meal-edit-label meal-edit-full">
          Description
          <input className="meal-edit-input" value={form.description}
            onChange={e => set('description', e.target.value)} placeholder="What's in it?" />
        </label>
        <label className="meal-edit-label">
          Calories
          <input className="meal-edit-input" type="number" inputMode="numeric"
            value={form.calories} onChange={e => set('calories', e.target.value)} />
        </label>
        <label className="meal-edit-label">
          Protein (g)
          <input className="meal-edit-input" type="number" inputMode="numeric"
            value={form.protein} onChange={e => set('protein', e.target.value)} />
        </label>
        <label className="meal-edit-label">
          Carbs (g)
          <input className="meal-edit-input" type="number" inputMode="numeric"
            value={form.carbs} onChange={e => set('carbs', e.target.value)} />
        </label>
        <label className="meal-edit-label">
          Fat (g)
          <input className="meal-edit-input" type="number" inputMode="numeric"
            value={form.fat} onChange={e => set('fat', e.target.value)} />
        </label>
      </div>
      <div className="meal-edit-actions">
        <button className="meal-edit-cancel" onClick={onCancel}>Cancel</button>
        <button className="meal-edit-save" onClick={handleSave}>Save</button>
      </div>
    </div>
  )
}

export default function MealItem({ meal, eaten, onToggle, onEdit, onDelete }) {
  return (
    <div className={`meal-item ${eaten ? 'meal-eaten' : ''}`} onClick={onToggle}>
      <div className="meal-emoji">{meal.emoji}</div>
      <div className="meal-body">
        <div className="meal-name">{meal.name}</div>
        <div className="meal-time">{meal.time} · {meal.description}</div>
      </div>
      <div className="meal-right">
        <div className="meal-kcal">{meal.calories}</div>
        <div className="meal-actions" onClick={e => e.stopPropagation()}>
          {onEdit && (
            <button className="meal-action-btn" onClick={onEdit} title="Edit meal">✏️</button>
          )}
          {onDelete && (
            <button className="meal-action-btn" onClick={onDelete} title="Delete meal">🗑️</button>
          )}
        </div>
        <div className={`meal-check ${eaten ? 'checked' : ''}`}>{eaten ? '✓' : ''}</div>
      </div>
    </div>
  )
}
