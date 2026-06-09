import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { supabase } from '../lib/supabase'
import { useTargets } from '../hooks/useTargets'
import { calcMacros } from '../utils/macroCalculator'
import { applyTheme, readTheme, saveTheme, ACCENT_PRESETS, BG_PRESETS } from '../hooks/useTheme'
import { useLanguage } from '../context/LanguageContext'
import ProfileCard from '../components/ProfileCard'
import ChangePasswordForm from '../components/ChangePasswordForm'
import AboutCard from '../components/AboutCard'
import SubscriptionCard from '../components/SubscriptionCard'
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
  const [targets, setTargets] = useTargets()
  const [targetDraft, setTargetDraft] = useState(() => ({ ...targets }))
  const [profile, setProfile] = useStorage('profile', DEFAULT_PROFILE)
  const [calcResult, setCalcResult] = useState(null)
  const [bodyWeightLogs] = useStorage('body_weight_logs', [])
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [cpFlash, setCpFlash] = useState(false)

  const TILES = [
    { key: 'appearance',    icon: '🎨', label: t('st.appearance'),    sub: t('st.appearance_sub') },
    { key: 'profile',       icon: '👤', label: t('st.profile'),       sub: t('st.profile_sub') },
    { key: 'training',      icon: '🏋️', label: t('st.training'),      sub: t('st.training_sub') },
    { key: 'nutrition',     icon: '🥗', label: t('st.nutrition'),     sub: t('st.nutrition_sub') },
  ]

  const sectionRefs = {
    appearance: useRef(null),
    profile:    useRef(null),
    training:   useRef(null),
    nutrition:  useRef(null),
  }

  const latestWeight = bodyWeightLogs.length
    ? [...bodyWeightLogs].sort((a, b) => b.date.localeCompare(a.date))[0].weight
    : null

  function scrollTo(key) {
    sectionRefs[key].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function updateTheme(patch) {
    const next = { ...theme, ...patch }
    setThemeState(next)
    saveTheme(next)
    applyTheme(next)
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

      {/* Profile */}
      <div ref={sectionRefs.profile}>
        <div className="settings-section-header">
          <span className="settings-section-icon">👤</span>
          <span className="settings-section-label">{t('st.profile')}</span>
        </div>
        <ProfileCard />
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
        <div className="settings-card card">
          <div className="settings-card-title">{t('st.macro_calc')}</div>
          <p className="settings-card-desc">Calculates from your Profile above.</p>
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

      {/* Account */}
      <div className="settings-section danger-zone">
        <h3>Account</h3>
        <SubscriptionCard />
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
          className="settings-btn"
          onClick={() => setShowChangePassword(s => !s)}
        >
          {t('st.change_password')}
        </button>
        {showChangePassword && (
          <ChangePasswordForm onClose={({ ok }) => {
            setShowChangePassword(false)
            if (ok) {
              setCpFlash(true)
              setTimeout(() => setCpFlash(false), 2500)
            }
          }} />
        )}
        {cpFlash && <div className="cp-success">{t('st.cp_success')}</div>}
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

      <AboutCard />
    </div>
  )
}
