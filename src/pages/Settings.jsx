import { useState, useRef, useEffect } from 'react'
import { exportAllData, importAllData } from '../hooks/useStorage'
import { useStorage } from '../hooks/useStorage'
import { useTargets } from '../hooks/useTargets'
import { calcMacros } from '../utils/macroCalculator'
import './Settings.css'

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary (desk job, no exercise)' },
  { value: 'light',     label: 'Lightly active (1–3 days/week)' },
  { value: 'moderate',  label: 'Moderately active (3–5 days/week)' },
  { value: 'very',      label: 'Very active (6–7 days/week)' },
  { value: 'extreme',   label: 'Extremely active (physical job + exercise)' },
]

const GOAL_OPTIONS = [
  { value: 'recomp', label: 'Recomp' },
  { value: 'cut',    label: 'Cut −400' },
  { value: 'bulk',   label: 'Bulk +250' },
]

const DEFAULT_PROFILE = { weight: '', height: '', age: '', gender: 'male', activityLevel: 'moderate', goal: 'recomp' }

export default function Settings() {
  const [importStatus, setImportStatus] = useState(null)
  const timerRef = useRef(null)
  const [targets, setTargets] = useTargets()
  const [targetDraft, setTargetDraft] = useState(() => ({ ...targets }))
  const [profile, setProfile] = useStorage('motaz_profile', DEFAULT_PROFILE)
  const [calcResult, setCalcResult] = useState(null)
  const [bodyWeightLogs] = useStorage('motaz_body_weight_logs', [])

  const latestWeight = bodyWeightLogs.length
    ? [...bodyWeightLogs].sort((a, b) => b.date.localeCompare(a.date))[0].weight
    : null

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importAllData(file)
      setImportStatus('success')
      timerRef.current = setTimeout(() => window.location.reload(), 1200)
    } catch {
      setImportStatus('error')
    }
    e.target.value = ''
  }

  function saveTargets() {
    const parsed = {
      calories: parseInt(targetDraft.calories) || 0,
      protein:  parseInt(targetDraft.protein)  || 0,
      carbs:    parseInt(targetDraft.carbs)    || 0,
      fat:      parseInt(targetDraft.fat)      || 0,
    }
    setTargets(parsed)
  }

  function setProfileField(field, val) {
    setProfile(prev => ({ ...prev, [field]: val }))
  }

  function handleCalc() {
    const w = parseFloat(profile.weight) || latestWeight
    const h = parseFloat(profile.height)
    const a = parseInt(profile.age)
    if (!w || !h || !a) return
    const result = calcMacros({
      weight: w, height: h, age: a,
      gender: profile.gender,
      activityLevel: profile.activityLevel,
      goal: profile.goal,
    })
    setCalcResult(result)
  }

  function applyCalcResult() {
    setTargets(calcResult)
    setTargetDraft({ ...calcResult })
    setCalcResult(null)
  }

  return (
    <div className="page settings-page">
      <h1 className="settings-title">Settings ⚙️</h1>

      <p className="section-title">Macro Calculator</p>
      <div className="card settings-card">
        <div className="calc-grid">
          <label className="calc-label">
            Weight (kg)
            <input className="calc-input" type="number" inputMode="decimal"
              value={profile.weight}
              placeholder={latestWeight ? String(latestWeight) : 'kg'}
              onChange={e => setProfileField('weight', e.target.value)} />
          </label>
          <label className="calc-label">
            Height (cm)
            <input className="calc-input" type="number" inputMode="decimal"
              value={profile.height} placeholder="cm"
              onChange={e => setProfileField('height', e.target.value)} />
          </label>
          <label className="calc-label">
            Age
            <input className="calc-input" type="number" inputMode="numeric"
              value={profile.age} placeholder="years"
              onChange={e => setProfileField('age', e.target.value)} />
          </label>
          <label className="calc-label">
            Gender
            <div className="calc-toggle">
              {['male', 'female'].map(g => (
                <button key={g}
                  className={`calc-toggle-btn ${profile.gender === g ? 'active' : ''}`}
                  onClick={() => setProfileField('gender', g)}>
                  {g === 'male' ? 'Male' : 'Female'}
                </button>
              ))}
            </div>
          </label>
          <label className="calc-label calc-full">
            Activity Level
            <select className="calc-select" value={profile.activityLevel}
              onChange={e => setProfileField('activityLevel', e.target.value)}>
              {ACTIVITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="calc-label calc-full">
            Goal
            <div className="calc-toggle">
              {GOAL_OPTIONS.map(o => (
                <button key={o.value}
                  className={`calc-toggle-btn ${profile.goal === o.value ? 'active' : ''}`}
                  onClick={() => setProfileField('goal', o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </label>
        </div>

        <button className="settings-btn calc-calc-btn" onClick={handleCalc}>Calculate</button>

        {calcResult && (
          <div className="calc-result">
            <div className="calc-result-nums">
              ~{calcResult.calories.toLocaleString('en').replace(/,/g, ' ')} kcal · {calcResult.protein}g P · {calcResult.carbs}g C · {calcResult.fat}g F
            </div>
            <button className="settings-btn" onClick={applyCalcResult}>Apply to targets ›</button>
          </div>
        )}
      </div>

      <p className="section-title">Daily Targets</p>
      <div className="card settings-card">
        <div className="calc-grid">
          {[
            ['calories', 'Calories (kcal)'],
            ['protein',  'Protein (g)'],
            ['carbs',    'Carbs (g)'],
            ['fat',      'Fat (g)'],
          ].map(([key, label]) => (
            <label key={key} className="calc-label">
              {label}
              <input className="calc-input" type="number" inputMode="numeric"
                value={targetDraft[key] ?? ''}
                onChange={e => setTargetDraft(d => ({ ...d, [key]: e.target.value }))} />
            </label>
          ))}
        </div>
        <button className="settings-btn" onClick={saveTargets}>Save Targets</button>
      </div>

      <p className="section-title">Data Backup</p>
      <div className="card settings-card">
        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Export Backup</div>
            <div className="settings-item-sub">Download all data as a .json file</div>
          </div>
          <button className="settings-btn" onClick={exportAllData}>Export</button>
        </div>
        <div className="settings-divider" />
        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Import Backup</div>
            <div className="settings-item-sub">
              {importStatus === 'success' ? '✅ Imported — reloading...' :
               importStatus === 'error'   ? '❌ Invalid or corrupt file' :
               'Restore from a previously exported .json file'}
            </div>
          </div>
          <label className="settings-btn" role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click() }}>
            Import
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      <p className="section-title">About</p>
      <div className="card settings-card">
        <div className="settings-about">
          <div className="settings-about-name">Motaz Gym Tracker</div>
          <div className="settings-about-sub">4-day Full Body A/B · Recomp protocol</div>
          <div className="settings-about-sub">React + Vite · No backend · Local storage only</div>
        </div>
      </div>
    </div>
  )
}
