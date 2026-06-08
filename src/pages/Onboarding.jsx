import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useTargets } from '../hooks/useTargets'
import { calcMacros } from '../utils/macroCalculator'
import { useLanguage } from '../context/LanguageContext'
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

const SPLIT_OPTIONS = [
  { value: 'fullbody',   label: 'Full Body',          desc: 'All muscles every session · 3 days/week' },
  { value: 'upperlower', label: 'Upper / Lower',       desc: 'Upper & lower alternating · 4 days/week' },
  { value: 'ppl',        label: 'Push / Pull / Legs',  desc: 'Push, pull, legs repeated · 6 days/week' },
  { value: 'arnold',     label: 'Arnold Split',         desc: 'Chest+Back / Shoulders+Arms / Legs · 6 days/week' },
  { value: 'bro',        label: 'Bro Split',            desc: 'One muscle group per day · 5 days/week' },
  { value: 'custom',     label: 'Custom',               desc: 'Describe your own split' },
]

const EQUIPMENT_OPTIONS = [
  { value: 'full', label: 'Full Gym', desc: 'Barbells, cables, machines' },
  { value: 'home', label: 'Home Gym', desc: 'Dumbbells, pull-up bar' },
  { value: 'bodyweight', label: 'Bodyweight', desc: 'No equipment needed' },
]

