# Food Scanner Improvements + Settings Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve food macro accuracy (Llama 4 Maverick + portion-aware prompt + editable results) and reorganise the Settings page with an icon-tile navigation grid.

**Architecture:** Two independent changes executed sequentially. The API gets a model swap and prompt rewrite; the frontend gains an editable result state with proportional portion scaling (no second API call). Settings gets a 2×2 tile grid that smooth-scrolls to section refs.

**Tech Stack:** Groq SDK (Llama 4 Maverick), React 18, Vite, Vitest

---

## File Map

| File | Change |
|------|--------|
| `api/analyze-food.js` | New model, new prompt, `portionGrams` in request/response |
| `tests/api/analyze-food.test.js` | Add tests for `portionGrams` in response |
| `src/components/FoodScanner.jsx` | Editable portion + macro fields in result state |
| `src/components/FoodScanner.css` | Input styles for editable fields |
| `src/pages/Settings.jsx` | Tile grid with refs + smooth scroll, section headers |
| `src/pages/Settings.css` | Tile grid styles, section header styles |

---

## Task 1: Improve analyze-food API

**Files:**
- Modify: `api/analyze-food.js`
- Modify: `tests/api/analyze-food.test.js`

- [ ] **Step 1: Add failing tests for new behaviour**

Open `tests/api/analyze-food.test.js`. The mock at the top returns a response without `portionGrams`. Update the mock response and add two tests — one that asserts `portionGrams` is in the success payload, one that asserts the new model name is used in the Groq call.

Replace the entire file with:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: mockCreate } }
  }
}))

const mockRes = () => {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

const SUCCESS_RESPONSE = {
  choices: [{
    message: {
      content: '{"food":"Potato chips","portionGrams":30,"calories":160,"protein":2,"carbs":15,"fat":10}'
    }
  }]
}

describe('analyze-food handler', () => {
  let handler

  beforeEach(async () => {
    vi.resetModules()
    mockCreate.mockResolvedValue(SUCCESS_RESPONSE)
    const mod = await import('../../api/analyze-food.js')
    handler = mod.default
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 400 if no image provided', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns portionGrams in success payload', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: { image: 'base64data', mimeType: 'image/jpeg' } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload).toHaveProperty('food')
    expect(payload).toHaveProperty('portionGrams')
    expect(payload).toHaveProperty('calories')
    expect(payload).toHaveProperty('protein')
    expect(payload).toHaveProperty('carbs')
    expect(payload).toHaveProperty('fat')
    expect(typeof payload.portionGrams).toBe('number')
  })

  it('uses llama-4-maverick model', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: { image: 'base64data', mimeType: 'image/jpeg' } }, res)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'meta-llama/llama-4-maverick-17b-128e-instruct' })
    )
  })
})
```

- [ ] **Step 2: Run tests — verify the two new tests fail**

```bash
cd motaz-gym && npm run test:run -- tests/api/analyze-food.test.js
```

Expected: `returns portionGrams in success payload` → FAIL, `uses llama-4-maverick model` → FAIL. The other two should still pass.

- [ ] **Step 3: Rewrite analyze-food.js**

Replace the entire file:

```js
import Groq from 'groq-sdk'

const MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct'
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BASE64_BYTES = 5 * 1024 * 1024

const PROMPT = `You are a nutrition expert analysing a food photo.
Step 1 — Identify the food item(s) visible.
Step 2 — Estimate the visible portion weight in grams based on plate/container size, density, and context clues.
Step 3 — Using standard nutrition data, compute calories, protein, carbs, and fat for that exact weight.

Return ONLY this JSON (no markdown, no explanation):
{"food":"name","portionGrams":number,"calories":number,"protein":number,"carbs":number,"fat":number}

If you cannot identify any food, return: {"error":"Could not identify food"}`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { image, mimeType = 'image/jpeg' } = req.body

  if (!image) {
    return res.status(400).json({ error: 'No image provided' })
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return res.status(400).json({ error: 'Unsupported image type' })
  }

  if (image.length > MAX_BASE64_BYTES) {
    return res.status(400).json({ error: 'Image too large' })
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}` } },
          { type: 'text', text: PROMPT },
        ],
      }],
    })

    const raw = completion.choices[0].message.content.trim()
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')

    let data
    try {
      data = JSON.parse(jsonStr)
    } catch {
      return res.status(422).json({ error: 'Could not parse food analysis' })
    }

    if (data.error) {
      return res.status(422).json(data)
    }

    const { food, portionGrams, calories, protein, carbs, fat } = data
    if (
      typeof calories !== 'number' || typeof protein !== 'number' ||
      typeof carbs !== 'number' || typeof fat !== 'number' ||
      typeof portionGrams !== 'number'
    ) {
      return res.status(422).json({ error: 'Could not identify food' })
    }

    return res.status(200).json({ food, portionGrams, calories, protein, carbs, fat })
  } catch (err) {
    console.error('analyze-food error:', err)
    return res.status(500).json({ error: 'Failed to analyse image' })
  }
}
```

