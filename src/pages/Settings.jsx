import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { exportAllData, importAllData } from '../hooks/useStorage'
import { useStorage } from '../hooks/useStorage'
import { supabase } from '../lib/supabase'
import { useTargets } from '../hooks/useTargets'
import { calcMacros } from '../utils/macroCalculator'
import { applyTheme, readTheme, saveTheme, ACCENT_PRESETS, BG_PRESETS } from '../hooks/useTheme'
import { useLanguage } from '../context/LanguageContext'
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
  const navigate = useNavigate()
  const { t, lang, setLang } = useLanguage()
  const [theme, setThemeState] = useState(() => readTheme())
  const [importStatus, setImportStatus] = useState(null)
  const timerRef = useRef(null)
  const [targets, setTargets] = useTargets()
  const [targetDraft, setTargetDraft] = useState(() => ({ ...targets }))
  const [profile, setProfile] = useStorage('profile', DEFAULT_PROFILE)
  const [calcResult, setCalcResult] = useState(null)
  const [bodyWeightLogs] = useStorage('body_weight_logs', [])

  const TILES = [
    { key: 'appearance',    icon: '🎨', label: t('st.appearance'), sub: t('st.appearance_sub') },
    { key: 'training',      icon: '🏋️', label: t('st.training'),   sub: t('st.training_sub') },
    { key: 'nutrition',     icon: '🥗', label: t('st.nutrition'),  sub: t('st.nutrition_sub') },
    { key: 'data',          icon: '💾', label: t('st.data'),       sub: t('st.data_sub') },
  ]

  const sectionRefs = {
    appearance:    useRef(null),
    training:      useRef(null),
    nutrition:     useRef(null),
    data:          useRef(null),
  }

  const latestWeight = bodyWeightLogs.length
    ? [...bodyWeightLogs].sort((a, b) => b.date.localeCompare(a.date))[0].weight
    : null

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  function scrollTo(key) {
    sectionRefs[key].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function updateTheme(patch) {
    const next = { ...theme, ...patch }
    setThemeState(next)
    saveTheme(next)
    applyTheme(next)
  }

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
      <h1 className="settings-title">{t('st.title')}</h1>

      {/* Navigation tiles */}
      <div className="settings-tiles">
        {TILES.map(tile => (
          <button key={tile.key} className="settings-tile" onClick={() => scrollTo(tile.key)}>
            <span className="settings-tile-icon">{tile.icon}</span>
            <span className="settings-tile-label">{tile.label}</span>
            <span className="settings-tile-sub">{tile.sub}</span>
          </button>
        ))}
      </div>

      {/* Appearance */}
      <div ref={sectionRefs.appearance}>
        <div className="settings-section-header">
          <span className="settings-section-icon">🎨</span>
          <span className="settings-section-label">{t('st.appearance')}</span>
        </div>
        <div className="card settings-card">
          <div className="appearance-section">
            <div className="appearance-label">{t('st.accent')}</div>
            <div className="accent-presets">
              {ACCENT_PRESETS.map(p => (
                <button
                  key={p.hex}
                  className={`accent-dot${theme.accent === p.hex ? ' active' : ''}`}
                  style={{ '--dot-color': p.hex }}
                  onClick={() => updateTheme({ accent: p.hex })}
                  title={p.label}
                />
              ))}
              <label className="accent-custom" title="Custom colour">
                <input type="color" value={theme.accent} onChange={e => updateTheme({ accent: e.target.value })} />
                <span className="accent-custom-icon">🎨</span>
              </label>
            </div>
          </div>
          <div className="appearance-divider" />
          <div className="appearance-section">
            <div className="appearance-label">{t('st.card_style')}</div>
            <div className="card-style-toggle">
              {[['glass', t('st.glass')], ['flat', t('st.flat')]].map(([style, label]) => (
                <button
                  key={style}
                  className={`card-style-btn${theme.cardStyle === style ? ' active' : ''}`}
                  onClick={() => updateTheme({ cardStyle: style })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="appearance-divider" />
          <div className="appearance-section">
            <div className="appearance-label">{t('st.background')}</div>
            <div className="bg-swatches">
              {Object.entries(BG_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  className={`bg-swatch${theme.bgPreset === key ? ' active' : ''}`}
                  style={{ background: preset.bg }}
                  onClick={() => updateTheme({ bgPreset: key })}
                >
                  <span className="bg-swatch-label">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="appearance-divider" />
          <div className="appearance-section">
            <div className="appearance-label">{t('st.language')}</div>
            <div className="card-style-toggle">
              {[['en', 'English'], ['ar', 'العربية']].map(([code, label]) => (
                <button
                  key={code}
                  className={`card-style-btn${lang === code ? ' active' : ''}`}
                  onClick={() => setLang(code)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Training */}
      <div ref={sectionRefs.training}>
        <div className="settings-section-header">
          <span className="settings-section-icon">🏋️</span>
          <span className="settings-section-label">{t('st.training')}</span>
        </div>
      </div>

      {/* Nutrition */}
      <div ref={sectionRefs.nutrition}>
        <div className="settings-section-header">
          <span className="settings-section-icon">🥗</span>
          <span className="settings-section-label">{t('st.nutrition')}</span>
        </div>
        <div className="card settings-card">
          <div className="settings-card-title">{t('st.macro_calc')}</div>
          <div className="calc-grid">
            <label className="calc-label">
              {t('calc.weight_kg')}
              <input className="calc-input" type="number" inputMode="decimal"
                value={profile.weight}
                placeholder={latestWeight ? String(latestWeight) : 'kg'}
                onChange={e => setProfileField('weight', e.target.value)} />
            </label>
            <label className="calc-label">
              {t('calc.height_cm')}
              <input className="calc-input" type="number" inputMode="decimal"
                value={profile.height} placeholder="cm"
                onChange={e => setProfileField('height', e.target.value)} />
            </label>
            <label className="calc-label">
              {t('calc.age')}
              <input className="calc-input" type="number" inputMode="numeric"
                value={profile.age} placeholder="years"
                onChange={e => setProfileField('age', e.target.value)} />
            </label>
            <label className="calc-label">
              {t('calc.gender')}
              <div className="calc-toggle">
                {[['male', t('calc.male')], ['female', t('calc.female')]].map(([g, label]) => (
                  <button key={g}
                    className={`calc-toggle-btn ${profile.gender === g ? 'active' : ''}`}
                    onClick={() => setProfileField('gender', g)}>
                    {label}
                  </button>
                ))}
              </div>
            </label>
            <label className="calc-label calc-full">
              {t('calc.activity')}
              <select className="calc-select" value={profile.activityLevel}
                onChange={e => setProfileField('activityLevel', e.target.value)}>
                {ACTIVITY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="calc-label calc-full">
              {t('calc.goal')}
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
          <button className="settings-btn calc-calc-btn" onClick={handleCalc}>{t('st.calculate')}</button>
          {calcResult && (
            <div className="calc-result">
              <div className="calc-result-nums">
                ~{calcResult.calories.toLocaleString('en').replace(/,/g, ' ')} kcal · {calcResult.protein}g P · {calcResult.carbs}g C · {calcResult.fat}g F
              </div>
              <button className="settings-btn" onClick={applyCalcResult}>{t('st.apply_targets')}</button>
            </div>
          )}
        </div>

        <div className="card settings-card">
          <div className="settings-card-title">{t('st.daily_targets')}</div>
          <div className="calc-grid">
            {[
              ['calories', t('calc.calories')],
              ['protein',  t('calc.protein')],
              ['carbs',    t('calc.carbs')],
              ['fat',      t('calc.fat')],
            ].map(([key, label]) => (
              <label key={key} className="calc-label">
                {label}
                <input className="calc-input" type="number" inputMode="numeric"
                  value={targetDraft[key] ?? ''}
                  onChange={e => setTargetDraft(d => ({ ...d, [key]: e.target.value }))} />
              </label>
            ))}
          </div>
          <button className="settings-btn" onClick={saveTargets}>{t('st.save_targets')}</button>
        </div>
      </div>

      {/* Data */}
      <div ref={sectionRefs.data}>
        <div className="settings-section-header">
          <span className="settings-section-icon">💾</span>
          <span className="settings-section-label">{t('st.data')}</span>
        </div>
        <div className="card settings-card">
          <div className="settings-item">
            <div className="settings-item-info">
              <div className="settings-item-label">{t('st.export_label')}</div>
              <div className="settings-item-sub">{t('st.export_sub')}</div>
            </div>
            <button className="settings-btn" onClick={exportAllData}>{t('st.export')}</button>
          </div>
          <div className="settings-divider" />
          <div className="settings-item">
            <div className="settings-item-info">
              <div className="settings-item-label">{t('st.import_label')}</div>
              <div className="settings-item-sub">
                {importStatus === 'success' ? t('st.import_success') :
                 importStatus === 'error'   ? t('st.import_error') :
                 t('st.import_sub')}
              </div>
            </div>
            <label className="settings-btn" role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click() }}>
              {t('st.import')}
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card settings-card">
        <div className="settings-about">
          <div className="settings-about-name">IronMind</div>
          <div className="settings-about-sub">AI-powered workout & nutrition tracker</div>
          <div className="settings-about-sub">React + Vite · Supabase · Synced across devices</div>
        </div>
      </div>

      {/* Account */}
      <div className="settings-section danger-zone">
        <h3>Account</h3>
        <button
          className="settings-btn"
          onClick={async () => {
            await supabase.auth.signOut()
            localStorage.clear()
            navigate('/login', { replace: true })
          }}
        >
          Log out
        </button>
        <button
          className="settings-btn danger"
          onClick={async () => {
            const { data } = await supabase.auth.getUser()
            const email = data?.user?.email ?? ''
            const confirm1 = window.prompt(`Type your email (${email}) to permanently delete your account and all data:`)
            if (!confirm1 || confirm1.trim().toLowerCase() !== email.toLowerCase()) {
              alert('Email did not match. Cancelled.')
              return
            }
            const { error } = await supabase.rpc('delete_my_account')
            if (error) { alert('Failed: ' + error.message); return }
            await supabase.auth.signOut()
            localStorage.clear()
            navigate('/signup', { replace: true })
          }}
        >
          Delete my account
        </button>
      </div>
    </div>
  )
}
