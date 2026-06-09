import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { toLocalDateStr } from '../utils/dateHelpers'
import { useLanguage } from '../context/LanguageContext'
import BodyWeightCalendar from '../components/BodyWeightCalendar'
import BigThreeCard from '../components/BigThreeCard'
import './Progress.css'

const ORM_PCTS = [100, 95, 90, 85, 80, 75, 70, 65, 60]
const DISCLOSURE_KEY = 'bw_calendar_open'

const BIG_THREE = [
  { lift: 'squat',    title: 'Squat' },
  { lift: 'bench',    title: 'Bench Press' },
  { lift: 'deadlift', title: 'Deadlift' },
]

export default function Progress() {
  const { t } = useLanguage()
  const [bodyWeightLogs, setBodyWeightLogs] = useStorage('body_weight_logs', [])
  const [bigThreeLogs, setBigThreeLogs] = useStorage('big_three_logs', [])
  const [newWeight, setNewWeight] = useState('')
  const [ormWeight, setOrmWeight] = useState('')
  const [ormReps, setOrmReps] = useState('')
  const [calOpen, setCalOpen] = useState(() => {
    try { return localStorage.getItem(DISCLOSURE_KEY) === '1' } catch { return false }
  })

  function toggleCal() {
    setCalOpen(prev => {
      const next = !prev
      try { localStorage.setItem(DISCLOSURE_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }

  function logBodyWeight() {
    const w = parseFloat(newWeight)
    if (!(w > 30 && w < 300)) return
    const todayStr = toLocalDateStr(new Date())
    setBodyWeightLogs(prev => [...prev.filter(l => l.date !== todayStr), { date: todayStr, weight: w }])
    setNewWeight('')
  }

  function saveBodyWeight(date, weight) {
    setBodyWeightLogs(prev => [...prev.filter(l => l.date !== date), { date, weight }])
  }

  function deleteBodyWeight(date) {
    setBodyWeightLogs(prev => prev.filter(l => l.date !== date))
  }

  function addBigThree(entry) {
    setBigThreeLogs(prev => [entry, ...prev])
  }

  function deleteBigThree(id) {
    setBigThreeLogs(prev => prev.filter(e => e.id !== id))
  }

  const wNum = parseFloat(ormWeight)
  const rNum = parseInt(ormReps)
  const oneRM = wNum > 0 && rNum >= 1 && rNum <= 30 ? Math.round(wNum * (1 + rNum / 30)) : null

  return (
    <div className="page progress-page">
      <h1 className="progress-title">{t('pr.title')}</h1>

      {/* Body weight */}
      <div className="card">
        <div className="bw-log-row">
          <input className="bw-input" type="number" inputMode="decimal"
            placeholder="kg" value={newWeight}
            onChange={e => setNewWeight(e.target.value)} />
          <button className="bw-btn" onClick={logBodyWeight}>Log</button>
        </div>

        <button className="bw-disclosure" onClick={toggleCal} aria-expanded={calOpen}>
          <span className="bw-disclosure-arrow">{calOpen ? '▾' : '▸'}</span>
          <span>Present Body Weight</span>
        </button>

        {calOpen && (
          <BodyWeightCalendar
            logs={bodyWeightLogs}
            onSave={saveBodyWeight}
            onDelete={deleteBodyWeight}
          />
        )}
      </div>

      {/* Big three */}
      {BIG_THREE.map(({ lift, title }) => (
        <BigThreeCard
          key={lift}
          lift={lift}
          title={title}
          entries={bigThreeLogs}
          onAdd={addBigThree}
          onDelete={deleteBigThree}
        />
      ))}

      {/* 1RM estimator */}
      <p className="section-title">{t('pr.one_rm')}</p>
      <div className="card">
        <div className="orm-inputs">
          <div className="orm-field">
            <label className="orm-label">{t('pr.one_rm_weight')}</label>
            <input className="bw-input" type="number" inputMode="decimal" placeholder="kg"
              value={ormWeight} onChange={e => setOrmWeight(e.target.value)} />
          </div>
          <div className="orm-field orm-field--reps">
            <label className="orm-label">{t('pr.one_rm_reps')}</label>
            <input className="bw-input" type="number" inputMode="numeric" placeholder="reps"
              min="1" max="30"
              value={ormReps} onChange={e => setOrmReps(e.target.value)} />
          </div>
        </div>
        {oneRM ? (
          <div className="orm-result">
            <div className="orm-result-header">
              <span className="orm-result-label">{t('pr.one_rm_result')}</span>
              <span className="orm-result-val">{oneRM} kg</span>
            </div>
            <div className="orm-pct-table">
              {ORM_PCTS.map(pct => (
                <div key={pct} className="orm-pct-row">
                  <span className="orm-pct">{pct}%</span>
                  <span className="orm-pct-val">{Math.round(oneRM * pct / 100)} kg</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="progress-empty">{t('pr.one_rm_hint')}</p>
        )}
      </div>
    </div>
  )
}
