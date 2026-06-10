import { useState } from 'react'
import './BodyWeightCalendar.css'
import { kgToDisplay, displayToKg, unitLabel } from '../utils/units'
import { useLanguage } from '../context/LanguageContext'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['S','M','T','W','T','F','S']

function parseMonth(str) {
  const [y, m] = str.split('-').map(Number)
  return { year: y, month0: m - 1 }
}

function formatMonth(year, month0) {
  return `${year}-${String(month0 + 1).padStart(2, '0')}`
}

function buildMonthGrid(year, month0) {
  const first = new Date(year, month0, 1)
  const last = new Date(year, month0 + 1, 0)
  const startWeekday = first.getDay()
  const daysInMonth = last.getDate()
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null, day: null })
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ date: dateStr, day: d })
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null })
  return cells
}

export default function BodyWeightCalendar({ logs, initialMonth, onSave, onDelete, unit = 'kg' }) {
  const { t } = useLanguage()
  const start = initialMonth ?? formatMonth(new Date().getFullYear(), new Date().getMonth())
  const [{ year, month0 }, setView] = useState(() => parseMonth(start))
  const [editingDate, setEditingDate] = useState(null)
  const [draft, setDraft] = useState('')
  const label = unitLabel(unit)

  const byDate = new Map(logs.map(l => [l.date, l.weight]))
  const cells = buildMonthGrid(year, month0)

  function go(delta) {
    let m = month0 + delta
    let y = year
    while (m < 0) { m += 12; y-- }
    while (m > 11) { m -= 12; y++ }
    setView({ year: y, month0: m })
    setEditingDate(null)
  }

  function openCell(dateStr) {
    setEditingDate(dateStr)
    const kg = byDate.get(dateStr)
    setDraft(kg != null ? String(kgToDisplay(kg, unit)) : '')
  }

  function save() {
    const kg = displayToKg(draft, unit)
    if (kg == null) return
    onSave(editingDate, kg)
    setEditingDate(null)
  }

  function del() {
    onDelete(editingDate)
    setEditingDate(null)
  }

  return (
    <div className="bw-cal">
      <div className="bw-cal-header">
        <button className="bw-cal-nav" aria-label="Previous month" onClick={() => go(-1)}>‹</button>
        <span className="bw-cal-title">{MONTHS[month0]} {year}</span>
        <button className="bw-cal-nav" aria-label="Next month" onClick={() => go(1)}>›</button>
      </div>
      <div className="bw-cal-day-labels">
        {DAY_LABELS.map((l, i) => <div key={i} className="bw-cal-day-label">{l}</div>)}
      </div>
      <div className="bw-cal-grid">
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} className="bw-cal-cell bw-cal-cell--empty" />
          const w = byDate.get(c.date)
          return (
            <button
              key={c.date}
              className={`bw-cal-cell${w != null ? ' bw-cal-cell--logged' : ''}`}
              onClick={() => openCell(c.date)}
            >
              <span className="bw-cal-cell-day">{c.day}</span>
              {w != null && <span className="bw-cal-cell-w">{kgToDisplay(w, unit)}</span>}
            </button>
          )
        })}
      </div>

      {editingDate && (
        <div className="bw-cal-editor">
          <div className="bw-cal-editor-date">{editingDate}</div>
          <input
            className="bw-cal-editor-input"
            type="number"
            inputMode="decimal"
            placeholder={label}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
          />
          <div className="bw-cal-editor-actions">
            <button className="bw-cal-cancel" onClick={() => setEditingDate(null)}>{t('bw.cancel')}</button>
            {byDate.has(editingDate) && (
              <button className="bw-cal-delete" onClick={del}>{t('bw.delete')}</button>
            )}
            <button className="bw-cal-save" onClick={save}>Save</button>
          </div>
        </div>
      )}
    </div>
  )
}