- [ ] **Step 4: Run tests — verify all 4 pass**

```bash
npm run test:run -- tests/api/analyze-food.test.js
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/analyze-food.js tests/api/analyze-food.test.js
git commit -m "feat: upgrade food scanner to Llama 4 Maverick with portion-aware prompt"
```

---

## Task 2: FoodScanner editable result fields

**Files:**
- Modify: `src/components/FoodScanner.jsx`
- Modify: `src/components/FoodScanner.css`

- [ ] **Step 1: Replace FoodScanner.jsx**

```jsx
import { useEffect, useRef, useState } from 'react'
import './FoodScanner.css'

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const max = 800
      const scale = Math.min(max / img.width, max / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1])
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')) }
    img.src = url
  })
}

export default function FoodScanner({ onAdd, onClose }) {
  const [state, setState] = useState('idle') // idle | loading | result | error
  const [preview, setPreview] = useState(null)
  const [edits, setEdits] = useState({ food: '', portionGrams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef(null)
  const previewUrlRef = useRef(null)
  const originalRef = useRef(null) // stores unscaled API values for proportional scaling

  useEffect(() => {
    return () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current) }
  }, [])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setPreview(url)
    setState('loading')

    try {
      const base64 = await compressImage(file)
      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Could not analyse image')

      const vals = {
        food: data.food,
        portionGrams: data.portionGrams ?? 100,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
      }
      setEdits(vals)
      originalRef.current = { ...vals }
      setState('result')
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong')
      setState('error')
    }
  }

  function handlePortionChange(raw) {
    const grams = parseFloat(raw) || 0
    const orig = originalRef.current
    if (!orig || orig.portionGrams === 0) {
      setEdits(e => ({ ...e, portionGrams: grams }))
      return
    }
    const ratio = grams / orig.portionGrams
    setEdits({
      food: orig.food,
      portionGrams: grams,
      calories: Math.round(orig.calories * ratio),
      protein: Math.round(orig.protein * ratio),
      carbs: Math.round(orig.carbs * ratio),
      fat: Math.round(orig.fat * ratio),
    })
  }

  function handleAdd() {
    onAdd({
      id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: edits.food || 'Scanned meal',
      emoji: '📸',
      time: '',
      description: 'Scanned meal',
      calories: edits.calories,
      protein: edits.protein,
      carbs: edits.carbs,
      fat: edits.fat,
    })
    onClose()
  }

  function retry() {
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null }
    setPreview(null)
    setEdits({ food: '', portionGrams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 })
    originalRef.current = null
    setErrorMsg('')
    setState('idle')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="scanner-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="scanner-modal">
        <div className="scanner-header">
          <span className="scanner-title">Scan Food</span>
          <button className="scanner-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <input ref={inputRef} type="file" accept="image/*" className="scanner-file-input" onChange={handleFile} />

        {state === 'idle' && (
          <button className="scanner-idle" onClick={() => inputRef.current?.click()}>
            <div className="scanner-camera-icon">📷</div>
            <p className="scanner-hint">Tap to take a photo of your food</p>
          </button>
        )}

        {state === 'loading' && (
          <div className="scanner-loading">
            {preview && <img src={preview} className="scanner-preview" alt="food" />}
            <div className="scanner-spinner" />
            <p className="scanner-hint">Analysing…</p>
          </div>
        )}

        {state === 'result' && (
          <div className="scanner-result">
            {preview && <img src={preview} className="scanner-preview" alt="food" />}

            <input
              className="scanner-food-name-input"
              value={edits.food}
              onChange={e => setEdits(ed => ({ ...ed, food: e.target.value }))}
              placeholder="Food name"
            />

            <div className="scanner-portion-row">
              <span className="scanner-portion-label">Portion</span>
              <input
                className="scanner-portion-input"
                type="number"
                inputMode="decimal"
                value={edits.portionGrams || ''}
                onChange={e => handlePortionChange(e.target.value)}
              />
              <span className="scanner-portion-unit">g</span>
            </div>

            <div className="scanner-macros">
              {[
                ['kcal', 'calories'],
                ['protein', 'protein'],
                ['carbs', 'carbs'],
                ['fat', 'fat'],
              ].map(([label, key]) => (
                <div key={key} className="scanner-macro">
                  <input
                    className="scanner-macro-input"
                    type="number"
                    inputMode="decimal"
                    value={edits[key] || ''}
                    onChange={e => setEdits(ed => ({ ...ed, [key]: parseFloat(e.target.value) || 0 }))}
                  />
                  <span className="scanner-macro-key">{label}</span>
                </div>
              ))}
            </div>

            <div className="scanner-actions">
              <button className="scanner-btn-secondary" onClick={retry}>Try Again</button>
              <button className="scanner-btn-primary" onClick={handleAdd}>Add to Log</button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="scanner-error">
            {preview && <img src={preview} className="scanner-preview" alt="food" />}
            <p className="scanner-error-msg">{errorMsg}</p>
            <button className="scanner-btn-primary" onClick={retry}>Try Again</button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add editable input styles to FoodScanner.css**

Append to the end of `src/components/FoodScanner.css`:

```css
.scanner-food-name-input {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 12px;
}

