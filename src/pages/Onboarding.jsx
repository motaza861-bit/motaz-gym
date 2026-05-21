import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useTargets } from '../hooks/useTargets'
import { calcMacros } from '../utils/macroCalculator'
import { DEFAULT_PROGRAM } from '../data/workoutProgram'
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
  const [error, setError] = useState(null)
  const [generatedData, setGeneratedData] = useState(null)
  const [draftData, setDraftData] = useState(null)
  const [editingSession, setEditingSession] = useState(null)
  const [calcedTargets, setCalcedTargets] = useState(null)
  const [generating, setGenerating] = useState(false)

  const [, setExercises] = useStorage('motaz_exercises', DEFAULT_PROGRAM)
  const [, setTargets] = useTargets()
  const [, setProfile] = useStorage('motaz_profile', {})

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  function cycleDay(dayIdx) {
    const keys = Object.keys(draftData.sessions)
    const options = [...keys, 'rest']
    const current = draftData.daySession?.[dayIdx] ?? 'rest'
    const nextIdx = (options.indexOf(current) + 1) % options.length
    setDraftData(d => ({ ...d, daySession: { ...d.daySession, [dayIdx]: options[nextIdx] } }))
  }

  function updateExercise(sessionKey, i, field, value) {
    setDraftData(d => {
      const exs = d.sessions[sessionKey].exercises.map((ex, idx) => idx === i ? { ...ex, [field]: value } : ex)
      return { ...d, sessions: { ...d.sessions, [sessionKey]: { ...d.sessions[sessionKey], exercises: exs } } }
    })
  }

  function deleteExercise(sessionKey, i) {
    setDraftData(d => {
      const exs = d.sessions[sessionKey].exercises.filter((_, idx) => idx !== i)
      return { ...d, sessions: { ...d.sessions, [sessionKey]: { ...d.sessions[sessionKey], exercises: exs } } }
    })
  }

  function addExercise(sessionKey) {
    setDraftData(d => {
      const exs = [...d.sessions[sessionKey].exercises, { name: '', sets: 3, reps: '8-12', rest: 90, muscles: '' }]
      return { ...d, sessions: { ...d.sessions, [sessionKey]: { ...d.sessions[sessionKey], exercises: exs } } }
    })
  }

  async function generate() {
    if (generating) return
    setGenerating(true)
    setStep(7)
    setError(null)
    try {
      const res = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: form.goal,
          experience: form.experience,
          split: form.split,
          customSplit: form.customSplit,
          equipment: form.equipment,
          weight: parseFloat(form.weight) || null,
          age: parseInt(form.age) || null,
          gender: form.gender,
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

      setGeneratedData(data)
      setDraftData(JSON.parse(JSON.stringify(data)))
      setEditingSession(null)
      setCalcedTargets(targets)
      setStep(8)
      setGenerating(false)
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.')
      setStep(6)
      setGenerating(false)
    }
  }

  function confirm() {
    setExercises({ sessions: draftData.sessions, daySession: draftData.daySession })
    setTargets(calcedTargets)
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
    setStep(9)
  }

  const splitContinueOk = form.split !== 'custom' || form.customSplit.trim().length > 0
  const next = () => step === 6 ? generate() : setStep(s => s + 1)
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
          {error && <div className="ob-error">{error}</div>}
          <button className="ob-btn-primary" onClick={next} disabled={generating}>
            {generating ? t('ob.building') : t('ob.build')}
          </button>
        </div>
      )}

      {step === 7 && (
        <div className="ob-step ob-center">
          <div className="ob-spinner" />
          <h2 className="ob-title">{t('ob.generating_title')}</h2>
          <p className="ob-subtitle">{t('ob.generating_sub')}</p>
        </div>
      )}

      {step === 8 && draftData && (
        <div className="ob-step ob-preview-step">
          <h2 className="ob-title">{t('ob.program_title')}</h2>
          <p className="ob-subtitle">{t('ob.preview_sub', { n: Object.keys(draftData.sessions).length })}</p>

          {draftData.daySession && (
            <div className="ob-day-editor">
              {['S','M','T','W','T','F','S'].map((label, i) => {
                const val = draftData.daySession[i] ?? 'rest'
                return (
                  <button key={i} className={`ob-day-btn${val !== 'rest' ? ' ob-day-active' : ''}`} onClick={() => cycleDay(i)}>
                    <span className="ob-day-label">{label}</span>
                    <span className="ob-day-val">{val === 'rest' ? '—' : val}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="ob-program-preview">
            {Object.entries(draftData.sessions).map(([key, session]) => (
              <div key={key} className="ob-session-card">
                <div className="ob-session-header">
                  <span className="ob-session-key">{key}</span>
                  <div className="ob-session-info">
                    <div className="ob-session-name">{session.name}</div>
                    <div className="ob-session-focus">{session.focus} · {session.muscles}</div>
                  </div>
                  <button
                    className={`ob-edit-toggle${editingSession === key ? ' ob-edit-toggle-active' : ''}`}
                    onClick={() => setEditingSession(editingSession === key ? null : key)}
                  >
                    {editingSession === key ? t('ob.done_editing') : '✏️'}
                  </button>
                </div>

                {editingSession === key ? (
                  <div className="ob-ex-edit-list">
                    {session.exercises.map((ex, i) => (
                      <div key={i} className="ob-ex-edit-row">
                        <input
                          className="ob-ex-name-input"
                          value={ex.name}
                          placeholder={t('ob.ex_name_ph')}
                          onChange={e => updateExercise(key, i, 'name', e.target.value)}
                        />
                        <input
                          className="ob-ex-sets-input"
                          type="number"
                          inputMode="numeric"
                          value={ex.sets}
                          onChange={e => updateExercise(key, i, 'sets', parseInt(e.target.value) || 1)}
                        />
                        <input
                          className="ob-ex-reps-input"
                          value={ex.reps}
                          onChange={e => updateExercise(key, i, 'reps', e.target.value)}
                        />
                        <button className="ob-ex-del-btn" onClick={() => deleteExercise(key, i)}>✕</button>
                      </div>
                    ))}
                    <button className="ob-add-ex-btn" onClick={() => addExercise(key)}>{t('ob.add_exercise')}</button>
                  </div>
                ) : (
                  <div className="ob-exercise-list">
                    {session.exercises.map((ex, i) => (
                      <div key={i} className="ob-exercise">
                        <span className="ob-exercise-name">{ex.name}</span>
                        <span className="ob-exercise-meta">{ex.sets}×{ex.reps}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="ob-preview-actions">
            <button className="ob-btn-outline" onClick={() => { setGenerating(false); setStep(6) }}>{t('ob.try_again')}</button>
            <button className="ob-btn-confirm" onClick={confirm}>{t('ob.save_program')}</button>
          </div>
        </div>
      )}

      {step === 9 && calcedTargets && (
        <div className="ob-step ob-center">
          <div className="ob-done-icon">✅</div>
          <h2 className="ob-title">
            {t('ob.done_title', { name: form.name.trim() }).split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 ? <br /> : ''}</span>
            ))}
          </h2>
          <div className="ob-summary">
            <div className="ob-summary-item">
              <span className="ob-summary-val">{calcedTargets.calories}</span>
              <span className="ob-summary-key">kcal / day</span>
            </div>
            <div className="ob-summary-item">
              <span className="ob-summary-val">{calcedTargets.protein}g</span>
              <span className="ob-summary-key">protein</span>
            </div>
            <div className="ob-summary-item">
              <span className="ob-summary-val">{calcedTargets.carbs}g</span>
              <span className="ob-summary-key">carbs</span>
            </div>
            <div className="ob-summary-item">
              <span className="ob-summary-val">{calcedTargets.fat}g</span>
              <span className="ob-summary-key">fat</span>
            </div>
          </div>
          <button className="ob-btn-primary" onClick={onComplete}>{t('ob.lets_go')}</button>
        </div>
      )}
    </div>
  )
}
