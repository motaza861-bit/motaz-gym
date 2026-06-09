import { useRef, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import './ExerciseEditForm.css'

export default function ExerciseEditForm({ exercise, onSave, onCancel }) {
  const { t } = useLanguage()
  const [form, setForm] = useState({
    name: exercise?.name ?? '',
    sets: exercise?.sets ?? 3,
    reps: exercise?.reps ?? '8-10',
    rest: exercise?.rest ?? 90,
    muscles: exercise?.muscles ?? '',
  })
  const [muscleStatus, setMuscleStatus] = useState('idle') // idle | loading | done | error
  const autoFilledRef = useRef(false) // true when muscles was set by AI (not typed manually)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  async function handleNameBlur() {
    const name = form.name.trim()
    if (!name || muscleStatus === 'loading') return
    // Don't overwrite if user manually typed something
    if (form.muscles.trim() && !autoFilledRef.current) return

    setMuscleStatus('loading')
    try {
      const res = await fetch('/api/detect-muscles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise: name }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setForm(f => ({ ...f, muscles: data.muscles }))
      autoFilledRef.current = true
      setMuscleStatus('done')
    } catch {
      setMuscleStatus('error')
    }
  }

  function handleMusclesChange(val) {
    autoFilledRef.current = false // user is typing manually now
    setMuscleStatus('idle')
    set('muscles', val)
  }

  function handleSave() {
    if (!form.name.trim()) return
    onSave({
      name: form.name.trim(),
      sets: Math.max(1, Number(form.sets) || 3),
      reps: form.reps.trim() || '8-10',
      rest: Number(form.rest) || 90,
      muscles: form.muscles.trim(),
    })
  }

  return (
    <div className="ex-edit-form">
      <div className="ex-edit-title">{exercise ? t('exf.edit') : t('exf.new')}</div>
      <div className="ex-edit-grid">
        <div className="ex-edit-field ex-edit-full">
          <label className="ex-edit-label" htmlFor="ex-name">{t('exf.name')}</label>
          <input
            id="ex-name"
            className="ex-edit-input"
            type="text"
            placeholder={t('exf.name_ph')}
            value={form.name}
            onChange={e => set('name', e.target.value)}
            onBlur={handleNameBlur}
          />
        </div>
        <div className="ex-edit-field">
          <label className="ex-edit-label" htmlFor="ex-sets">{t('exf.sets')}</label>
          <input id="ex-sets" className="ex-edit-input" type="number"
            inputMode="numeric" min="1" value={form.sets}
            onChange={e => set('sets', e.target.value)} />
        </div>
        <div className="ex-edit-field">
          <label className="ex-edit-label" htmlFor="ex-reps">{t('exf.reps')}</label>
          <input id="ex-reps" className="ex-edit-input" type="text"
            placeholder="8-10" value={form.reps}
            onChange={e => set('reps', e.target.value)} />
        </div>
        <div className="ex-edit-field">
          <label className="ex-edit-label" htmlFor="ex-rest">{t('exf.rest_s')}</label>
          <input id="ex-rest" className="ex-edit-input" type="number"
            inputMode="numeric" min="0" value={form.rest}
            onChange={e => set('rest', e.target.value)} />
        </div>
        <div className="ex-edit-field ex-edit-full">
          <label className="ex-edit-label" htmlFor="ex-muscles">
            {t('exf.muscles')}
            {muscleStatus === 'loading' && <span className="ex-muscle-spinner" />}
            {muscleStatus === 'done'    && <span className="ex-muscle-tag ex-muscle-done">✓ auto-detected</span>}
            {muscleStatus === 'error'   && <span className="ex-muscle-tag ex-muscle-error">could not detect</span>}
          </label>
          <input
            id="ex-muscles"
            className={`ex-edit-input${muscleStatus === 'loading' ? ' ex-input-loading' : ''}`}
            type="text"
            placeholder={muscleStatus === 'loading' ? 'Detecting…' : t('exf.muscles_ph')}
            value={form.muscles}
            disabled={muscleStatus === 'loading'}
            onChange={e => handleMusclesChange(e.target.value)}
          />
        </div>
      </div>
      <div className="ex-edit-actions">
        <button className="ex-edit-cancel" onClick={onCancel}>{t('exf.cancel')}</button>
        <button className="ex-edit-save" onClick={handleSave} disabled={!form.name.trim()}>{t('exf.save')}</button>
      </div>
    </div>
  )
}
