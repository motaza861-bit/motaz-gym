# Gym App — Day Navigation, Editable Meals & Macro Calculator

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a week-strip day navigator, fully editable meals/targets stored in localStorage, and a profile-based macro calculator in Settings.

**Architecture:** A shared `DateContext` (React context) provides the active date to Dashboard, WorkoutLogger, and Nutrition. Meals and targets move from hardcoded constants to localStorage via `useMeals` and `useTargets` hooks. The Settings page gains a calculator (Miffin-St Jeor + activity multiplier) that writes results to `motaz_targets`.

**Tech Stack:** React 19, React Router 7, Vite 8, localStorage via existing `useStorage` hook, Vitest + @testing-library/react for tests.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/utils/macroCalculator.js` | Create | Pure BMR/TDEE/macro formula functions |
| `src/context/DateContext.jsx` | Create | Shared selected-date state |
| `src/components/DateStrip.jsx` | Create | Week-strip UI with prev/next week arrows |
| `src/components/DateStrip.css` | Create | DateStrip styles |
| `src/hooks/useMeals.js` | Create | localStorage hook for meal list |
| `src/hooks/useTargets.js` | Create | localStorage hook for macro targets |
| `src/main.jsx` | Modify | Wrap app in `DateProvider` |
| `src/data/nutritionPlan.js` | Modify | Remove protein shake; rename export to `DEFAULT_MEALS` |
| `src/pages/Dashboard.jsx` | Modify | Use DateContext + DateStrip |
| `src/pages/WorkoutLogger.jsx` | Modify | Use DateContext + DateStrip |
| `src/components/MealItem.jsx` | Modify | Add edit/delete buttons; export `MealEditForm` |
| `src/components/MealItem.css` | Modify | Styles for edit form |
| `src/pages/Nutrition.jsx` | Modify | Use DateContext + useMeals + useTargets + inline editing |
| `src/pages/Settings.jsx` | Modify | Add macro calculator card + targets card |
| `src/pages/Settings.css` | Modify | Styles for calculator and targets inputs |
| `src/hooks/useStorage.js` | Modify | Add new keys to `DATA_KEYS` |
| `tests/utils/macroCalculator.test.js` | Create | Unit tests for calculator |

---

## Task 1: Macro Calculator Utility

**Files:**
- Create: `src/utils/macroCalculator.js`
- Create: `tests/utils/macroCalculator.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/utils/macroCalculator.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { calcBMR, calcTDEE, calcMacros, ACTIVITY_MULTIPLIERS, GOAL_ADJUSTMENTS } from '../../src/utils/macroCalculator'

describe('calcBMR', () => {
  it('calculates male BMR (Miffin-St Jeor)', () => {
    // 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5 = 1805
    expect(calcBMR({ weight: 80, height: 180, age: 25, gender: 'male' })).toBe(1805)
  })
  it('calculates female BMR', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
    expect(calcBMR({ weight: 60, height: 165, age: 30, gender: 'female' })).toBe(1320.25)
  })
})

describe('calcTDEE', () => {
  it('applies the moderate activity multiplier', () => {
    expect(calcTDEE(1805, 'moderate')).toBe(Math.round(1805 * ACTIVITY_MULTIPLIERS.moderate))
  })
  it('applies the sedentary activity multiplier', () => {
    expect(calcTDEE(1805, 'sedentary')).toBe(Math.round(1805 * ACTIVITY_MULTIPLIERS.sedentary))
  })
})

