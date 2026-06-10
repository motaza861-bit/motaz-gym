import { useState } from 'react'
import { toLocalDateStr } from '../utils/dateHelpers'
import { kgToDisplay, displayToKg, unitLabel } from '../utils/units'
import { useLanguage } from '../context/LanguageContext'
import './BigThreeCard.css'

const VISIBLE_LIMIT = 5

function generateId() {
  return `big3_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function BigThreeCard({ lift, title, entries, onAdd, onDelete, unit = 'kg' }) {
  const { t } = useLanguage()
  const label = unitLabel(unit)
  const [adding, setAdding] = useState(false)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [date, setDate] = useState(() => toLocalDateStr(new Date()))
  const [showAll, setShowAll] = useState(false)

  const mine = entries
    .filter(e => e.lift === lift)
    .sort((a, b) => b.date.localeCompare(a.date))
  const latest = mine[0] ?? null
  const history = mine.slice(1)
  const visible = showAll ? history : history.slice(0, VISIBLE_LIMIT)

  function startAdd() {
    setWeight('')
    setReps('')
    setDate(toLocalDateStr(new Date()))
    setAdding(true)
  }

  function cancelAdd() { setAdding(false) }

  function saveEntry() {
    const w = displayToKg(weight, unit)
    const r = parseInt(reps)
    if (!(w > 0) || !(r >= 1 && r <= 30) || !date) return
    onAdd({ id: generateId(), lift, date, weight: w, reps: r })
    setAdding(false)
  }

  return (
    <div className="b3-card card">
      <div className="b3-header">
        <h3 className="b3-title">{title}</h3>
        {!adding && (
          <button className="b3-add-btn" onClick={startAdd}>+ Add</button>
        )}
      </div>

      {latest ? (
        <div className="b3-latest">
          <span>Latest: {kgToDisplay(latest.weight, unit)} {label} × {latest.reps} · {latest.date}</span>
          <button className="b3-del-btn" aria-label="Delete" onClick={() => onDelete(latest.id)}>🗑</button>
        </div>
      ) : (
        <div className="b3-empty">No entries yet — tap + Add to start tracking.</div>
      )}

      {adding && (
        <div className="b3-add-form">
          <input className="b3-input" type="number" inputMode="decimal" placeholder={`Weight ${label}`}
            value={weight} onChange={e => setWeight(e.target.value)} />
          <input className="b3-input" type="number" inputMode="numeric" placeholder="Reps"
            min="1" max="30"
            value={reps} onChange={e => setReps(e.target.value)} />
          <input className="b3-input" type="date"
            value={date} onChange={e => setDate(e.target.value)} />
          <div className="b3-form-actions">
            <button className="b3-cancel-btn" onClick={cancelAdd}>{t('b3.cancel')}</button>
            <button className="b3-save-btn" onClick={saveEntry}>Save</button>
          </div>
        </div>
      )}

      {visible.length > 0 && (
        <div className="b3-list">
          {visible.map(e => (
            <div key={e.id} className="b3-row">
              <span className="b3-row-text">{kgToDisplay(e.weight, unit)} {label} × {e.reps} · {e.date.slice(5)}</span>
              <button className="b3-del-btn" aria-label="Delete" onClick={() => onDelete(e.id)}>🗑</button>
            </div>
          ))}
        </div>
      )}

      {history.length > VISIBLE_LIMIT && !showAll && (
        <button className="b3-more-btn" onClick={() => setShowAll(true)}>
          Show all {mine.length} entries
        </button>
      )}
    </div>
  )
}
