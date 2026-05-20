import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import './MealItem.css'

export function MealEditForm({ meal, onSave, onCancel }) {
  const { t } = useLanguage()
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
  const [aiStatus, setAiStatus] = useState('idle') // idle | loading | done | error

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function calculateMacros() {
    if (!form.description.trim() || aiStatus === 'loading') return
    setAiStatus('loading')
    try {
      const res = await fetch('/api/analyze-meal-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: form.description }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setForm(f => ({ ...f, calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat }))
      setAiStatus('done')
    } catch {
      setAiStatus('error')
    }
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

  const aiLabel = aiStatus === 'loading' ? t('nu.ai_calc_loading')
    : aiStatus === 'done' ? t('nu.ai_calc_done')
    : aiStatus === 'error' ? t('nu.ai_calc_error')
    : t('nu.ai_calc')

  return (
    <div className="meal-edit-form">
      <div className="meal-edit-title">{meal.id ? t('nu.edit_meal') : t('nu.new_meal')}</div>
      <div className="meal-edit-grid">
        <label className="meal-edit-label">
          {t('nu.field_name')}
          <input className="meal-edit-input" value={form.name}
            onChange={e => set('name', e.target.value)} placeholder={t('nu.field_name_ph')} />
        </label>
        <label className="meal-edit-label">
          {t('nu.field_emoji')}
          <input className="meal-edit-input meal-edit-emoji" value={form.emoji}
            onChange={e => set('emoji', e.target.value)} maxLength={2} />
        </label>
        <label className="meal-edit-label">
          {t('nu.field_time')}
          <input className="meal-edit-input" value={form.time}
            onChange={e => set('time', e.target.value)} placeholder={t('nu.field_time_ph')} />
        </label>
        <label className="meal-edit-label meal-edit-full">
          {t('nu.field_desc')}
          <div className="meal-desc-row">
            <input className="meal-edit-input" value={form.description}
              onChange={e => { set('description', e.target.value); setAiStatus('idle') }}
              placeholder={t('nu.field_desc_ph')} />
            <button
              className={`meal-ai-btn meal-ai-btn--${aiStatus}`}
              onClick={calculateMacros}
              disabled={!form.description.trim() || aiStatus === 'loading'}
              title={t('nu.ai_calc')}
            >
              {aiStatus === 'loading' ? <span className="meal-ai-spinner" /> : '✨'}
            </button>
          </div>
          {aiStatus !== 'idle' && (
            <span className={`meal-ai-status meal-ai-status--${aiStatus}`}>{aiLabel}</span>
          )}
        </label>
        <label className="meal-edit-label">
          {t('nu.field_cal')}
          <input className="meal-edit-input" type="number" inputMode="numeric"
            value={form.calories} onChange={e => set('calories', e.target.value)} />
        </label>
        <label className="meal-edit-label">
          {t('nu.field_protein')}
          <input className="meal-edit-input" type="number" inputMode="numeric"
            value={form.protein} onChange={e => set('protein', e.target.value)} />
        </label>
        <label className="meal-edit-label">
          {t('nu.field_carbs')}
          <input className="meal-edit-input" type="number" inputMode="numeric"
            value={form.carbs} onChange={e => set('carbs', e.target.value)} />
        </label>
        <label className="meal-edit-label">
          {t('nu.field_fat')}
          <input className="meal-edit-input" type="number" inputMode="numeric"
            value={form.fat} onChange={e => set('fat', e.target.value)} />
        </label>
      </div>
      <div className="meal-edit-actions">
        <button className="meal-edit-cancel" onClick={onCancel}>{t('nu.cancel')}</button>
        <button className="meal-edit-save" onClick={handleSave} disabled={!form.name.trim()}>{t('nu.save')}</button>
      </div>
    </div>
  )
}

export default function MealItem({ meal, eaten, onToggle, onEdit, onDelete, onFavorite }) {
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
          {onFavorite && (
            <button className={`meal-action-btn meal-fav-btn${meal.favorite ? ' meal-fav-on' : ''}`}
              onClick={onFavorite} title="Favourite">
              {meal.favorite ? '⭐' : '☆'}
            </button>
          )}
          {onEdit && <button className="meal-action-btn" onClick={onEdit} title="Edit meal">✏️</button>}
          {onDelete && <button className="meal-action-btn" onClick={onDelete} title="Delete meal">🗑️</button>}
        </div>
        <div className={`meal-check ${eaten ? 'checked' : ''}`}>{eaten ? '✓' : ''}</div>
      </div>
    </div>
  )
}
