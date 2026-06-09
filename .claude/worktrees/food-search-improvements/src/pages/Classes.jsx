import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useSelectedDate } from '../context/DateContext'
import { toLocalDateStr } from '../utils/dateHelpers'
import { useLanguage } from '../context/LanguageContext'
import DateStrip from '../components/DateStrip'
import './Classes.css'

function generateId() {
  return `cls_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function Classes() {
  const { t } = useLanguage()
  const { selectedDate } = useSelectedDate()
  const [classes, setClasses] = useStorage('motaz_classes', [])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', duration: '', note: '' })

  const dateStr = toLocalDateStr(selectedDate)
  const dayClasses = classes.filter(c => c.date === dateStr)

  function saveClass() {
    if (!form.name.trim()) return
    setClasses(prev => [...prev, {
      id: generateId(),
      date: dateStr,
      name: form.name.trim(),
      duration: form.duration ? parseInt(form.duration) : null,
      note: form.note.trim() || null,
    }])
    setForm({ name: '', duration: '', note: '' })
    setAdding(false)
  }

  function deleteClass(id) {
    if (!window.confirm(t('cl.delete_confirm'))) return
    setClasses(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="page classes-page">
      <DateStrip />
      <h1 className="classes-title">{t('cl.title')}</h1>

      {dayClasses.length === 0 && !adding && (
        <p className="classes-empty">{t('cl.empty')}</p>
      )}

      {dayClasses.map(cls => (
        <div key={cls.id} className="class-card card">
          <div className="class-card-main">
            <div className="class-card-name">{cls.name}</div>
            {(cls.duration || cls.note) && (
              <div className="class-card-meta">
                {cls.duration && <span>{cls.duration} {t('cl.duration').replace(' (min)', '')} min</span>}
                {cls.duration && cls.note && <span className="class-meta-sep">·</span>}
                {cls.note && <span>{cls.note}</span>}
              </div>
            )}
          </div>
          <button className="class-delete-btn" onClick={() => deleteClass(cls.id)} aria-label="Delete">🗑</button>
        </div>
      ))}

      {adding && (
        <div className="class-add-form card">
          <div className="class-form-field">
            <label className="class-form-label">{t('cl.class_name')}</label>
            <input
              className="class-form-input"
              type="text"
              placeholder={t('cl.class_name_ph')}
              value={form.name}
              autoFocus
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && saveClass()}
            />
          </div>
          <div className="class-form-field">
            <label className="class-form-label">{t('cl.duration')}</label>
            <input
              className="class-form-input"
              type="number"
              inputMode="numeric"
              placeholder="60"
              value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
            />
          </div>
          <div className="class-form-field">
            <label className="class-form-label">{t('cl.note')}</label>
            <input
              className="class-form-input"
              type="text"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            />
          </div>
          <div className="class-form-actions">
            <button className="class-btn-cancel" onClick={() => { setAdding(false); setForm({ name: '', duration: '', note: '' }) }}>
              {t('cl.cancel')}
            </button>
            <button className="class-btn-save" onClick={saveClass} disabled={!form.name.trim()}>
              {t('cl.save')}
            </button>
          </div>
        </div>
      )}

      {!adding && (
        <button className="class-add-btn" onClick={() => setAdding(true)}>
          {t('cl.add')}
        </button>
      )}
    </div>
  )
}