.scanner-portion-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 14px;
}

.scanner-portion-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 700;
  width: 52px;
  text-align: right;
}

.scanner-portion-input {
  width: 72px;
  background: var(--bg-input);
  border: 1px solid var(--accent-glow);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  color: var(--accent);
  font-size: 15px;
  font-weight: 800;
  text-align: center;
}

.scanner-portion-unit {
  font-size: 12px;
  color: var(--text-muted);
  width: 16px;
}

.scanner-macro-input {
  background: var(--bg-input);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 4px 4px;
  color: var(--text);
  font-size: 15px;
  font-weight: 900;
  text-align: center;
  width: 100%;
  margin-bottom: 2px;
}

.scanner-macro-input:focus {
  border-color: var(--accent);
  outline: none;
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/FoodScanner.jsx src/components/FoodScanner.css
git commit -m "feat: editable portion and macro fields in food scanner result"
```

---

## Task 3: Settings page redesign (Icon Tiles)

**Files:**
- Modify: `src/pages/Settings.jsx`
- Modify: `src/pages/Settings.css`

- [ ] **Step 1: Replace Settings.jsx**

```jsx
import { useState, useRef, useEffect } from 'react'
import { exportAllData, importAllData } from '../hooks/useStorage'
import { useStorage } from '../hooks/useStorage'
import { useTargets } from '../hooks/useTargets'
import { calcMacros } from '../utils/macroCalculator'
import { applyTheme, readTheme, saveTheme, ACCENT_PRESETS, BG_PRESETS } from '../hooks/useTheme'
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

const TILES = [
  { key: 'appearance', icon: '🎨', label: 'Appearance', sub: 'Theme & colours' },
  { key: 'training',   icon: '🏋️', label: 'Training',   sub: 'Workout program' },
  { key: 'nutrition',  icon: '🥗', label: 'Nutrition',  sub: 'Macros & targets' },
  { key: 'data',       icon: '💾', label: 'Data',       sub: 'Backup & restore' },
]

export default function Settings() {
  const [theme, setThemeState] = useState(() => readTheme())
  const [importStatus, setImportStatus] = useState(null)
  const timerRef = useRef(null)
  const [targets, setTargets] = useTargets()
  const [targetDraft, setTargetDraft] = useState(() => ({ ...targets }))
  const [profile, setProfile] = useStorage('motaz_profile', DEFAULT_PROFILE)
  const [calcResult, setCalcResult] = useState(null)
  const [bodyWeightLogs] = useStorage('motaz_body_weight_logs', [])

  const sectionRefs = {
    appearance: useRef(null),
    training:   useRef(null),
    nutrition:  useRef(null),
    data:       useRef(null),
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
      <h1 className="settings-title">Settings ⚙️</h1>

      {/* Navigation tiles */}
      <div className="settings-tiles">
        {TILES.map(t => (
          <button key={t.key} className="settings-tile" onClick={() => scrollTo(t.key)}>
            <span className="settings-tile-icon">{t.icon}</span>
            <span className="settings-tile-label">{t.label}</span>
            <span className="settings-tile-sub">{t.sub}</span>
          </button>
        ))}
      </div>

      {/* Appearance */}
      <div ref={sectionRefs.appearance}>
        <div className="settings-section-header">
          <span className="settings-section-icon">🎨</span>
          <span className="settings-section-label">Appearance</span>
        </div>
        <div className="card settings-card">
          <div className="appearance-section">
            <div className="appearance-label">Accent colour</div>
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
            <div className="appearance-label">Card style</div>
            <div className="card-style-toggle">
              {['glass', 'flat'].map(style => (
                <button
                  key={style}
                  className={`card-style-btn${theme.cardStyle === style ? ' active' : ''}`}
                  onClick={() => updateTheme({ cardStyle: style })}
                >
                  {style.charAt(0).toUpperCase() + style.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="appearance-divider" />
          <div className="appearance-section">
            <div className="appearance-label">Background</div>
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
        </div>
      </div>

      {/* Training */}
      <div ref={sectionRefs.training}>
        <div className="settings-section-header">
          <span className="settings-section-icon">🏋️</span>
          <span className="settings-section-label">Training</span>
        </div>
        <div className="settings-card card">
          <div className="settings-card-title">Workout Program</div>
          <p className="settings-card-desc">Regenerate your AI workout program with updated preferences.</p>
          <button
            className="settings-btn settings-btn-outline"
            onClick={() => {
              if (window.confirm('This will replace your current workout program. Continue?')) {
                try { localStorage.removeItem('motaz_onboarded') } catch {}
                window.location.reload()
              }
            }}
          >
            Regenerate Program
          </button>
        </div>
      </div>

      {/* Nutrition */}
      <div ref={sectionRefs.nutrition}>
        <div className="settings-section-header">
          <span className="settings-section-icon">🥗</span>
          <span className="settings-section-label">Nutrition</span>
        </div>
        <div className="card settings-card">
          <div className="settings-card-title">Macro Calculator</div>
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
                ~{calcResult.calories.toLocaleString('en').replace(/,/g, ' ')} kcal · {calcResult.protein}g P · {calcResult.carbs}g C · {calcResult.fat}g F
              </div>
              <button className="settings-btn" onClick={applyCalcResult}>Apply to targets ›</button>
            </div>
          )}
        </div>

        <div className="card settings-card">
          <div className="settings-card-title">Daily Targets</div>
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
      </div>

      {/* Data */}
      <div ref={sectionRefs.data}>
        <div className="settings-section-header">
          <span className="settings-section-icon">💾</span>
          <span className="settings-section-label">Data</span>
        </div>
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
      </div>

      {/* About */}
      <div className="card settings-card">
        <div className="settings-about">
          <div className="settings-about-name">IronMind</div>
          <div className="settings-about-sub">AI-powered workout & nutrition tracker</div>
          <div className="settings-about-sub">React + Vite · No backend · Local storage only</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add tile and section header styles to Settings.css**

Append to the end of `src/pages/Settings.css`:

```css
/* Navigation tiles */
.settings-tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 24px;
}

.settings-tile {
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border-accent);
  border-radius: var(--radius);
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;
}

.settings-tile:active {
  background: rgba(255,255,255,0.06);
}

.settings-tile-icon { font-size: 22px; margin-bottom: 2px; }

.settings-tile-label {
  font-size: 13px;
  font-weight: 800;
  color: var(--text);
}

.settings-tile-sub {
  font-size: 10px;
  color: var(--text-muted);
}

/* Section headers */
.settings-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-top: 4px;
}

.settings-section-icon { font-size: 16px; }

.settings-section-label {
  font-size: 11px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-weight: 700;
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 4: Run full test suite**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.jsx src/pages/Settings.css
git commit -m "feat: settings redesign — icon tile grid with smooth scroll navigation"
```

---

## Task 4: Deploy to production

- [ ] **Step 1: Deploy**

```bash
vercel --prod
```

Expected: READY status, aliased to `https://motaz-gym.vercel.app`.