export default function Onboarding({ onComplete }) {
  const { t } = useLanguage()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '',
    goal: 'recomp',
    gender: 'male',
    age: '',
    weight: '',
    height: '',
    activityLevel: 'moderate',
    experience: 'intermediate',
    split: 'ppl',
    customSplit: '',
    equipment: 'full',
  })
  const [, setTargets] = useTargets()
  const [, setProfile] = useStorage('profile', {})

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  function finishOnboarding() {
    const targets = calcMacros({
      weight: parseFloat(form.weight) || 75,
      height: parseFloat(form.height) || 175,
      age: parseInt(form.age) || 25,
      gender: form.gender,
      activityLevel: form.activityLevel,
      goal: form.goal,
    })
    setTargets(targets)
    setProfile({
      name: form.name.trim(),
      weight: form.weight,
      height: form.height,
      age: form.age,
      gender: form.gender,
      activityLevel: form.activityLevel,
      goal: form.goal,
    })
    try { localStorage.setItem('motaz_onboarded', '1') } catch {}
    if (onComplete) onComplete()
  }

  const splitContinueOk = form.split !== 'custom' || form.customSplit.trim().length > 0
  const next = () => step === 6 ? finishOnboarding() : setStep(s => s + 1)
  const back = () => setStep(s => s - 1)

  return (
    <div className="onboarding">
      {step > 0 && step < 7 && (
        <div className="ob-header">
          <button className="ob-back" onClick={back}>‹</button>
          <div className="ob-dots">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className={`ob-dot${step >= i ? ' active' : ''}`} />
            ))}
          </div>
        </div>
      )}

      {step === 0 && (
        <div className="ob-step">
          <div className="ob-welcome-icon">💪</div>
          <h1 className="ob-title">{t('ob.welcome_title').replace('\\n', '\n').split('\n').map((line, i) => (
            <span key={i}>{line}{i === 0 ? <br /> : ''}</span>
          ))}</h1>
          <p className="ob-subtitle">{t('ob.welcome_sub')}</p>
          <div className="ob-field">
            <label className="ob-label" htmlFor="ob-name">{t('ob.your_name')}</label>
            <input
              id="ob-name"
              className="ob-input"
              type="text"
              placeholder={t('ob.name_ph')}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <button className="ob-btn-primary" onClick={next} disabled={!form.name.trim()}>{t('ob.get_started')}</button>
        </div>
      )}

      {step === 1 && (
        <div className="ob-step">
          <h2 className="ob-title">{t('ob.goal_title')}</h2>
          <div className="ob-cards">
            {GOALS.map(g => (
              <button key={g.value} className={`ob-card${form.goal === g.value ? ' selected' : ''}`} onClick={() => set('goal', g.value)}>
                <div className="ob-card-label">{g.label}</div>
                <div className="ob-card-desc">{g.desc}</div>
              </button>
            ))}
          </div>
          <button className="ob-btn-primary" onClick={next}>{t('ob.continue')}</button>
        </div>
      )}

      {step === 2 && (
        <div className="ob-step">
          <h2 className="ob-title">{t('ob.stats_title')}</h2>
          <div className="ob-toggle">
            {[['male', t('calc.male')], ['female', t('calc.female')]].map(([g, label]) => (
              <button key={g} className={`ob-toggle-btn${form.gender === g ? ' active' : ''}`} onClick={() => set('gender', g)}>
                {label}
              </button>
            ))}
          </div>
          <div className="ob-fields">
            <div className="ob-field">
              <label className="ob-label">{t('calc.age')}</label>
              <input className="ob-input" type="number" inputMode="numeric" placeholder="25" value={form.age} onChange={e => set('age', e.target.value)} />
            </div>
            <div className="ob-field">
              <label className="ob-label">{t('calc.weight_kg')}</label>
              <input className="ob-input" type="number" inputMode="decimal" placeholder="75" value={form.weight} onChange={e => set('weight', e.target.value)} />
            </div>
            <div className="ob-field">
              <label className="ob-label">{t('calc.height_cm')}</label>
              <input className="ob-input" type="number" inputMode="decimal" placeholder="175" value={form.height} onChange={e => set('height', e.target.value)} />
            </div>
          </div>
          <button className="ob-btn-primary" onClick={next} disabled={!form.age || !form.weight || !form.height}>{t('ob.continue')}</button>
        </div>
      )}

      {step === 3 && (
        <div className="ob-step">
          <h2 className="ob-title">{t('ob.activity_title')}</h2>
          <div className="ob-list">
            {ACTIVITY_LEVELS.map(a => (
              <button key={a.value} className={`ob-list-item${form.activityLevel === a.value ? ' selected' : ''}`} onClick={() => set('activityLevel', a.value)}>
                <div className="ob-list-label">{a.label}</div>
                <div className="ob-list-desc">{a.desc}</div>
              </button>
            ))}
          </div>
          <button className="ob-btn-primary" onClick={next}>{t('ob.continue')}</button>
        </div>
      )}

      {step === 4 && (
        <div className="ob-step">
          <h2 className="ob-title">{t('ob.experience_title')}</h2>
          <div className="ob-list">
            {EXPERIENCE_LEVELS.map(e => (
              <button key={e.value} className={`ob-list-item${form.experience === e.value ? ' selected' : ''}`} onClick={() => set('experience', e.value)}>
                <div className="ob-list-label">{e.label}</div>
                <div className="ob-list-desc">{e.desc}</div>
              </button>
            ))}
          </div>
          <button className="ob-btn-primary" onClick={next}>{t('ob.continue')}</button>
        </div>
      )}

      {step === 5 && (
        <div className="ob-step">
          <h2 className="ob-title">{t('ob.split_title')}</h2>
          <div className="ob-list">
            {SPLIT_OPTIONS.map(s => (
              <button key={s.value} className={`ob-list-item${form.split === s.value ? ' selected' : ''}`} onClick={() => set('split', s.value)}>
                <div className="ob-list-label">{s.label}</div>
                <div className="ob-list-desc">{s.desc}</div>
              </button>
            ))}
          </div>
          {form.split === 'custom' && (
            <div className="ob-field" style={{ marginTop: 12 }}>
              <label className="ob-label">{t('ob.custom_split_label')}</label>
              <textarea
                className="ob-input ob-textarea"
                placeholder={t('ob.custom_split_ph')}
                value={form.customSplit}
                rows={3}
                onChange={e => set('customSplit', e.target.value)}
              />
            </div>
          )}
          <button className="ob-btn-primary" onClick={next} disabled={!splitContinueOk}>{t('ob.continue')}</button>
        </div>
      )}

      {step === 6 && (
        <div className="ob-step">
          <h2 className="ob-title">{t('ob.equipment_title')}</h2>
          <div className="ob-cards">
            {EQUIPMENT_OPTIONS.map(e => (
              <button key={e.value} className={`ob-card${form.equipment === e.value ? ' selected' : ''}`} onClick={() => set('equipment', e.value)}>
                <div className="ob-card-label">{e.label}</div>
                <div className="ob-card-desc">{e.desc}</div>
              </button>
            ))}
          </div>
          <button className="ob-btn-primary" onClick={next}>{t('ob.build')}</button>
        </div>
      )}
    </div>
  )
}
