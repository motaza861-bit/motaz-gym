import { useState } from 'react'
import './ExerciseEditForm.css'

export default function ExerciseEditForm({ exercise, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: exercise?.name ?? '',
    sets: exercise?.sets ?? 3,
    reps: exercise?.reps ?? '8-10',
    rest: exercise?.rest ?? 90,
    muscles: exercise?.muscles ?? '',
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  function handleSave() {
    if (!form.name.trim()) return
    onSave({
      name: form.name.trim(),
      sets: Number(form.sets) || 3,
      reps: form.reps.trim() || '8-10',
      rest: Number(form.rest) || 90,
      muscles: form.muscles.trim(),
    })
  }

  return (
    <div className="ex-edit-form">
      <div className="ex-edit-title">{exercise ? 'Edit Exercise' : 'New Exercise'}</div>
      <div className="ex-edit-grid">
        <div className="ex-edit-field ex-edit-full">
          <label className="ex-edit-label">Name</label>
          <input className="ex-edit-input" type="text" placeholder="e.g. Bench Press" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="ex-edit-field">
          <label className="ex-edit-label">Sets</label>
          <input className="ex-edit-input" type="number" inputMode="numeric" min="1" value={form.sets} onChange={e => set('sets', e.target.value)} />
        </div>
        <div className="ex-edit-field">
          <label className="ex-edit-label">Reps</label>
          <input className="ex-edit-input" type="text" placeholder="8-10" value={form.reps} onChange={e => set('reps', e.target.value)} />
        </div>
        <div className="ex-edit-field">
          <label className="ex-edit-label">Rest (s)</label>
          <input className="ex-edit-input" type="number" inputMode="numeric" min="0" value={form.rest} onChange={e => set('rest', e.target.value)} />
        </div>
        <div className="ex-edit-field ex-edit-full">
          <label className="ex-edit-label">Muscles</label>
          <input className="ex-edit-input" type="text" placeholder="e.g. Chest, Triceps" value={form.muscles} onChange={e => set('muscles', e.target.value)} />
        </div>
      </div>
      <div className="ex-edit-actions">
        <button className="ex-edit-cancel" onClick={onCancel}>Cancel</button>
        <button className="ex-edit-save" onClick={handleSave} disabled={!form.name.trim()}>Save</button>
      </div>
    </div>
  )
}
