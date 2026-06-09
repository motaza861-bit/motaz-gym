# Exercise Editor + Date Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inline add/edit/delete exercises in the WorkoutLogger, and reset the selected date to today whenever the app comes back into view on a new calendar day.

**Architecture:** ExerciseEditForm mirrors the MealEditForm pattern — an inline form that expands inside ExerciseBlock. WorkoutLogger manages `editingId` state and writes changes back through `useExercises()`. DateContext adds a `visibilitychange` listener that resets date only when the calendar day has changed.

**Tech Stack:** React 19, useExercises hook (built in onboarding plan), localStorage.

**Prerequisite:** Tasks 2 of the onboarding plan must be complete (useExercises hook exists).

---

### Task 1: Date Reset in DateContext

**Files:**
- Modify: `src/context/DateContext.jsx`
- Test: `tests/context/DateContext.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `tests/context/DateContext.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { DateProvider, useSelectedDate } from '../../src/context/DateContext'

const wrapper = ({ children }) => <DateProvider>{children}</DateProvider>

describe('DateContext', () => {
  it('initialises to today', () => {
    const { result } = renderHook(() => useSelectedDate(), { wrapper })
    const today = new Date()
    expect(result.current.selectedDate.toDateString()).toBe(today.toDateString())
  })

  it('resets to today when visibilitychange fires on a new day', () => {
    const { result } = renderHook(() => useSelectedDate(), { wrapper })

    // Simulate user navigating to yesterday
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    act(() => result.current.setSelectedDate(yesterday))
    expect(result.current.selectedDate.toDateString()).toBe(yesterday.toDateString())

    // Simulate app coming to foreground
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    // Should reset to today because yesterday !== today
    expect(result.current.selectedDate.toDateString()).toBe(new Date().toDateString())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run tests/context/DateContext.test.jsx 2>&1 | tail -10
```

Expected: second test FAILS — no visibilitychange logic yet.

- [ ] **Step 3: Update DateContext.jsx**

Replace the full contents of `src/context/DateContext.jsx` with:

```jsx
import { createContext, useContext, useEffect, useState } from 'react'

const DateContext = createContext(null)

export function DateProvider({ children }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  useEffect(() => {
    const resetIfNewDay = () => {
      if (document.visibilityState === 'visible') {
        setSelectedDate(prev => {
          const today = new Date()
          return prev.toDateString() !== today.toDateString() ? today : prev
        })
      }
    }
    document.addEventListener('visibilitychange', resetIfNewDay)
    return () => document.removeEventListener('visibilitychange', resetIfNewDay)
  }, [])

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

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run tests/context/DateContext.test.jsx 2>&1 | tail -10
```

Expected: 2 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run 2>&1 | tail -8
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add src/context/DateContext.jsx tests/context/DateContext.test.jsx
git commit -m "fix: reset date to today when app comes back into view on a new day"
```

---

### Task 2: Create ExerciseEditForm component

**Files:**
- Create: `src/components/ExerciseEditForm.jsx`
- Create: `src/components/ExerciseEditForm.css`

- [ ] **Step 1: Create ExerciseEditForm.jsx**

Create `src/components/ExerciseEditForm.jsx`:

```jsx
import { useState } from 'react'
import './ExerciseEditForm.css'

export default function ExerciseEditForm({ exercise, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: exercise?.name ?? '',
    sets: exercise?.sets ?? 3,
    reps: exercise?.reps ?? '8-10',
    rest: exercise?.rest ?? 90,
    muscles: exercise?.muscles ?? '',
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  function handleSave() {
    if (!form.name.trim()) return
    onSave({
      name: form.name.trim(),
      sets: Number(form.sets) || 3,
      reps: form.reps.trim() || '8-10',
      rest: Number(form.rest) || 90,
      muscles: form.muscles.trim(),
    })
  }

  return (
    <div className="ex-edit-form">
      <div className="ex-edit-title">{exercise ? 'Edit Exercise' : 'New Exercise'}</div>
      <div className="ex-edit-grid">
        <div className="ex-edit-field ex-edit-full">
          <label className="ex-edit-label">Name</label>
          <input className="ex-edit-input" type="text" placeholder="e.g. Bench Press" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="ex-edit-field">
          <label className="ex-edit-label">Sets</label>
          <input className="ex-edit-input" type="number" inputMode="numeric" min="1" value={form.sets} onChange={e => set('sets', e.target.value)} />
        </div>
        <div className="ex-edit-field">
          <label className="ex-edit-label">Reps</label>
          <input className="ex-edit-input" type="text" placeholder="8-10" value={form.reps} onChange={e => set('reps', e.target.value)} />
        </div>
        <div className="ex-edit-field">
          <label className="ex-edit-label">Rest (s)</label>
          <input className="ex-edit-input" type="number" inputMode="numeric" min="0" value={form.rest} onChange={e => set('rest', e.target.value)} />
        </div>
        <div className="ex-edit-field ex-edit-full">
          <label className="ex-edit-label">Muscles</label>
          <input className="ex-edit-input" type="text" placeholder="e.g. Chest, Triceps" value={form.muscles} onChange={e => set('muscles', e.target.value)} />
        </div>
      </div>
      <div className="ex-edit-actions">
        <button className="ex-edit-cancel" onClick={onCancel}>Cancel</button>
        <button className="ex-edit-save" onClick={handleSave} disabled={!form.name.trim()}>Save</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ExerciseEditForm.css**

Create `src/components/ExerciseEditForm.css`:

```css
.ex-edit-form {
  background: var(--bg-card);
  border: 1px solid var(--red);
  border-radius: var(--radius);
  padding: 14px;
  margin-bottom: 8px;
}

.ex-edit-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--red);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.ex-edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.ex-edit-full {
  grid-column: 1 / -1;
}

.ex-edit-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ex-edit-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.ex-edit-input {
  background: var(--bg);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  color: var(--text);
  font-size: 14px;
  padding: 8px 10px;
  width: 100%;
  box-sizing: border-box;
}

.ex-edit-input:focus {
  outline: none;
  border-color: var(--red);
}

.ex-edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.ex-edit-cancel {
  background: var(--bg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: 13px;
  padding: 7px 14px;
  cursor: pointer;
}

.ex-edit-save {
  background: var(--red);
  border: none;
  border-radius: var(--radius);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 14px;
  cursor: pointer;
}

.ex-edit-save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Build to verify**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — no errors.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add src/components/ExerciseEditForm.jsx src/components/ExerciseEditForm.css
git commit -m "feat: ExerciseEditForm inline edit component"
```

---

### Task 3: Add edit/delete buttons to ExerciseBlock

**Files:**
- Modify: `src/components/ExerciseBlock.jsx`
- Modify: `src/components/ExerciseBlock.css`

- [ ] **Step 1: Add onEdit and onDelete props to ExerciseBlock**

Read `src/components/ExerciseBlock.jsx`. The component signature is:
```jsx
export default function ExerciseBlock({ exercise, sets, onSetUpdate, previousSets, onSwap })
```

Replace with:
```jsx
export default function ExerciseBlock({ exercise, sets, onSetUpdate, previousSets, onSwap, onEdit, onDelete })
```

Find the `.ex-block-header` div. It currently contains the exercise name/meta and the swap button. Add edit and delete buttons next to the swap button:

```jsx
<div className="ex-block-header">
  <div>
    <div className="ex-block-name">{exercise.name}</div>
    <div className="ex-block-meta">{exercise.sets} sets · {exercise.reps} reps · {exercise.rest}s rest</div>
  </div>
  <div className="ex-block-header-actions">
    {onSwap && (
      <button className="ex-swap-btn" onClick={onSwap} title="Swap exercise">⇄</button>
    )}
    {onEdit && (
      <button className="ex-action-btn" onClick={onEdit} title="Edit exercise">✏️</button>
    )}
    {onDelete && (
      <button className="ex-action-btn" onClick={onDelete} title="Delete exercise">🗑</button>
    )}
  </div>
</div>
```

- [ ] **Step 2: Add CSS for header actions**

Append to `src/components/ExerciseBlock.css`:

```css
.ex-block-header-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.ex-action-btn {
  background: var(--bg);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-size: 14px;
  padding: 4px 8px;
  cursor: pointer;
  line-height: 1;
}
```

- [ ] **Step 3: Build to verify**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm run build 2>&1 | tail -5
```

Expected: `✓ built in`.

- [ ] **Step 4: Run tests**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run 2>&1 | tail -8
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add src/components/ExerciseBlock.jsx src/components/ExerciseBlock.css
git commit -m "feat: add optional edit/delete buttons to ExerciseBlock"
```

---

### Task 4: Wire exercise CRUD into WorkoutLogger

**Files:**
- Modify: `src/pages/WorkoutLogger.jsx`

- [ ] **Step 1: Read WorkoutLogger to understand where exercises are rendered**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && grep -n "ExerciseBlock\|session\.exercises\|exerciseSets" src/pages/WorkoutLogger.jsx | head -20
```

Note the line numbers for the ExerciseBlock render loop and adjacent JSX.

- [ ] **Step 2: Add editingId state and exercise CRUD handlers**

Inside the `WorkoutLogger` component function, add these state and handler declarations after the existing useState/useEffect hooks:

```jsx
const [editingId, setEditingId] = useState(null) // null | exercise.name | 'new'

function saveExercise(updated) {
  setProgram(prev => {
    const exercises = editingId === 'new'
      ? [...prev.sessions[sessionKey].exercises, updated]
      : prev.sessions[sessionKey].exercises.map(ex => ex.name === editingId ? updated : ex)
    return {
      ...prev,
      sessions: {
        ...prev.sessions,
        [sessionKey]: { ...prev.sessions[sessionKey], exercises },
      },
    }
  })
  setEditingId(null)
}

function deleteExercise(name) {
  if (!window.confirm(`Delete "${name}"?`)) return
  setProgram(prev => ({
    ...prev,
    sessions: {
      ...prev.sessions,
      [sessionKey]: {
        ...prev.sessions[sessionKey],
        exercises: prev.sessions[sessionKey].exercises.filter(ex => ex.name !== name),
      },
    },
  }))
}
```

Note: `setProgram` is the setter from `useExercises()`. Make sure the destructuring at the top of the component reads both values:
```jsx
const [program, setProgram] = useExercises()
const SESSIONS = program.sessions
const DAY_SESSION = program.daySession
```

- [ ] **Step 3: Add ExerciseEditForm import**

At the top of `src/pages/WorkoutLogger.jsx`, add:
```jsx
import ExerciseEditForm from '../components/ExerciseEditForm'
```

- [ ] **Step 4: Update the ExerciseBlock render loop**

Find the section where `ExerciseBlock` components are mapped. It looks like:

```jsx
{session.exercises.map(exercise => (
  <ExerciseBlock
    key={exercise.name}
    exercise={exercise}
    ...
  />
))}
```

Replace with:

```jsx
{session.exercises.map(exercise => (
  editingId === exercise.name ? (
    <ExerciseEditForm
      key={exercise.name}
      exercise={exercise}
      onSave={saveExercise}
      onCancel={() => setEditingId(null)}
    />
  ) : (
    <ExerciseBlock
      key={exercise.name}
      exercise={exercise}
      sets={exerciseSets[exercise.name] ?? []}
      onSetUpdate={(i, field, val) => updateSet(exercise.name, i, field, val)}
      previousSets={getPreviousSets(exercise.name)}
      onSwap={swappedExercises[exercise.name] ? undefined : () => { setSwapTarget(exercise.name); setSwapInput('') }}
      onEdit={() => setEditingId(exercise.name)}
      onDelete={() => deleteExercise(exercise.name)}
    />
  )
))}

{editingId === 'new' && (
  <ExerciseEditForm
    exercise={null}
    onSave={saveExercise}
    onCancel={() => setEditingId(null)}
  />
)}

{editingId !== 'new' && (
  <button className="add-exercise-btn" onClick={() => setEditingId('new')}>+ Add exercise</button>
)}
```

- [ ] **Step 5: Add add-exercise-btn styles**

Read `src/pages/WorkoutLogger.css` (or wherever workout styles live) and append:

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && ls src/pages/WorkoutLogger.css 2>/dev/null || echo "check src/pages/"
```

Append to the workout CSS file (whichever exists: `src/pages/WorkoutLogger.css` or `src/pages/Workout.css`):

```css
.add-exercise-btn {
  display: block;
  width: 100%;
  padding: 14px;
  background: none;
  border: 1px dashed var(--border-light);
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  text-align: center;
  margin-top: 8px;
  transition: border-color 0.15s, color 0.15s;
}

.add-exercise-btn:hover {
  border-color: var(--red);
  color: var(--red);
}
```

- [ ] **Step 6: Also reset editingId when sessionKey changes**

Find the existing `useEffect` on `[sessionKey]` in WorkoutLogger (the one that resets exerciseSets, swappedExercises, elapsed, etc.). Add `setEditingId(null)` to it:

```jsx
useEffect(() => {
  setExerciseSets(session ? Object.fromEntries(session.exercises.map(ex => [ex.name, buildInitialSets(ex)])) : {})
  setSwappedExercises({})
  setSwapTarget(null)
  setSwapInput('')
  setElapsed(0)
  startedAt.current = Date.now()
  setEditingId(null)   // ← add this line
}, [sessionKey])
```

- [ ] **Step 7: Build to verify**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm run build 2>&1 | tail -8
```

Expected: `✓ built in` — no errors.

- [ ] **Step 8: Run full test suite**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run 2>&1 | tail -8
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add src/pages/WorkoutLogger.jsx
git commit -m "feat: inline exercise add/edit/delete in WorkoutLogger"
```
