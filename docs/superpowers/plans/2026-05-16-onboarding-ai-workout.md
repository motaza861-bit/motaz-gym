# Onboarding + AI Workout Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-launch wizard that collects user profile, calculates macros, and uses Claude to generate a personalised workout program stored in localStorage.

**Architecture:** Vercel serverless function (`api/generate-workout.js`) calls Claude Sonnet with the user's profile and returns a structured JSON workout program. A multi-step `Onboarding.jsx` wizard collects inputs, calls the API, saves results to localStorage, and gates `App.jsx` so it only shows once.

**Tech Stack:** React 19, Vite, @anthropic-ai/sdk, Vercel serverless functions, localStorage via useStorage hook.

---

### Task 1: Install @anthropic-ai/sdk and fix vercel.json

**Files:**
- Modify: `package.json`
- Modify: `vercel.json`

- [ ] **Step 1: Install SDK**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
npm install @anthropic-ai/sdk
```

Expected: `@anthropic-ai/sdk` appears in `package.json` dependencies.

- [ ] **Step 2: Update vercel.json to exclude /api/ from SPA rewrite**

Current `vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Replace with:
```json
{
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

This ensures `/api/*` routes reach the serverless functions instead of being caught by the SPA fallback.

- [ ] **Step 3: Verify Vite dev server still starts**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — no build errors.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add package.json package-lock.json vercel.json
git commit -m "feat: add @anthropic-ai/sdk and fix Vercel SPA rewrite"
```

---

### Task 2: Add DEFAULT_PROGRAM export + useExercises hook + DATA_KEYS

**Files:**
- Modify: `src/data/workoutProgram.js`
- Create: `src/hooks/useExercises.js`
- Modify: `src/hooks/useStorage.js`
- Test: `tests/hooks/useExercises.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/hooks/useExercises.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExercises } from '../../src/hooks/useExercises'
import { DEFAULT_PROGRAM } from '../../src/data/workoutProgram'

beforeEach(() => localStorage.clear())

describe('useExercises', () => {
  it('returns DEFAULT_PROGRAM when nothing in storage', () => {
    const { result } = renderHook(() => useExercises())
    expect(result.current[0]).toEqual(DEFAULT_PROGRAM)
  })

  it('persists a custom program to localStorage', () => {
    const { result } = renderHook(() => useExercises())
    const custom = { sessions: { A: { name: 'Test', focus: 'Test', muscles: 'All', exercises: [] } }, daySession: { 0: 'rest', 1: 'A', 2: 'rest', 3: 'rest', 4: 'rest', 5: 'rest', 6: 'rest' } }
    act(() => result.current[1](custom))
    expect(JSON.parse(localStorage.getItem('motaz_exercises'))).toEqual(custom)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run tests/hooks/useExercises.test.js 2>&1 | tail -10
```

Expected: FAIL — `useExercises` not found.

- [ ] **Step 3: Add DEFAULT_PROGRAM to workoutProgram.js**

Open `src/data/workoutProgram.js` and append at the bottom:

```js
export const DEFAULT_PROGRAM = {
  sessions: SESSIONS,
  daySession: DAY_SESSION,
}
```

- [ ] **Step 4: Create useExercises.js**

Create `src/hooks/useExercises.js`:
```js
import { useStorage } from './useStorage'
import { DEFAULT_PROGRAM } from '../data/workoutProgram'

export function useExercises() {
  return useStorage('motaz_exercises', DEFAULT_PROGRAM)
}
```

- [ ] **Step 5: Add motaz_exercises to DATA_KEYS in useStorage.js**

Find line in `src/hooks/useStorage.js`:
```js
const DATA_KEYS = ['motaz_workout_logs', 'motaz_nutrition_logs', 'motaz_body_weight_logs', 'motaz_meals', 'motaz_targets', 'motaz_profile']
```

Replace with:
```js
const DATA_KEYS = ['motaz_workout_logs', 'motaz_nutrition_logs', 'motaz_body_weight_logs', 'motaz_meals', 'motaz_targets', 'motaz_profile', 'motaz_exercises']
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run tests/hooks/useExercises.test.js 2>&1 | tail -10
```

Expected: 2 tests PASS.

- [ ] **Step 7: Run full test suite**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run 2>&1 | tail -8
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add src/data/workoutProgram.js src/hooks/useExercises.js src/hooks/useStorage.js tests/hooks/useExercises.test.js
git commit -m "feat: add DEFAULT_PROGRAM export, useExercises hook, expand DATA_KEYS"
```

---

### Task 3: Create api/generate-workout.js serverless function

**Files:**
- Create: `api/generate-workout.js`
- Test: `tests/api/generate-workout.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/api/generate-workout.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @anthropic-ai/sdk
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
          text: JSON.stringify({
            sessions: {
              A: { name: 'Full Body A', focus: 'Push', muscles: 'Chest', exercises: [{ name: 'Bench Press', sets: 3, reps: '8-10', rest: 90, muscles: 'Chest' }] }
            },
            daySession: { '0': 'rest', '1': 'A', '2': 'rest', '3': 'A', '4': 'rest', '5': 'A', '6': 'rest' }
          })
        }]
      })
    }
  }))
}))

const mockRes = () => {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('generate-workout handler', () => {
  let handler

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../../api/generate-workout.js')
    handler = mod.default
  })

  it('returns 405 for non-POST requests', async () => {
    const res = mockRes()
    await handler({ method: 'GET', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 400 if required fields missing', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns sessions and daySession on success', async () => {
    const res = mockRes()
    await handler({
      method: 'POST',
      body: { goal: 'bulk', experience: 'intermediate', daysPerWeek: 3, equipment: 'full', weight: 80, age: 25 }
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload).toHaveProperty('sessions')
    expect(payload).toHaveProperty('daySession')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run tests/api/generate-workout.test.js 2>&1 | tail -10
```

Expected: FAIL — file not found.

- [ ] **Step 3: Create api/generate-workout.js**

Create `api/generate-workout.js` at the project root (not inside `src/`):

```js
import Anthropic from '@anthropic-ai/sdk'

const EQUIPMENT_GUIDE = {
  full: 'barbells, cables, machines, dumbbells — full commercial gym',
  home: 'dumbbells, pull-up bar, resistance bands — home gym',
  bodyweight: 'bodyweight only — no equipment',
}

const GOAL_GUIDE = {
  cut: 'higher reps (12-15), shorter rest (45-60s), supersets, fat-loss focus',
  bulk: 'heavy compounds (5-8 reps), longer rest (90-180s), strength focus',
  recomp: 'balanced reps (8-12), standard rest (60-90s), hypertrophy focus',
}

const EXP_GUIDE = {
  beginner: 'simple compound movements, 3 sets, moderate volume, no advanced techniques',
  intermediate: 'progressive overload, 3-4 sets, compound and isolation mix',
  advanced: '4-5 sets, higher intensity, include advanced techniques where appropriate',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { goal, experience, daysPerWeek, equipment, weight, age } = req.body

  if (!goal || !experience || !daysPerWeek || !equipment) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are an expert strength and conditioning coach. Create a personalised workout program.

User profile:
- Goal: ${goal} — ${GOAL_GUIDE[goal] ?? ''}
- Experience: ${experience} — ${EXP_GUIDE[experience] ?? ''}
- Training days per week: ${daysPerWeek}
- Equipment: ${equipment} — ${EQUIPMENT_GUIDE[equipment] ?? ''}
- Age: ${age ?? 'unknown'}, Weight: ${weight ?? 'unknown'}kg

Create exactly ${daysPerWeek} distinct sessions labeled A, B, C, etc. Distribute them across Mon–Sun (key 1=Mon … 6=Sat, 0=Sun); remaining days are "rest".

Return ONLY this JSON (no markdown fences, no explanation):
{
  "sessions": {
    "A": {
      "name": "string",
      "focus": "string",
      "muscles": "string",
      "exercises": [
        { "name": "string", "sets": 3, "reps": "8-10", "rest": 90, "muscles": "string" }
      ]
    }
  },
  "daySession": { "0": "rest", "1": "A", "2": "B", "3": "rest", "4": "A", "5": "B", "6": "rest" }
}

Rules: 5-8 exercises per session. Cover all major muscle groups. rest is in seconds (60-180).`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].text.trim()
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const data = JSON.parse(jsonStr)

    if (!data.sessions || !data.daySession) {
      throw new Error('Invalid response structure')
    }

    return res.status(200).json(data)
  } catch (err) {
    console.error('generate-workout error:', err.message)
    return res.status(500).json({ error: 'Failed to generate workout program' })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run tests/api/generate-workout.test.js 2>&1 | tail -10
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run 2>&1 | tail -8
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add api/generate-workout.js tests/api/generate-workout.test.js
git commit -m "feat: add generate-workout serverless function"
```

---

### Task 4: Create Onboarding wizard UI

**Files:**
- Create: `src/pages/Onboarding.jsx`
- Create: `src/pages/Onboarding.css`

- [ ] **Step 1: Create Onboarding.jsx**

Create `src/pages/Onboarding.jsx`:

```jsx
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
```

- [ ] **Step 2: Create Onboarding.css**

Create `src/pages/Onboarding.css`:

```css
.onboarding {
  min-height: 100dvh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  padding: env(safe-area-inset-top, 0) 0 env(safe-area-inset-bottom, 0);
}

.ob-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 0;
}

.ob-back {
  background: none;
  border: none;
  color: var(--text);
  font-size: 24px;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
}

.ob-dots {
  display: flex;
  gap: 6px;
}

.ob-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-light);
  transition: background 0.2s;
}

.ob-dot.active {
  background: var(--red);
}

.ob-step {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 40px 24px 32px;
  gap: 20px;
}

.ob-center {
  align-items: center;
  justify-content: center;
  text-align: center;
}

.ob-welcome-icon,
.ob-done-icon {
  font-size: 56px;
  margin-bottom: 8px;
}

.ob-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
  margin: 0;
}

.ob-subtitle {
  font-size: 15px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}

.ob-btn-primary {
  margin-top: auto;
  width: 100%;
  padding: 16px;
  background: var(--red);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.ob-btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ob-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ob-card {
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: var(--radius);
  padding: 16px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s;
}

.ob-card.selected {
  border-color: var(--red);
}

.ob-card-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 4px;
}

.ob-card-desc {
  font-size: 13px;
  color: var(--text-muted);
}

.ob-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ob-list-item {
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: var(--radius);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s;
}

.ob-list-item.selected {
  border-color: var(--red);
}

.ob-list-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.ob-list-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.ob-toggle {
  display: flex;
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 4px;
  gap: 4px;
}

.ob-toggle-btn {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  border-radius: calc(var(--radius) - 4px);
  color: var(--text-muted);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.ob-toggle-btn.active {
  background: var(--red);
  color: #fff;
  font-weight: 600;
}

.ob-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ob-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ob-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ob-input {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 16px;
  padding: 12px 14px;
  width: 100%;
  box-sizing: border-box;
}

.ob-input:focus {
  outline: none;
  border-color: var(--red);
}

.ob-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ob-section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ob-chips {
  display: flex;
  gap: 8px;
}

.ob-chip {
  flex: 1;
  padding: 12px 0;
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.ob-chip.active {
  background: var(--red);
  border-color: var(--red);
  color: #fff;
}

.ob-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--border-light);
  border-top-color: var(--red);
  border-radius: 50%;
  animation: ob-spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes ob-spin {
  to { transform: rotate(360deg); }
}

.ob-summary {
  display: flex;
  gap: 16px;
  margin: 8px 0 16px;
}

.ob-summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 16px 20px;
  flex: 1;
}

.ob-summary-val {
  font-size: 22px;
  font-weight: 700;
  color: var(--red);
}

.ob-summary-key {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

.ob-error {
  background: rgba(255,60,60,0.1);
  border: 1px solid var(--red);
  border-radius: var(--radius);
  color: var(--red);
  font-size: 13px;
  padding: 10px 14px;
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add src/pages/Onboarding.jsx src/pages/Onboarding.css
git commit -m "feat: Onboarding wizard UI"
```

---

### Task 5: Gate App.jsx with onboarding check

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Update App.jsx**

Replace the contents of `src/App.jsx` with:

```jsx
import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import WorkoutLogger from './pages/WorkoutLogger'
import Nutrition from './pages/Nutrition'
import Progress from './pages/Progress'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'
import Onboarding from './pages/Onboarding'

export default function App() {
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem('motaz_onboarded'))

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workout" element={<WorkoutLogger />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Build to verify no errors**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm run build 2>&1 | tail -8
```

Expected: `✓ built in` — no TypeScript/import errors.

- [ ] **Step 3: Run tests**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run 2>&1 | tail -8
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add src/App.jsx
git commit -m "feat: gate app with onboarding check"
```

---

### Task 6: Update WorkoutLogger to use useExercises

**Files:**
- Modify: `src/pages/WorkoutLogger.jsx`

- [ ] **Step 1: Read the current WorkoutLogger imports and SESSIONS/DAY_SESSION references**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && grep -n "SESSIONS\|DAY_SESSION\|workoutProgram" src/pages/WorkoutLogger.jsx
```

Note the line numbers for each reference.

- [ ] **Step 2: Replace SESSIONS/DAY_SESSION with useExercises**

At the top of `src/pages/WorkoutLogger.jsx`, replace:
```js
import { SESSIONS, DAY_SESSION } from '../data/workoutProgram'
```
with:
```js
import { useExercises } from '../hooks/useExercises'
```

Inside the `WorkoutLogger` component function, add at the top of the function body (before any other hooks):
```js
const [program] = useExercises()
const SESSIONS = program.sessions
const DAY_SESSION = program.daySession
```

This preserves all existing code that references `SESSIONS` and `DAY_SESSION` without changing any other logic.

- [ ] **Step 3: Build to verify**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm run build 2>&1 | tail -8
```

Expected: `✓ built in` — no errors.

- [ ] **Step 4: Run tests**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run 2>&1 | tail -8
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add src/pages/WorkoutLogger.jsx
git commit -m "feat: WorkoutLogger reads exercises from useExercises hook"
```

---

### Task 7: Add Regenerate Program button to Settings

**Files:**
- Modify: `src/pages/Settings.jsx`
- Modify: `src/pages/Settings.css`

- [ ] **Step 1: Add regenerate handler and card to Settings.jsx**

Read `src/pages/Settings.jsx` and find the section that starts with the first card (the macro calculator card). Add a new card ABOVE the macro calculator card.

Find the return statement and locate the first `<div className="settings-card">`. Insert this block immediately before it:

```jsx
{/* Regenerate Program card */}
<div className="settings-card">
  <div className="settings-card-title">Workout Program</div>
  <p className="settings-card-desc">Regenerate your AI workout program with updated preferences.</p>
  <button
    className="settings-btn settings-btn-danger"
    onClick={() => {
      if (window.confirm('This will replace your current workout program. Continue?')) {
        localStorage.removeItem('motaz_onboarded')
        window.location.reload()
      }
    }}
  >
    Regenerate Program
  </button>
</div>
```

- [ ] **Step 2: Add missing CSS to Settings.css**

Append to `src/pages/Settings.css`:

```css
.settings-card-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0 0 12px;
  line-height: 1.4;
}

.settings-btn-danger {
  background: transparent;
  border: 1px solid var(--red);
  color: var(--red);
}
```

- [ ] **Step 3: Build and test**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm run build 2>&1 | tail -5 && npm test -- --run 2>&1 | tail -5
```

Expected: Build success, all tests pass.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add src/pages/Settings.jsx src/pages/Settings.css
git commit -m "feat: add Regenerate Program button to Settings"
```
