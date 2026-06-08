import { useEffect, useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { supabase } from '../lib/supabase'
import { kgToDisplay, displayToKg } from '../utils/units'
import { useLanguage } from '../context/LanguageContext'

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light',     label: 'Light' },
  { value: 'moderate',  label: 'Moderate' },
  { value: 'very',      label: 'Very active' },
  { value: 'extreme',   label: 'Extremely active' },
]

const GOAL_OPTIONS = [
  { value: 'recomp', label: 'Recomp' },
  { value: 'cut',    label: 'Cut −400' },
  { value: 'bulk',   label: 'Bulk +250' },
]

const GENDER_OPTIONS = [
  { value: 'male',   label: 'Male' },
  { value: 'female', label: 'Female' },
]

const DEFAULT_PROFILE = {
  name: '', weight: '', height: '', age: '',
  gender: 'male', activityLevel: 'moderate', goal: 'recomp',
  weightUnit: 'kg',
}

export default function ProfileCard() {
  const { t } = useLanguage()
  const [profile, setProfile] = useStorage('profile', DEFAULT_PROFILE)
  const [draft, setDraft] = useState(() => {
    const merged = { ...DEFAULT_PROFILE, ...profile }
    const kg = parseFloat(merged.weight)
    return {
      ...merged,
      weight: isFinite(kg) && kg > 0
        ? String(kgToDisplay(kg, merged.weightUnit))
        : (merged.weight || ''),
    }
  })
  const [email, setEmail] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email ?? '')
    })
  }, [])

  function setField(key, value) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  function changeUnit(nextUnit) {
    const kg = displayToKg(draft.weight, draft.weightUnit)
    const nextDisplay = kg != null ? String(kgToDisplay(kg, nextUnit)) : draft.weight
    setDraft(prev => ({ ...prev, weight: nextDisplay, weightUnit: nextUnit }))
  }

  function save() {
    const kg = displayToKg(draft.weight, draft.weightUnit)
    setProfile({
      name: draft.name.trim(),
      weight: kg != null ? String(kg) : '',
      height: draft.height,
      age: draft.age,
      gender: draft.gender,
      activityLevel: draft.activityLevel,
      goal: draft.goal,
      weightUnit: draft.weightUnit,
    })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  return (
    <div className="card settings-card profile-card">
      <div className="settings-card-title">{t('st.profile')}</div>

      <div className="profile-grid">
        <label className="profile-field profile-field-full">
          <span className="profile-label">{t('st.profile_name')}</span>
          <input className="calc-input" type="text" value={draft.name}
            onChange={e => setField('name', e.target.value)} />
        </label>

        <label className="profile-field profile-field-full">
          <span className="profile-label">{t('st.profile_email')}</span>
          <input className="calc-input" type="email" value={email} readOnly />
        </label>

        <label className="profile-field">
          <span className="profile-label">Weight</span>
          <div className="profile-weight-row">
            <input className="calc-input" type="number" inputMode="decimal"
              value={draft.weight}
              onChange={e => setField('weight', e.target.value)} />
            <select className="calc-input profile-unit"
              value={draft.weightUnit}
              onChange={e => changeUnit(e.target.value)}>
              <option value="kg">{t('st.unit_kg')}</option>
              <option value="lbs">{t('st.unit_lbs')}</option>
            </select>
          </div>
        </label>

        <label className="profile-field">
          <span className="profile-label">Height (cm)</span>
          <input className="calc-input" type="number" inputMode="decimal"
            value={draft.height}
            onChange={e => setField('height', e.target.value)} />
        </label>

        <label className="profile-field">
          <span className="profile-label">Age</span>
          <input className="calc-input" type="number" inputMode="numeric"
            value={draft.age}
            onChange={e => setField('age', e.target.value)} />
        </label>

        <label className="profile-field">
          <span className="profile-label">Gender</span>
          <select className="calc-input" value={draft.gender}
            onChange={e => setField('gender', e.target.value)}>
            {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        <label className="profile-field profile-field-full">
          <span className="profile-label">Activity level</span>
          <select className="calc-input" value={draft.activityLevel}
            onChange={e => setField('activityLevel', e.target.value)}>
            {ACTIVITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        <label className="profile-field profile-field-full">
          <span className="profile-label">Goal</span>
          <select className="calc-input" value={draft.goal}
            onChange={e => setField('goal', e.target.value)}>
            {GOAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <button className="settings-btn" onClick={save}>
        {savedFlash ? `✓ ${t('st.profile_saved')}` : t('st.profile_save')}
      </button>
    </div>
  )
}