describe('calcMacros', () => {
  const base = { weight: 80, height: 180, age: 25, gender: 'male', activityLevel: 'moderate' }

  it('sets protein to 2g per kg rounded to nearest 5', () => {
    const { protein } = calcMacros({ ...base, goal: 'recomp' })
    expect(protein).toBe(160) // 80*2 = 160
  })
  it('cut calories are 400 less than recomp', () => {
    const recomp = calcMacros({ ...base, goal: 'recomp' })
    const cut = calcMacros({ ...base, goal: 'cut' })
    expect(recomp.calories - cut.calories).toBe(400)
  })
  it('bulk calories are 250 more than recomp', () => {
    const recomp = calcMacros({ ...base, goal: 'recomp' })
    const bulk = calcMacros({ ...base, goal: 'bulk' })
    expect(bulk.calories - recomp.calories).toBe(250)
  })
  it('carbs and fat are positive', () => {
    const { carbs, fat } = calcMacros({ ...base, goal: 'recomp' })
    expect(carbs).toBeGreaterThan(0)
    expect(fat).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```
cd C:/Users/Ehab/.local/bin/motaz-gym && npx vitest run tests/utils/macroCalculator.test.js
```

Expected: FAIL — `Cannot find module '../../src/utils/macroCalculator'`

- [ ] **Step 3: Create the utility**

Create `src/utils/macroCalculator.js`:

```js
export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extreme: 1.9,
}

export const GOAL_ADJUSTMENTS = {
  recomp: 0,
  cut: -400,
  bulk: 250,
}

export function calcBMR({ weight, height, age, gender }) {
  const base = 10 * weight + 6.25 * height - 5 * age
  return gender === 'male' ? base + 5 : base - 161
}

export function calcTDEE(bmr, activityLevel) {
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55))
}

export function calcMacros({ weight, height, age, gender, activityLevel, goal }) {
  const bmr = calcBMR({ weight, height, age, gender })
  const tdee = calcTDEE(bmr, activityLevel)
  const adjustment = GOAL_ADJUSTMENTS[goal] ?? 0
  const calories = Math.round((tdee + adjustment) / 5) * 5
  const protein = Math.round((weight * 2) / 5) * 5
  const fat = Math.round((calories * 0.25 / 9) / 5) * 5
  const carbs = Math.round(((calories - protein * 4 - fat * 9) / 4) / 5) * 5
  return { calories, protein, carbs, fat }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```
cd C:/Users/Ehab/.local/bin/motaz-gym && npx vitest run tests/utils/macroCalculator.test.js
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```
git -C "C:/Users/Ehab/.local/bin/motaz-gym" add src/utils/macroCalculator.js tests/utils/macroCalculator.test.js
git -C "C:/Users/Ehab/.local/bin/motaz-gym" commit -m "feat: add macro calculator utility (Miffin-St Jeor + activity + goal)"
```

---

## Task 2: DateContext + DateStrip Component

**Files:**
- Create: `src/context/DateContext.jsx`
- Create: `src/components/DateStrip.jsx`
- Create: `src/components/DateStrip.css`

- [ ] **Step 1: Create DateContext**

Create `src/context/DateContext.jsx`:

```jsx
import { createContext, useContext, useState } from 'react'

const DateContext = createContext(null)

export function DateProvider({ children }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  return (
    <DateContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </DateContext.Provider>
  )
}

export function useSelectedDate() {
  return useContext(DateContext)
}
```

- [ ] **Step 2: Create DateStrip component**

Create `src/components/DateStrip.jsx`:

```jsx
import { useSelectedDate } from '../context/DateContext'
import { useStorage } from '../hooks/useStorage'
import { toLocalDateStr } from '../utils/dateHelpers'
import './DateStrip.css'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDays(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayOfWeek = d.getDay()
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return day
  })
}

export default function DateStrip() {
  const { selectedDate, setSelectedDate } = useSelectedDate()
  const [workoutLogs] = useStorage('motaz_workout_logs', [])

  const completedDates = new Set(workoutLogs.filter(l => l.completed).map(l => l.date))
  const todayStr = toLocalDateStr(new Date())
  const selectedStr = toLocalDateStr(selectedDate)
  const days = getWeekDays(selectedDate)

  function shiftWeek(delta) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + delta * 7)
    setSelectedDate(d)
  }

  return (
    <div className="date-strip">
      <button className="date-strip-arrow" onClick={() => shiftWeek(-1)}>‹</button>
      <div className="date-strip-days">
        {days.map((day, i) => {
          const str = toLocalDateStr(day)
          const isSelected = str === selectedStr
          const isToday = str === todayStr
          const hasLog = completedDates.has(str)
          return (
            <button
              key={str}
              className={`date-day${isSelected ? ' selected' : ''}${isToday && !isSelected ? ' today' : ''}`}
              onClick={() => setSelectedDate(new Date(day))}
            >
              <span className="date-day-label">{DAY_LABELS[i]}</span>
              <span className="date-day-num">{day.getDate()}</span>
              {hasLog && <span className="date-day-dot" />}
            </button>
          )
        })}
      </div>
      <button className="date-strip-arrow" onClick={() => shiftWeek(1)}>›</button>
    </div>
  )
}
```

- [ ] **Step 3: Create DateStrip styles**

Create `src/components/DateStrip.css`:

```css
.date-strip {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 16px;
}

.date-strip-arrow {
  font-size: 22px;
  color: var(--text-muted);
  padding: 6px 8px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  transition: color 0.15s;
}
.date-strip-arrow:hover { color: var(--text); }

.date-strip-days {
  display: flex;
  flex: 1;
  gap: 3px;
}

.date-day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 2px;
  border-radius: var(--radius-sm);
  color: var(--text-dim);
  transition: background 0.15s;
}
.date-day:hover { background: var(--bg-input); }
.date-day.today { color: var(--text-muted); }
.date-day.selected { background: var(--red); color: #fff; }
.date-day.selected:hover { background: var(--red-dark); }

.date-day-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
.date-day-num { font-size: 14px; font-weight: 700; }
.date-day-dot {
  width: 4px; height: 4px;
  border-radius: 50%;
  background: var(--red);
}
.date-day.selected .date-day-dot { background: rgba(255, 255, 255, 0.8); }
```

- [ ] **Step 4: Commit**

```
git -C "C:/Users/Ehab/.local/bin/motaz-gym" add src/context/DateContext.jsx src/components/DateStrip.jsx src/components/DateStrip.css
git -C "C:/Users/Ehab/.local/bin/motaz-gym" commit -m "feat: add DateContext and DateStrip week-navigation component"
```

---

## Task 3: useMeals + useTargets Hooks + Update Defaults

**Files:**
- Create: `src/hooks/useMeals.js`
- Create: `src/hooks/useTargets.js`
- Modify: `src/data/nutritionPlan.js`

- [ ] **Step 1: Update nutritionPlan.js — remove protein shake, rename export**

Replace the entire contents of `src/data/nutritionPlan.js`:

```js
export const DEFAULT_TARGETS = {
  calories: 2400,
  protein: 210,
  carbs: 250,
  fat: 70,
}

export const DEFAULT_MEALS = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    emoji: '🍳',
    time: '7:00 AM',
    description: '5 eggs scrambled + 80g oats + banana',
    calories: 620, protein: 45, carbs: 75, fat: 18,
  },
  {
    id: 'lunch',
    name: 'Lunch',
    emoji: '🍗',
    time: '1:00 PM',
    description: '200g chicken breast + 150g rice + vegetables',
    calories: 620, protein: 55, carbs: 70, fat: 8,
  },
  {
    id: 'snack',
    name: 'Afternoon Snack',
    emoji: '🥜',
    time: '4:00 PM',
    description: 'Greek yogurt (200g) + 30g almonds',
    calories: 320, protein: 25, carbs: 20, fat: 18,
  },
  {
    id: 'dinner',
    name: 'Dinner',
    emoji: '🥩',
    time: '7:30 PM',
    description: '200g beef mince + sweet potato + salad',
    calories: 520, protein: 48, carbs: 45, fat: 18,
  },
]

// Legacy named exports kept for any direct imports
export const MEALS = DEFAULT_MEALS
export const TARGETS = DEFAULT_TARGETS
```

- [ ] **Step 2: Create useMeals hook**

Create `src/hooks/useMeals.js`:

```js
import { useStorage } from './useStorage'
import { DEFAULT_MEALS } from '../data/nutritionPlan'

export function useMeals() {
  return useStorage('motaz_meals', DEFAULT_MEALS)
}
```

- [ ] **Step 3: Create useTargets hook**

Create `src/hooks/useTargets.js`:

```js
import { useStorage } from './useStorage'
import { DEFAULT_TARGETS } from '../data/nutritionPlan'

export function useTargets() {
  return useStorage('motaz_targets', DEFAULT_TARGETS)
}
```

- [ ] **Step 4: Run full test suite — expect all pass**

```
cd C:/Users/Ehab/.local/bin/motaz-gym && npx vitest run
```

Expected: all existing tests still pass (MEALS/TARGETS legacy exports preserved).

- [ ] **Step 5: Commit**

```
git -C "C:/Users/Ehab/.local/bin/motaz-gym" add src/data/nutritionPlan.js src/hooks/useMeals.js src/hooks/useTargets.js
git -C "C:/Users/Ehab/.local/bin/motaz-gym" commit -m "feat: useMeals and useTargets hooks; remove protein shake from defaults"
```

---

## Task 4: Wrap App in DateProvider

**Files:**
- Modify: `src/main.jsx`

- [ ] **Step 1: Update main.jsx**

Replace the entire contents of `src/main.jsx`:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DateProvider } from './context/DateContext'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DateProvider>
      <App />
    </DateProvider>
  </StrictMode>
)
```

- [ ] **Step 2: Run full test suite — expect all pass**

```
cd C:/Users/Ehab/.local/bin/motaz-gym && npx vitest run
```

- [ ] **Step 3: Commit**

```
git -C "C:/Users/Ehab/.local/bin/motaz-gym" add src/main.jsx
git -C "C:/Users/Ehab/.local/bin/motaz-gym" commit -m "feat: wrap app in DateProvider"
```

---

## Task 5: Update Dashboard

**Files:**
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: Replace Dashboard.jsx**

Replace the entire contents of `src/pages/Dashboard.jsx`:

```jsx
import { useNavigate } from 'react-router-dom'
import { useStorage } from '../hooks/useStorage'
import { useSelectedDate } from '../context/DateContext'
import { getTodaySession, getStreak, getWeekNumber, toLocalDateStr } from '../utils/dateHelpers'
import { SESSIONS } from '../data/workoutProgram'
import { useMeals } from '../hooks/useMeals'
import { useTargets } from '../hooks/useTargets'
import WorkoutCard from '../components/WorkoutCard'
import MacroBar from '../components/MacroBar'
import PRAlert from '../components/PRAlert'
import DateStrip from '../components/DateStrip'
import './Dashboard.css'

const START_DATE = '2026-05-15'
const TRAINING_DAYS_SET = new Set([1, 2, 4, 5])

export default function Dashboard() {
  const navigate = useNavigate()
  const { selectedDate } = useSelectedDate()
  const [workoutLogs] = useStorage('motaz_workout_logs', [])
  const [nutritionLogs] = useStorage('motaz_nutrition_logs', [])
  const [meals] = useMeals()
  const [targets] = useTargets()

  const now = new Date()
  const selectedStr = toLocalDateStr(selectedDate)
  const session = getTodaySession(selectedDate)
  const streak = getStreak(workoutLogs, now)
  const weekNum = getWeekNumber(START_DATE, selectedDate)

  const todayNutrition = nutritionLogs.find(l => l.date === selectedStr)
  const eatenMealIds = new Set(todayNutrition?.meals?.filter(m => m.eaten).map(m => m.id) ?? [])

  const eaten = meals.filter(m => eatenMealIds.has(m.id)).reduce(
    (acc, m) => ({ protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
    { protein: 0, carbs: 0, fat: 0 }
  )

  const daysUntilNext = (() => {
    for (let i = 1; i <= 7; i++) {
      if (TRAINING_DAYS_SET.has((now.getDay() + i) % 7)) return i
    }
    return 1
  })()
  const nextTrainingLabel = daysUntilNext === 1 ? 'tomorrow' : `in ${daysUntilNext} days`

  const latestPR = workoutLogs
    .flatMap(log => log.prs ?? [])
    .sort((a, b) => b.date?.localeCompare(a.date))
    .at(0) ?? null

  return (
    <div className="page dashboard">
      <div className="dash-header">
        <div>
          <div className="dash-week">Week {weekNum} · {selectedDate.toLocaleDateString('en', { weekday: 'long' })}</div>
          <div className="dash-greeting">Let's go, <span>Motaz 🔥</span></div>
        </div>
        <div className="dash-header-right">
          <button className="dash-settings-btn" onClick={() => navigate('/settings')} title="Settings">⚙️</button>
          <div className="dash-avatar">M</div>
        </div>
      </div>

      <DateStrip />

      <div className="dash-pills">
        <div className="pill hot">🔥 {streak}-day streak</div>
        <div className="pill">💪 {workoutLogs.filter(l => l.completed).length} sessions</div>
      </div>

      {session !== 'rest' && SESSIONS[session] && (
        <WorkoutCard
          session={SESSIONS[session]}
          sessionLabel={session}
          onStart={() => navigate('/workout')}
        />
      )}

      {session === 'rest' && (
        <div className="card rest-card">
          <div className="rest-emoji">😴</div>
          <div className="rest-title">Rest Day</div>
          <div className="rest-sub">Recover well — you train again {nextTrainingLabel}</div>
        </div>
      )}

      <p className="section-title">Today's Nutrition</p>
      <div className="card">
        <MacroBar label="Protein" value={eaten.protein} target={targets.protein} color="var(--red)" unit="g" />
        <MacroBar label="Carbs"   value={eaten.carbs}   target={targets.carbs}   color="var(--orange)" unit="g" />
        <MacroBar label="Fat"     value={eaten.fat}      target={targets.fat}     color="var(--yellow)" unit="g" />
      </div>

      {latestPR && <PRAlert pr={latestPR} />}
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```
cd C:/Users/Ehab/.local/bin/motaz-gym && npx vitest run
```

Expected: all pass.

- [ ] **Step 3: Commit**

```
git -C "C:/Users/Ehab/.local/bin/motaz-gym" add src/pages/Dashboard.jsx
git -C "C:/Users/Ehab/.local/bin/motaz-gym" commit -m "feat: Dashboard uses DateContext and DateStrip"
```

---

## Task 6: Update WorkoutLogger

**Files:**
- Modify: `src/pages/WorkoutLogger.jsx`

- [ ] **Step 1: Replace WorkoutLogger.jsx**

Replace the entire contents of `src/pages/WorkoutLogger.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useSelectedDate } from '../context/DateContext'
import { getTodaySession, toLocalDateStr } from '../utils/dateHelpers'
import { detectPR } from '../utils/prDetector'
import { SESSIONS } from '../data/workoutProgram'
import ExerciseBlock from '../components/ExerciseBlock'
import RestTimer from '../components/RestTimer'
import DateStrip from '../components/DateStrip'
import './WorkoutLogger.css'

function buildInitialSets(exercise) {
  return Array.from({ length: exercise.sets }, () => ({
    weight: 0, reps: 0, completed: false, type: 'S', rpe: null,
  }))
}

function getPreviousSets(exerciseName, workoutLogs, excludeDate) {
  const sorted = [...workoutLogs]
    .filter(l => l.completed && l.date !== excludeDate)
    .sort((a, b) => b.date.localeCompare(a.date))
  for (const log of sorted) {
    const ex = log.exercises?.find(e => e.name === exerciseName)
    if (ex) return ex.sets
  }
  return null
}

export default function WorkoutLogger() {
  const [workoutLogs, setWorkoutLogs] = useStorage('motaz_workout_logs', [])
  const { selectedDate } = useSelectedDate()
  const sessionKey = getTodaySession(selectedDate)
  const session = SESSIONS[sessionKey]

  const [exerciseSets, setExerciseSets] = useState(() =>
    session ? Object.fromEntries(session.exercises.map(ex => [ex.name, buildInitialSets(ex)])) : {}
  )
  const [swappedExercises, setSwappedExercises] = useState({})
  const [swapTarget, setSwapTarget] = useState(null)
  const [swapInput, setSwapInput] = useState('')
  const [activeRest, setActiveRest] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (!session || sessionKey === 'rest') {
    return (
      <div className="page workout-logger">
        <DateStrip />
        <div className="logger-rest">
          <div className="logger-rest-emoji">😴</div>
          <h2>Rest Day</h2>
          <p>No training today — recover and come back tomorrow.</p>
        </div>
      </div>
    )
  }

  const dateStr = toLocalDateStr(selectedDate)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const elapsedDisplay = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`

  function handleSetUpdate(exerciseName, setIndex, field, value) {
    setExerciseSets(prev => {
      const updated = prev[exerciseName].map((s, i) =>
        i === setIndex ? { ...s, [field]: value } : s
      )
      if (field === 'completed' && value === true) {
        const ex = session.exercises.find(e => e.name === exerciseName)
        setActiveRest({ exerciseName, seconds: ex.rest })
      }
      return { ...prev, [exerciseName]: updated }
    })
  }

  function confirmSwap(originalName) {
    const trimmed = swapInput.trim()
    if (trimmed && trimmed !== originalName) {
      setSwappedExercises(prev => ({ ...prev, [originalName]: trimmed }))
    }
    setSwapTarget(null)
    setSwapInput('')
  }

  function handleFinish() {
    if (!window.confirm('Finish workout and save? This will overwrite any previous log for this date.')) return

    const exercises = session.exercises.map(ex => ({
      name: swappedExercises[ex.name] ?? ex.name,
      sets: exerciseSets[ex.name],
    }))

    const prs = exercises
      .map(ex => detectPR(ex.name, ex.sets, workoutLogs))
      .filter(Boolean)
      .map(pr => ({ ...pr, date: dateStr }))

    const log = {
      date: dateStr,
      session: sessionKey,
      startedAt: startedAt.current,
      completedAt: Date.now(),
      completed: true,
      exercises,
      prs,
    }

    setWorkoutLogs(prev => [...prev.filter(l => l.date !== dateStr), log])

    alert(prs.length
      ? `Workout saved! 🏆 ${prs.length} new PR${prs.length > 1 ? 's' : ''}!`
      : 'Workout saved! Great work 💪'
    )
  }

  return (
    <div className="page workout-logger">
      <DateStrip />
      <div className="logger-header">
        <div>
          <div className="logger-title">{session.name}</div>
          <div className="logger-sub">{session.muscles}</div>
        </div>
        <div className="logger-timer">⏱ {elapsedDisplay}</div>
      </div>

      {session.exercises.map(ex => {
        const effectiveName = swappedExercises[ex.name] ?? ex.name
        const previousSets = getPreviousSets(effectiveName, workoutLogs, dateStr)

        return (
          <div key={ex.name}>
            {swapTarget === ex.name ? (
              <div className="swap-overlay card">
                <div className="swap-title">Replace exercise</div>
                <input
                  className="swap-input"
                  type="text"
                  value={swapInput}
                  placeholder={effectiveName}
                  autoFocus
                  onChange={e => setSwapInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmSwap(ex.name)}
                />
                <div className="swap-actions">
                  <button className="swap-cancel" onClick={() => { setSwapTarget(null); setSwapInput('') }}>Cancel</button>
                  <button className="swap-confirm" onClick={() => confirmSwap(ex.name)}>Swap</button>
                </div>
              </div>
            ) : (
              <ExerciseBlock
                exercise={{ ...ex, name: effectiveName }}
                sets={exerciseSets[ex.name] ?? []}
                onSetUpdate={(i, field, val) => handleSetUpdate(ex.name, i, field, val)}
                previousSets={previousSets}
                onSwap={() => { setSwapTarget(ex.name); setSwapInput(effectiveName) }}
              />
            )}
            {activeRest?.exerciseName === ex.name && activeRest.seconds > 0 && (
              <RestTimer
                seconds={activeRest.seconds}
                onDone={() => setActiveRest(null)}
              />
            )}
          </div>
        )
      })}

      <button className="btn-primary" onClick={handleFinish}>
        ✅ Finish Workout
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```
cd C:/Users/Ehab/.local/bin/motaz-gym && npx vitest run
```

Expected: all pass.

- [ ] **Step 3: Commit**

```
git -C "C:/Users/Ehab/.local/bin/motaz-gym" add src/pages/WorkoutLogger.jsx
git -C "C:/Users/Ehab/.local/bin/motaz-gym" commit -m "feat: WorkoutLogger uses DateContext and DateStrip"
```

---

## Task 7: Update MealItem (Edit/Delete + MealEditForm)

**Files:**
- Modify: `src/components/MealItem.jsx`
- Modify: `src/components/MealItem.css`

- [ ] **Step 1: Replace MealItem.jsx**

Replace the entire contents of `src/components/MealItem.jsx`:

```jsx
import { useState } from 'react'
import './MealItem.css'

export function MealEditForm({ meal, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: meal.name ?? '',
    emoji: meal.emoji ?? '🍽️',
    time: meal.time ?? '',
    description: meal.description ?? '',
    calories: meal.calories ?? 0,
    protein: meal.protein ?? 0,
    carbs: meal.carbs ?? 0,
    fat: meal.fat ?? 0,
  })

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
  }

  function handleSave() {
    if (!form.name.trim()) return
    onSave({
      ...form,
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
    })
  }

  return (
    <div className="meal-edit-form">
      <div className="meal-edit-title">{meal.id ? 'Edit meal' : 'New meal'}</div>
      <div className="meal-edit-grid">
        <label className="meal-edit-label">
          Name
          <input className="meal-edit-input" value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="e.g. Lunch" />
        </label>
        <label className="meal-edit-label">
          Emoji
          <input className="meal-edit-input meal-edit-emoji" value={form.emoji}
            onChange={e => set('emoji', e.target.value)} maxLength={2} />
        </label>
        <label className="meal-edit-label">
          Time
          <input className="meal-edit-input" value={form.time}
            onChange={e => set('time', e.target.value)} placeholder="e.g. 1:00 PM" />
        </label>
        <label className="meal-edit-label meal-edit-full">
          Description
          <input className="meal-edit-input" value={form.description}
            onChange={e => set('description', e.target.value)} placeholder="What's in it?" />
        </label>
        <label className="meal-edit-label">
          Calories
          <input className="meal-edit-input" type="number" inputMode="numeric"
            value={form.calories} onChange={e => set('calories', e.target.value)} />
        </label>
        <label className="meal-edit-label">
          Protein (g)
          <input className="meal-edit-input" type="number" inputMode="numeric"
            value={form.protein} onChange={e => set('protein', e.target.value)} />
        </label>
        <label className="meal-edit-label">
          Carbs (g)
          <input className="meal-edit-input" type="number" inputMode="numeric"
            value={form.carbs} onChange={e => set('carbs', e.target.value)} />
        </label>
        <label className="meal-edit-label">
          Fat (g)
          <input className="meal-edit-input" type="number" inputMode="numeric"
            value={form.fat} onChange={e => set('fat', e.target.value)} />
        </label>
      </div>
      <div className="meal-edit-actions">
        <button className="meal-edit-cancel" onClick={onCancel}>Cancel</button>
        <button className="meal-edit-save" onClick={handleSave}>Save</button>
      </div>
    </div>
  )
}

export default function MealItem({ meal, eaten, onToggle, onEdit, onDelete }) {
  return (
    <div className={`meal-item ${eaten ? 'meal-eaten' : ''}`} onClick={onToggle}>
      <div className="meal-emoji">{meal.emoji}</div>
      <div className="meal-body">
        <div className="meal-name">{meal.name}</div>
        <div className="meal-time">{meal.time} · {meal.description}</div>
      </div>
      <div className="meal-right">
        <div className="meal-kcal">{meal.calories}</div>
        <div className="meal-actions" onClick={e => e.stopPropagation()}>
          {onEdit && (
            <button className="meal-action-btn" onClick={onEdit} title="Edit meal">✏️</button>
          )}
          {onDelete && (
            <button className="meal-action-btn" onClick={onDelete} title="Delete meal">🗑️</button>
          )}
        </div>
        <div className={`meal-check ${eaten ? 'checked' : ''}`}>{eaten ? '✓' : ''}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace MealItem.css**

Replace the entire contents of `src/components/MealItem.css`:

```css
.meal-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.meal-item.meal-eaten { border-color: rgba(76,175,80,0.3); }
.meal-item:hover { border-color: var(--border-light); }

.meal-emoji { font-size: 24px; flex-shrink: 0; }
.meal-body { flex: 1; min-width: 0; }
.meal-name { font-size: 14px; font-weight: 700; }
.meal-time { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

.meal-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.meal-kcal { font-size: 14px; font-weight: 800; color: var(--red); }

.meal-actions { display: flex; gap: 2px; }
.meal-action-btn {
  background: var(--bg-input);
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 13px;
  opacity: 0.6;
  transition: opacity 0.15s;
}
.meal-action-btn:hover { opacity: 1; }

.meal-check {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: var(--bg-input);
  border: 1px solid var(--border-light);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800;
}
.meal-check.checked { background: var(--green); border-color: var(--green); color: #fff; }

/* Edit form */
.meal-edit-form {
  background: var(--bg-card);
  border: 1px solid var(--red);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 10px;
}
.meal-edit-title {
  font-size: 11px;
  color: var(--red);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 700;
  margin-bottom: 12px;
}
.meal-edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.meal-edit-full { grid-column: 1 / -1; }
.meal-edit-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}
.meal-edit-input {
  background: var(--bg-input);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  color: var(--text);
  font-size: 13px;
  width: 100%;
}
.meal-edit-input:focus { border-color: var(--red); }
.meal-edit-emoji { text-align: center; font-size: 18px; }
.meal-edit-actions { display: flex; gap: 8px; justify-content: flex-end; }
.meal-edit-cancel {
  background: var(--bg-input);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  font-size: 13px;
}
.meal-edit-save {
  background: var(--red);
  color: #fff;
  border-radius: var(--radius-sm);
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 700;
}
.meal-edit-save:hover { background: var(--red-dark); }
```

- [ ] **Step 3: Run full test suite**

```
cd C:/Users/Ehab/.local/bin/motaz-gym && npx vitest run
```

Expected: all pass.

- [ ] **Step 4: Commit**

```
git -C "C:/Users/Ehab/.local/bin/motaz-gym" add src/components/MealItem.jsx src/components/MealItem.css
git -C "C:/Users/Ehab/.local/bin/motaz-gym" commit -m "feat: MealItem edit/delete buttons and MealEditForm"
```

---

## Task 8: Update Nutrition Page

**Files:**
- Modify: `src/pages/Nutrition.jsx`
- Modify: `src/pages/Nutrition.css` (add styles for add-meal button)

- [ ] **Step 1: Replace Nutrition.jsx**

Replace the entire contents of `src/pages/Nutrition.jsx`:

```jsx
import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useSelectedDate } from '../context/DateContext'
import { useMeals } from '../hooks/useMeals'
import { useTargets } from '../hooks/useTargets'
import { toLocalDateStr } from '../utils/dateHelpers'
import CalorieRing from '../components/CalorieRing'
import MacroBar from '../components/MacroBar'
import MealItem, { MealEditForm } from '../components/MealItem'
import DateStrip from '../components/DateStrip'
import './Nutrition.css'

function generateId() {
  return `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function Nutrition() {
  const { selectedDate } = useSelectedDate()
  const [nutritionLogs, setNutritionLogs] = useStorage('motaz_nutrition_logs', [])
  const [meals, setMeals] = useMeals()
  const [targets] = useTargets()
  const [editingId, setEditingId] = useState(null)

  const dateStr = toLocalDateStr(selectedDate)
  const dayLog = nutritionLogs.find(l => l.date === dateStr) ?? { date: dateStr, meals: [], calorieBump: 0 }
  const eatenIds = new Set(dayLog.meals.filter(m => m.eaten).map(m => m.id))
  const bump = dayLog.calorieBump ?? 0

  const eaten = meals.filter(m => eatenIds.has(m.id)).reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
  const totalCalories = Math.max(0, eaten.calories + bump)

  function updateDayLog(updater) {
    setNutritionLogs(prev => {
      const existing = prev.find(l => l.date === dateStr)
      const base = existing ?? { date: dateStr, meals: [], calorieBump: 0 }
      const updated = updater(base)
      return existing ? prev.map(l => l.date === dateStr ? updated : l) : [...prev, updated]
    })
  }

  function toggleMeal(mealId) {
    updateDayLog(base => {
      const alreadyEaten = base.meals.find(m => m.id === mealId)?.eaten
      const updatedMeals = alreadyEaten
        ? base.meals.map(m => m.id === mealId ? { ...m, eaten: false } : m)
        : [...base.meals.filter(m => m.id !== mealId), { id: mealId, eaten: true }]
      return { ...base, meals: updatedMeals }
    })
  }

  function adjustCalories(delta) {
    updateDayLog(base => ({ ...base, calorieBump: (base.calorieBump ?? 0) + delta }))
  }

  function saveMeal(updatedMeal) {
    if (editingId === 'new') {
      setMeals(prev => [...prev, { ...updatedMeal, id: generateId() }])
    } else {
      setMeals(prev => prev.map(m => m.id === editingId ? { ...m, ...updatedMeal } : m))
    }
    setEditingId(null)
  }

  function deleteMeal(mealId) {
    const name = meals.find(m => m.id === mealId)?.name ?? 'meal'
    if (!window.confirm(`Delete "${name}"?`)) return
    setMeals(prev => prev.filter(m => m.id !== mealId))
  }

  return (
    <div className="page nutrition">
      <DateStrip />

      <div className="nutrition-header">
        <h1 className="nutrition-title">Food Schedule 🥗</h1>
        <div className="nutrition-sub">
          {selectedDate.toLocaleDateString('en', { weekday: 'long' })} · {targets.calories} kcal target
        </div>
      </div>

      <div className="card">
        <CalorieRing eaten={totalCalories} target={targets.calories} />
        <div className="calorie-adjust">
          <button className="adjust-btn" onClick={() => adjustCalories(-100)}>−100</button>
          <span className="adjust-label">
            {bump > 0 ? `+${bump} extra kcal` : bump < 0 ? `${bump} kcal` : 'Quick adjust'}
          </span>
          <button className="adjust-btn" onClick={() => adjustCalories(100)}>+100</button>
        </div>
        <MacroBar label="Protein" value={eaten.protein} target={targets.protein} color="var(--red)" unit="g" />
        <MacroBar label="Carbs"   value={eaten.carbs}   target={targets.carbs}   color="var(--orange)" unit="g" />
        <MacroBar label="Fat"     value={eaten.fat}      target={targets.fat}     color="var(--yellow)" unit="g" />
      </div>

      <p className="section-title">Meal Plan</p>

      {meals.map(meal =>
        editingId === meal.id ? (
          <MealEditForm
            key={meal.id}
            meal={meal}
            onSave={saveMeal}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <MealItem
            key={meal.id}
            meal={meal}
            eaten={eatenIds.has(meal.id)}
            onToggle={() => toggleMeal(meal.id)}
            onEdit={() => setEditingId(meal.id)}
            onDelete={() => deleteMeal(meal.id)}
          />
        )
      )}

      {editingId === 'new' && (
        <MealEditForm
          meal={{ name: '', emoji: '🍽️', time: '', description: '', calories: 0, protein: 0, carbs: 0, fat: 0 }}
          onSave={saveMeal}
          onCancel={() => setEditingId(null)}
        />
      )}

      {editingId !== 'new' && (
        <button className="add-meal-btn" onClick={() => setEditingId('new')}>+ Add meal</button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add add-meal-btn style to Nutrition.css**

Open `src/pages/Nutrition.css` and append at the end:

```css
.add-meal-btn {
  width: 100%;
  padding: 14px;
  border: 1px dashed var(--border-light);
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: 14px;
  margin-bottom: 10px;
  transition: border-color 0.2s, color 0.2s;
}
.add-meal-btn:hover { border-color: var(--red); color: var(--red); }
```

- [ ] **Step 3: Run full test suite**

```
cd C:/Users/Ehab/.local/bin/motaz-gym && npx vitest run
```

Expected: all pass.

- [ ] **Step 4: Commit**

```
git -C "C:/Users/Ehab/.local/bin/motaz-gym" add src/pages/Nutrition.jsx src/pages/Nutrition.css
git -C "C:/Users/Ehab/.local/bin/motaz-gym" commit -m "feat: Nutrition page — date navigation, editable meals, live targets"
```

---

## Task 9: Update Settings (Targets + Macro Calculator)

**Files:**
- Modify: `src/pages/Settings.jsx`
- Modify: `src/pages/Settings.css`

- [ ] **Step 1: Replace Settings.jsx**

Replace the entire contents of `src/pages/Settings.jsx`:

```jsx
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
              ~{calcResult.calories} kcal · {calcResult.protein}g P · {calcResult.carbs}g C · {calcResult.fat}g F
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
```

- [ ] **Step 2: Append calculator and targets styles to Settings.css**

Open `src/pages/Settings.css` and append at the end:

```css
.calc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}
.calc-full { grid-column: 1 / -1; }

.calc-label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.calc-input {
  background: var(--bg-input);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  color: var(--text);
  font-size: 14px;
  width: 100%;
}
.calc-input:focus { border-color: var(--red); outline: none; }

.calc-select {
  background: var(--bg-input);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  color: var(--text);
  font-size: 13px;
  width: 100%;
}

.calc-toggle {
  display: flex;
  gap: 6px;
}
.calc-toggle-btn {
  flex: 1;
  padding: 7px 4px;
  background: var(--bg-input);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 12px;
  border: 1px solid var(--border-light);
  transition: background 0.15s, color 0.15s;
}
.calc-toggle-btn.active {
  background: var(--red);
  color: #fff;
  border-color: var(--red);
}

.calc-calc-btn {
  width: 100%;
  margin-bottom: 0;
}

.calc-result {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.calc-result-nums {
  font-size: 13px;
  color: var(--text);
  font-weight: 600;
}
```

- [ ] **Step 3: Run full test suite**

```
cd C:/Users/Ehab/.local/bin/motaz-gym && npx vitest run
```

Expected: all pass.

- [ ] **Step 4: Commit**

```
git -C "C:/Users/Ehab/.local/bin/motaz-gym" add src/pages/Settings.jsx src/pages/Settings.css
git -C "C:/Users/Ehab/.local/bin/motaz-gym" commit -m "feat: Settings — macro calculator and editable targets"
```

---

## Task 10: Update Backup Keys

**Files:**
- Modify: `src/hooks/useStorage.js`

- [ ] **Step 1: Add new keys to DATA_KEYS**

In `src/hooks/useStorage.js`, find the line:

```js
const DATA_KEYS = ['motaz_workout_logs', 'motaz_nutrition_logs', 'motaz_body_weight_logs']
```

Replace it with:

```js
const DATA_KEYS = [
  'motaz_workout_logs',
  'motaz_nutrition_logs',
  'motaz_body_weight_logs',
  'motaz_meals',
  'motaz_targets',
  'motaz_profile',
]
```

- [ ] **Step 2: Run full test suite**

```
cd C:/Users/Ehab/.local/bin/motaz-gym && npx vitest run
```

Expected: all 21+ tests pass.

- [ ] **Step 3: Build to verify no compile errors**

```
cd C:/Users/Ehab/.local/bin/motaz-gym && npm run build
```

Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```
git -C "C:/Users/Ehab/.local/bin/motaz-gym" add src/hooks/useStorage.js
git -C "C:/Users/Ehab/.local/bin/motaz-gym" commit -m "feat: include meals, targets, and profile in data backup"
```
