import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useTargets } from '../hooks/useTargets'
import { calcMacros } from '../utils/macroCalculator'
import { DEFAULT_PROGRAM } from '../data/workoutProgram'
import './Onboarding.css'

const GOALS = [
  { value: 'recomp', label: 'Recomp', desc: 'Build muscle & maintain weight' },
  { value: 'cut', label: 'Cut', desc: 'Lose fat while preserving muscle' },
  { value: 'bulk', label: 'Bulk', desc: 'Gain muscle & strength' },
]

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, no exercise' },
  { value: 'light', label: 'Light', desc: '1–3 days/week' },
  { value: 'moderate', label: 'Moderate', desc: '3–5 days/week' },
  { value: 'very', label: 'Very Active', desc: '6–7 days/week' },
  { value: 'extreme', label: 'Extreme', desc: 'Physical job + daily training' },
]

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: '< 1 year training' },
  { value: 'intermediate', label: 'Intermediate', desc: '1–3 years training' },
  { value: 'advanced', label: 'Advanced', desc: '3+ years training' },
]

const EQUIPMENT_OPTIONS = [
  { value: 'full', label: 'Full Gym', desc: 'Barbells, cables, machines' },
  { value: 'home', label: 'Home Gym', desc: 'Dumbbells, pull-up bar' },
  { value: 'bodyweight', label: 'Bodyweight', desc: 'No equipment needed' },
]

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    goal: 'recomp',
    gender: 'male',
    age: '',
    weight: '',
    height: '',
    activityLevel: 'moderate',
    daysPerWeek: 4,
    experience: 'intermediate',
    equipment: 'full',
  })
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const [, setExercises] = useStorage('motaz_exercises', DEFAULT_PROGRAM)
  const [, setTargets] = useTargets()
  const [, setProfile] = useStorage('motaz_profile', {})

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  async function generate() {
    setStep(6)
    setError(null)
    try {
      const res = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: form.goal,
          experience: form.experience,
          daysPerWeek: form.daysPerWeek,
          equipment: form.equipment,
          weight: parseFloat(form.weight) || null,
          age: parseInt(form.age) || null,
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const targets = calcMacros({
        weight: parseFloat(form.weight) || 75,
        height: parseFloat(form.height) || 175,
        age: parseInt(form.age) || 25,
        gender: form.gender,
        activityLevel: form.activityLevel,
        goal: form.goal,
      })

      setExercises({ sessions: data.sessions, daySession: data.daySession })
      setTargets(targets)
      setProfile({
        weight: form.weight,
        height: form.height,
        age: form.age,
        gender: form.gender,
        activityLevel: form.activityLevel,
        goal: form.goal,
      })
      localStorage.setItem('motaz_onboarded', '1')

      setResult({ targets, sessionCount: Object.keys(data.sessions).length })
      setStep(7)
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.')
      setStep(5)
    }
  }

  const next = () => step === 5 ? generate() : setStep(s => s + 1)
  const back = () => setStep(s => s - 1)

  return (
    <div className="onboarding">
      {step > 0 && step < 6 && (
        <div className="ob-header">
          <button className="ob-back" onClick={back}>‹</button>
          <div className="ob-dots">
            {[1,2,3,4,5].map(i => (
              <div key={i} className={`ob-dot${step >= i ? ' active' : ''}`} />
            ))}
          </div>
        </div>
      )}

      {step === 0 && (
        <div className="ob-step">
          <div className="ob-welcome-icon">💪</div>
          <h1 className="ob-title">Welcome to<br/>Motaz Gym</h1>
          <p className="ob-subtitle">Answer a few questions and we'll build a workout program and nutrition targets specifically for you.</p>
          <button className="ob-btn-primary" onClick={next}>Get Started</button>
        </div>
      )}

      {step === 1 && (
        <div className="ob-step">
          <h2 className="ob-title">What's your goal?</h2>
          <div className="ob-cards">
            {GOALS.map(g => (
              <button key={g.value} className={`ob-card${form.goal === g.value ? ' selected' : ''}`} onClick={() => set('goal', g.value)}>
                <div className="ob-card-label">{g.label}</div>
                <div className="ob-card-desc">{g.desc}</div>
              </button>
            ))}
          </div>
          <button className="ob-btn-primary" onClick={next}>Continue</button>
        </div>
      )}

      {step === 2 && (
        <div className="ob-step">
          <h2 className="ob-title">About you</h2>
          <div className="ob-toggle">
            {['male','female'].map(g => (
              <button key={g} className={`ob-toggle-btn${form.gender === g ? ' active' : ''}`} onClick={() => set('gender', g)}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
          <div className="ob-fields">
            <div className="ob-field">
              <label className="ob-label">Age</label>
              <input className="ob-input" type="number" inputMode="numeric" placeholder="25" value={form.age} onChange={e => set('age', e.target.value)} />
            </div>
            <div className="ob-field">
              <label className="ob-label">Weight (kg)</label>
              <input className="ob-input" type="number" inputMode="decimal" placeholder="75" value={form.weight} onChange={e => set('weight', e.target.value)} />
            </div>
            <div className="ob-field">
              <label className="ob-label">Height (cm)</label>
              <input className="ob-input" type="number" inputMode="decimal" placeholder="175" value={form.height} onChange={e => set('height', e.target.value)} />
            </div>
          </div>
          <button className="ob-btn-primary" onClick={next} disabled={!form.age || !form.weight || !form.height}>Continue</button>
        </div>
      )}

      {step === 3 && (
        <div className="ob-step">
          <h2 className="ob-title">Activity level</h2>
          <div className="ob-list">
            {ACTIVITY_LEVELS.map(a => (
              <button key={a.value} className={`ob-list-item${form.activityLevel === a.value ? ' selected' : ''}`} onClick={() => set('activityLevel', a.value)}>
                <div className="ob-list-label">{a.label}</div>
                <div className="ob-list-desc">{a.desc}</div>
              </button>
            ))}
          </div>
          <button className="ob-btn-primary" onClick={next}>Continue</button>
        </div>
      )}

      {step === 4 && (
        <div className="ob-step">
          <h2 className="ob-title">Training preferences</h2>
          <div className="ob-section">
            <label className="ob-section-label">Days per week</label>
            <div className="ob-chips">
              {[3,4,5,6].map(d => (
                <button key={d} className={`ob-chip${form.daysPerWeek === d ? ' active' : ''}`} onClick={() => set('daysPerWeek', d)}>{d}</button>
              ))}
            </div>
          </div>
          <div className="ob-section">
            <label className="ob-section-label">Experience level</label>
            <div className="ob-list">
              {EXPERIENCE_LEVELS.map(e => (
                <button key={e.value} className={`ob-list-item${form.experience === e.value ? ' selected' : ''}`} onClick={() => set('experience', e.value)}>
                  <div className="ob-list-label">{e.label}</div>
                  <div className="ob-list-desc">{e.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <button className="ob-btn-primary" onClick={next}>Continue</button>
        </div>
      )}

      {step === 5 && (
        <div className="ob-step">
          <h2 className="ob-title">What equipment do you have?</h2>
          <div className="ob-cards">
            {EQUIPMENT_OPTIONS.map(e => (
              <button key={e.value} className={`ob-card${form.equipment === e.value ? ' selected' : ''}`} onClick={() => set('equipment', e.value)}>
                <div className="ob-card-label">{e.label}</div>
                <div className="ob-card-desc">{e.desc}</div>
              </button>
            ))}
          </div>
          {error && <div className="ob-error">{error}</div>}
          <button className="ob-btn-primary" onClick={next}>Build My Program</button>
        </div>
      )}

      {step === 6 && (
        <div className="ob-step ob-center">
          <div className="ob-spinner" />
          <h2 className="ob-title">Building your program…</h2>
          <p className="ob-subtitle">This takes about 10 seconds.</p>
        </div>
      )}

      {step === 7 && result && (
        <div className="ob-step ob-center">
          <div className="ob-done-icon">✅</div>
          <h2 className="ob-title">Your program is ready</h2>
          <div className="ob-summary">
            <div className="ob-summary-item">
              <span className="ob-summary-val">{result.sessionCount}</span>
              <span className="ob-summary-key">sessions</span>
            </div>
            <div className="ob-summary-item">
              <span className="ob-summary-val">{result.targets.calories.toLocaleString('en').replace(/,/g, ' ')}</span>
              <span className="ob-summary-key">kcal/day</span>
            </div>
            <div className="ob-summary-item">
              <span className="ob-summary-val">{result.targets.protein}g</span>
              <span className="ob-summary-key">protein</span>
            </div>
          </div>
          <button className="ob-btn-primary" onClick={onComplete}>Let's Go →</button>
        </div>
      )}
    </div>
  )
}
