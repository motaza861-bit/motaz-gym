# Progress Rewrite + Nutrition Cleanup + Calendar Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the default meal templates, restyle delete buttons, remove the Settings notifications section, mark days with any data on the DateStrip, and rewrite the Progress page around a body-weight calendar + powerlifting big-three tracking.

**Architecture:** Five small-to-medium UI changes layered on the existing React/Vite app. The biggest piece — the Progress page — is decomposed into two new reusable components (`BodyWeightCalendar`, `BigThreeCard`) so the page file stays readable. A new synced storage key `big_three_logs` joins the existing key set.

**Tech Stack:** React 19, react-router-dom 7, Vitest + @testing-library/react.

**Source spec:** `docs/superpowers/specs/2026-06-06-progress-nutrition-cleanup-design.md`

---

## File map

### Added
- `src/components/BodyWeightCalendar.jsx` — month-grid calendar with prev/next nav and inline editor
- `src/components/BodyWeightCalendar.css`
- `src/components/BigThreeCard.jsx` — single lift card (latest, history list, add form, delete row)
- `src/components/BigThreeCard.css`
- `tests/components/BodyWeightCalendar.test.jsx`
- `tests/components/BigThreeCard.test.jsx`

### Modified
- `src/data/nutritionPlan.js` — `DEFAULT_MEALS = []`
- `src/components/DateStrip.jsx` — dot reflects workout OR nutrition data
- `src/components/AuthGuard.jsx` — `big_three_logs` added to `SYNC_KEYS`
- `src/lib/sync.js` — `big_three_logs` added to `MIGRATABLE_KEYS`
- `src/hooks/useStorage.js` — `big_three_logs` added to `DATA_KEYS`
- `src/main.jsx` — drop notifications bootstrap, add one-shot legacy key cleanup
- `src/pages/Settings.jsx` + `src/pages/Settings.css` — remove notifications block
- `src/pages/Nutrition.jsx` + `src/pages/Nutrition.css` — bigger/red quick-log delete
- `src/pages/FoodSearchPage.jsx` + `src/pages/FoodSearchPage.css` — Cancel button on portion picker
- `src/components/FoodSearch.css` — bigger/red delete on custom food rows
- `src/pages/Progress.jsx` — full rewrite (keep 1RM only, mount the two new components)
- `src/pages/Progress.css` — drop chart styles, add new section styles
- `src/i18n/translations.js` — remove `st.notif_*` strings

### Deleted
- `src/utils/notifications.js`

---

## Task 1: Empty DEFAULT_MEALS

**Files:**
- Modify: `src/data/nutritionPlan.js`

- [ ] **Step 1: Read the file to locate `DEFAULT_MEALS`**

Run: `grep -n "DEFAULT_MEALS" src/data/nutritionPlan.js`
Expected: lines showing the existing `export const DEFAULT_MEALS = [ ... ]`.

- [ ] **Step 2: Replace with an empty array**

Edit `src/data/nutritionPlan.js`: change the `DEFAULT_MEALS` export so it reads exactly:
```js
export const DEFAULT_MEALS = []
```
(Keep `DEFAULT_TARGETS` and any other exports unchanged.)

- [ ] **Step 3: Run the full test suite**

Run: `npm run test:run`
Expected: all tests pass (no test currently depends on `DEFAULT_MEALS` contents).

- [ ] **Step 4: Commit**

```bash
git add src/data/nutritionPlan.js
git commit -m "feat(nutrition): start meal plan empty by default"
```

---

## Task 2: DateStrip dot if any data exists

**Files:**
- Modify: `src/components/DateStrip.jsx`

- [ ] **Step 1: Update the hook usage and dot computation**

Replace the body of the `DateStrip` component (everything inside the function before `return`) so it reads:

```jsx
const { selectedDate, setSelectedDate } = useSelectedDate()
const [workoutLogs] = useStorage('workout_logs', [])
const [nutritionLogs] = useStorage('nutrition_logs', [])
const scrollRef = useRef(null)

const workoutDates = new Set(workoutLogs.filter(l => l.completed).map(l => l.date))
const nutritionDates = new Set(
  nutritionLogs
    .filter(l =>
      (l.meals?.some(m => m.eaten)) ||
      ((l.quickLogs?.length ?? 0) > 0) ||
      ((l.calorieBump ?? 0) !== 0)
    )
    .map(l => l.date)
)

const todayStr = toLocalDateStr(new Date())
const selectedStr = toLocalDateStr(selectedDate)
```

Then in the `.map` over `DAYS`, replace:
```jsx
const hasLog = completedDates.has(str)
```
with:
```jsx
const hasLog = workoutDates.has(str) || nutritionDates.has(str)
```

(The `completedDates` variable is removed.)

- [ ] **Step 2: Sanity test in dev server (no automated test for this trivial change)**

Run: `npm run dev`
Expected: app loads, DateStrip renders. Logs from existing days still show a dot. Stop the server.

- [ ] **Step 3: Run unit tests**

Run: `npm run test:run`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/components/DateStrip.jsx
git commit -m "feat(date-strip): mark days with workout or nutrition data"
```

---

## Task 3: Remove notifications surface

**Files:**
- Delete: `src/utils/notifications.js`
- Modify: `src/main.jsx`
- Modify: `src/pages/Settings.jsx`
- Modify: `src/pages/Settings.css`
- Modify: `src/i18n/translations.js`

- [ ] **Step 1: Delete the utility file**

Run: `rm src/utils/notifications.js`

- [ ] **Step 2: Update `src/main.jsx`**

Replace the file's contents with:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DateProvider } from './context/DateContext'
import { LanguageProvider } from './context/LanguageContext'
import './index.css'
import App from './App'

try { localStorage.removeItem('motaz_notifications') } catch {}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <DateProvider>
        <App />
      </DateProvider>
    </LanguageProvider>
  </StrictMode>
)
```

- [ ] **Step 3: Update `src/pages/Settings.jsx`**

Make these edits in order:

(a) Remove the imports for the notifications utility. Delete this line:
```jsx
import { requestPermission, scheduleNotifications } from '../utils/notifications'
```

(b) Remove the `notifPrefs` / `notifStatus` state declarations near the top. Delete these lines:
```jsx
const [notifPrefs, setNotifPrefs] = useStorage('motaz_notifications', { enabled: false, workoutTime: '07:00', foodTime: '20:00' })
const [notifStatus, setNotifStatus] = useState(() => {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
})
```

(c) Remove any helpers that reference notifications. Delete the entire `enableNotifications` function and the entire `updateNotifPref` function (search for `function enableNotifications` and `function updateNotifPref`).

(d) Remove the `notifications` entry from the `TILES` array (it has `key: 'notifications'`).

(e) Remove the `notifications:` entry from the `sectionRefs` object literal (typically near the top — search for `sectionRefs`).

(f) Remove the entire JSX block beginning with `<div ref={sectionRefs.notifications}>` and ending at its matching closing `</div>`. This is the whole 🔔 Notifications card.

- [ ] **Step 4: Update `src/pages/Settings.css`**

Remove any rules whose selector contains `notif-` (e.g. `.notif-times`). Use:
```bash
grep -n "notif-" src/pages/Settings.css
```
to find them, and delete those blocks.

- [ ] **Step 5: Update `src/i18n/translations.js`**

Remove every key starting with `st.notif_` from both language objects (en + ar). Use:
```bash
grep -n "st\.notif_" src/i18n/translations.js
```
to list them, then delete each.

- [ ] **Step 6: Run tests + build to confirm nothing references removed code**

Run:
```bash
npm run test:run
npm run build
```
Expected: tests pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -u src/main.jsx src/pages/Settings.jsx src/pages/Settings.css src/i18n/translations.js
git add src/utils/notifications.js  # tracks the deletion
git commit -m "refactor(settings): remove notifications section"
```

---

## Task 4: Bigger / red delete button in Nutrition quick logs

**Files:**
- Modify: `src/pages/Nutrition.css`

- [ ] **Step 1: Locate the existing `.quick-log-del` rule**

Run: `grep -n "quick-log-del" src/pages/Nutrition.css`
Expected: a line showing the existing rule.

- [ ] **Step 2: Replace the rule**

Replace the entire `.quick-log-del { ... }` block with:

```css
.quick-log-del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  min-height: 36px;
  padding: 0;
  margin-left: 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 80, 80, 0.3);
  background: rgba(255, 80, 80, 0.08);
  color: #ff5c5c;
  font-size: 16px;
  cursor: pointer;
}
.quick-log-del:hover { background: rgba(255, 80, 80, 0.18); }
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Nutrition.css
git commit -m "style(nutrition): clearer delete button on quick logs"
```

---

## Task 5: Cancel button on portion picker + larger Add button

**Files:**
- Modify: `src/pages/FoodSearchPage.jsx`
- Modify: `src/pages/FoodSearchPage.css`

- [ ] **Step 1: Edit the portion picker actions in `src/pages/FoodSearchPage.jsx`**

Locate this line (near the bottom of the file):
```jsx
<button className="fpage-add-btn" onClick={handleAdd}>{t('nu.add_to_today')}</button>
```

Replace it with:
```jsx
<div className="fpage-actions">
  <button className="fpage-cancel-btn" onClick={() => setSelected(null)}>Cancel</button>
  <button className="fpage-add-btn" onClick={handleAdd}>{t('nu.add_to_today')}</button>
</div>
```

- [ ] **Step 2: Add styles in `src/pages/FoodSearchPage.css`**

Append to the bottom of the file:

```css
.fpage-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.fpage-cancel-btn {
  flex: 0 0 auto;
  padding: 12px 18px;
  border-radius: 10px;
  border: 1px solid rgba(255, 80, 80, 0.3);
  background: rgba(255, 80, 80, 0.08);
  color: #ff5c5c;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.fpage-cancel-btn:hover { background: rgba(255, 80, 80, 0.18); }
.fpage-actions .fpage-add-btn { flex: 1 1 auto; }
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/FoodSearchPage.jsx src/pages/FoodSearchPage.css
git commit -m "feat(food-search): cancel button on portion picker"
```

---

## Task 6: Bigger / red delete on custom food rows

**Files:**
- Modify: `src/components/FoodSearch.css`

- [ ] **Step 1: Locate the existing rules**

Run: `grep -n "fcf-row-btn--delete\|fcf-row-btn " src/components/FoodSearch.css`

- [ ] **Step 2: Update the modifier**

Append at the bottom of the file (overriding the existing styles):

```css
.fcf-row-btn--delete {
  min-width: 36px;
  min-height: 36px;
  color: #ff5c5c;
  border: 1px solid rgba(255, 80, 80, 0.3);
  background: rgba(255, 80, 80, 0.08);
  border-radius: 8px;
  font-size: 16px;
}
.fcf-row-btn--delete:hover { background: rgba(255, 80, 80, 0.18); }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/FoodSearch.css
git commit -m "style(food-search): clearer delete button on custom food rows"
```

---

## Task 7: Register `big_three_logs` as a synced key

**Files:**
- Modify: `src/components/AuthGuard.jsx`
- Modify: `src/lib/sync.js`
- Modify: `src/hooks/useStorage.js`

- [ ] **Step 1: Add to `SYNC_KEYS` in `src/components/AuthGuard.jsx`**

Find the constant:
```jsx
const SYNC_KEYS = [
  'workout_logs', 'nutrition_logs', 'body_weight_logs',
  'meals', 'targets', 'profile', 'exercises', 'custom_foods',
]
```

Replace with:
```jsx
const SYNC_KEYS = [
  'workout_logs', 'nutrition_logs', 'body_weight_logs',
  'meals', 'targets', 'profile', 'exercises', 'custom_foods',
  'big_three_logs',
]
```

- [ ] **Step 2: Add to `MIGRATABLE_KEYS` in `src/lib/sync.js`**

Find:
```js
const MIGRATABLE_KEYS = new Set([
  'workout_logs', 'nutrition_logs', 'body_weight_logs',
  'meals', 'targets', 'profile', 'exercises', 'custom_foods',
])
```

Replace with:
```js
const MIGRATABLE_KEYS = new Set([
  'workout_logs', 'nutrition_logs', 'body_weight_logs',
  'meals', 'targets', 'profile', 'exercises', 'custom_foods',
  'big_three_logs',
])
```

- [ ] **Step 3: Add to `DATA_KEYS` in `src/hooks/useStorage.js`**

Find:
```js
const DATA_KEYS = ['workout_logs', 'nutrition_logs', 'body_weight_logs', 'meals', 'targets', 'profile', 'exercises', 'custom_foods']
```

Replace with:
```js
const DATA_KEYS = ['workout_logs', 'nutrition_logs', 'body_weight_logs', 'meals', 'targets', 'profile', 'exercises', 'custom_foods', 'big_three_logs']
```

- [ ] **Step 4: Verify tests pass**

Run: `npm run test:run`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/AuthGuard.jsx src/lib/sync.js src/hooks/useStorage.js
git commit -m "feat(sync): register big_three_logs as a synced key"
```

---

## Task 8: BigThreeCard component (TDD)

**Files:**
- Create: `src/components/BigThreeCard.jsx`
- Create: `src/components/BigThreeCard.css`
- Create: `tests/components/BigThreeCard.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/BigThreeCard.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BigThreeCard from '../../src/components/BigThreeCard'

beforeEach(() => { vi.clearAllMocks() })

describe('BigThreeCard', () => {
  it('renders the lift title', () => {
    render(<BigThreeCard lift="squat" title="Squat" entries={[]} onAdd={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('Squat')).toBeInTheDocument()
  })

  it('shows the empty state when there are no entries for this lift', () => {
    render(<BigThreeCard lift="squat" title="Squat" entries={[]} onAdd={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/no entries yet/i)).toBeInTheDocument()
  })

  it('shows latest entry summary when entries exist', () => {
    const entries = [
      { id: 'a', lift: 'squat', date: '2026-06-04', weight: 120, reps: 5 },
      { id: 'b', lift: 'squat', date: '2026-06-01', weight: 115, reps: 5 },
    ]
    render(<BigThreeCard lift="squat" title="Squat" entries={entries} onAdd={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/120 kg × 5/i)).toBeInTheDocument()
    expect(screen.getByText(/2026-06-04/)).toBeInTheDocument()
  })

  it('only renders entries matching its lift', () => {
    const entries = [
      { id: 'a', lift: 'squat', date: '2026-06-04', weight: 120, reps: 5 },
      { id: 'b', lift: 'bench', date: '2026-06-04', weight: 80, reps: 5 },
    ]
    render(<BigThreeCard lift="squat" title="Squat" entries={entries} onAdd={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/120 kg × 5/i)).toBeInTheDocument()
    expect(screen.queryByText(/80 kg × 5/i)).not.toBeInTheDocument()
  })

  it('calls onAdd with a new entry when the add form is submitted', () => {
    const onAdd = vi.fn()
    render(<BigThreeCard lift="bench" title="Bench" entries={[]} onAdd={onAdd} onDelete={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    fireEvent.change(screen.getByPlaceholderText(/weight/i), { target: { value: '100' } })
    fireEvent.change(screen.getByPlaceholderText(/reps/i), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onAdd).toHaveBeenCalledTimes(1)
    const arg = onAdd.mock.calls[0][0]
    expect(arg.lift).toBe('bench')
    expect(arg.weight).toBe(100)
    expect(arg.reps).toBe(5)
    expect(arg.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('calls onDelete with entry id when delete is clicked', () => {
    const onDelete = vi.fn()
    const entries = [{ id: 'a', lift: 'squat', date: '2026-06-04', weight: 120, reps: 5 }]
    render(<BigThreeCard lift="squat" title="Squat" entries={entries} onAdd={() => {}} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledWith('a')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm run test:run -- tests/components/BigThreeCard.test.jsx`
Expected: FAIL with "Cannot find module '../../src/components/BigThreeCard'".

- [ ] **Step 3: Implement the component**

Create `src/components/BigThreeCard.jsx`:

```jsx
import { useState } from 'react'
import { toLocalDateStr } from '../utils/dateHelpers'
import './BigThreeCard.css'

const VISIBLE_LIMIT = 5

function generateId() {
  return `big3_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function BigThreeCard({ lift, title, entries, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [date, setDate] = useState(() => toLocalDateStr(new Date()))
  const [showAll, setShowAll] = useState(false)

  const mine = entries
    .filter(e => e.lift === lift)
    .sort((a, b) => b.date.localeCompare(a.date))
  const latest = mine[0] ?? null
  const visible = showAll ? mine : mine.slice(0, VISIBLE_LIMIT)

  function startAdd() {
    setWeight('')
    setReps('')
    setDate(toLocalDateStr(new Date()))
    setAdding(true)
  }

  function cancelAdd() { setAdding(false) }

  function saveEntry() {
    const w = parseFloat(weight)
    const r = parseInt(reps)
    if (!(w > 0) || !(r >= 1 && r <= 30) || !date) return
    onAdd({ id: generateId(), lift, date, weight: w, reps: r })
    setAdding(false)
  }

  return (
    <div className="b3-card card">
      <div className="b3-header">
        <h3 className="b3-title">{title}</h3>
        {!adding && (
          <button className="b3-add-btn" onClick={startAdd}>+ Add</button>
        )}
      </div>

      {latest ? (
        <div className="b3-latest">
          Latest: {latest.weight} kg × {latest.reps} · {latest.date}
        </div>
      ) : (
        <div className="b3-empty">No entries yet — tap + Add to start tracking.</div>
      )}

      {adding && (
        <div className="b3-add-form">
          <input className="b3-input" type="number" inputMode="decimal" placeholder="Weight kg"
            value={weight} onChange={e => setWeight(e.target.value)} />
          <input className="b3-input" type="number" inputMode="numeric" placeholder="Reps"
            min="1" max="30"
            value={reps} onChange={e => setReps(e.target.value)} />
          <input className="b3-input" type="date"
            value={date} onChange={e => setDate(e.target.value)} />
          <div className="b3-form-actions">
            <button className="b3-cancel-btn" onClick={cancelAdd}>Cancel</button>
            <button className="b3-save-btn" onClick={saveEntry}>Save</button>
          </div>
        </div>
      )}

      {visible.length > 0 && (
        <div className="b3-list">
          {visible.map(e => (
            <div key={e.id} className="b3-row">
              <span className="b3-row-text">{e.weight} kg × {e.reps} · {e.date.slice(5)}</span>
              <button className="b3-del-btn" aria-label="Delete" onClick={() => onDelete(e.id)}>🗑</button>
            </div>
          ))}
        </div>
      )}

      {mine.length > VISIBLE_LIMIT && !showAll && (
        <button className="b3-more-btn" onClick={() => setShowAll(true)}>
          Show all {mine.length} entries
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add styles**

Create `src/components/BigThreeCard.css`:

```css
.b3-card { padding: 16px; }
.b3-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.b3-title { margin: 0; font-size: 16px; font-weight: 700; }
.b3-add-btn {
  padding: 8px 14px;
  border-radius: 10px;
  border: 0;
  background: var(--accent, #5ee2c4);
  color: #0a0a0a;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.b3-latest { font-size: 14px; opacity: 0.85; margin-bottom: 8px; }
.b3-empty { font-size: 13px; opacity: 0.6; margin-bottom: 8px; }

.b3-add-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 12px;
  background: rgba(255,255,255,0.03);
  border-radius: 10px;
  margin: 8px 0;
}
.b3-input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 10px;
  color: inherit;
  font-size: 14px;
}
.b3-input[type="date"] { grid-column: 1 / -1; }
.b3-form-actions { grid-column: 1 / -1; display: flex; gap: 8px; }
.b3-cancel-btn, .b3-save-btn { flex: 1; padding: 10px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.b3-cancel-btn { background: transparent; color: inherit; border: 1px solid rgba(255,255,255,0.15); }
.b3-save-btn { background: var(--accent, #5ee2c4); color: #0a0a0a; border: 0; }

.b3-list { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.b3-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 8px; background: rgba(255,255,255,0.03); }
.b3-row-text { font-size: 14px; }
.b3-del-btn {
  min-width: 32px; min-height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255, 80, 80, 0.3);
  background: rgba(255, 80, 80, 0.08);
  color: #ff5c5c;
  cursor: pointer;
  font-size: 14px;
}

.b3-more-btn {
  margin-top: 8px;
  background: transparent;
  color: var(--accent, #5ee2c4);
  border: 0;
  font-size: 13px;
  cursor: pointer;
}
```

- [ ] **Step 5: Run tests**

Run: `npm run test:run -- tests/components/BigThreeCard.test.jsx`
Expected: 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/BigThreeCard.jsx src/components/BigThreeCard.css tests/components/BigThreeCard.test.jsx
git commit -m "feat(progress): BigThreeCard component"
```

---

## Task 9: BodyWeightCalendar component (TDD)

**Files:**
- Create: `src/components/BodyWeightCalendar.jsx`
- Create: `src/components/BodyWeightCalendar.css`
- Create: `tests/components/BodyWeightCalendar.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/BodyWeightCalendar.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BodyWeightCalendar from '../../src/components/BodyWeightCalendar'

const logs = [
  { date: '2026-06-04', weight: 73.4 },
  { date: '2026-06-05', weight: 73.2 },
  { date: '2026-06-07', weight: 72.9 },
]

describe('BodyWeightCalendar', () => {
  it('renders the month/year header for the initial month', () => {
    render(<BodyWeightCalendar logs={logs} initialMonth="2026-06" onSave={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/june 2026/i)).toBeInTheDocument()
  })

  it('renders weights in cells for logged days', () => {
    render(<BodyWeightCalendar logs={logs} initialMonth="2026-06" onSave={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('73.4')).toBeInTheDocument()
    expect(screen.getByText('73.2')).toBeInTheDocument()
    expect(screen.getByText('72.9')).toBeInTheDocument()
  })

  it('navigates to next and previous months', () => {
    render(<BodyWeightCalendar logs={logs} initialMonth="2026-06" onSave={() => {}} onDelete={() => {}} />)
    fireEvent.click(screen.getByLabelText(/next month/i))
    expect(screen.getByText(/july 2026/i)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/previous month/i))
    fireEvent.click(screen.getByLabelText(/previous month/i))
    expect(screen.getByText(/may 2026/i)).toBeInTheDocument()
  })

  it('opens an editor when a logged day is tapped, pre-filled with that weight', () => {
    render(<BodyWeightCalendar logs={logs} initialMonth="2026-06" onSave={() => {}} onDelete={() => {}} />)
    fireEvent.click(screen.getByText('73.4'))
    const input = screen.getByDisplayValue('73.4')
    expect(input).toBeInTheDocument()
  })

  it('calls onSave with the date and new weight when save is clicked', () => {
    const onSave = vi.fn()
    render(<BodyWeightCalendar logs={logs} initialMonth="2026-06" onSave={onSave} onDelete={() => {}} />)
    fireEvent.click(screen.getByText('73.4'))
    const input = screen.getByDisplayValue('73.4')
    fireEvent.change(input, { target: { value: '73.0' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith('2026-06-04', 73)
  })

  it('calls onDelete with the date when delete is clicked on a logged day editor', () => {
    const onDelete = vi.fn()
    render(<BodyWeightCalendar logs={logs} initialMonth="2026-06" onSave={() => {}} onDelete={onDelete} />)
    fireEvent.click(screen.getByText('73.4'))
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledWith('2026-06-04')
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `npm run test:run -- tests/components/BodyWeightCalendar.test.jsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the component**

Create `src/components/BodyWeightCalendar.jsx`:

```jsx
import { useState } from 'react'
import './BodyWeightCalendar.css'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['S','M','T','W','T','F','S']

function parseMonth(str) {
  // 'YYYY-MM' → { year, month0 } (month0 is 0-indexed)
  const [y, m] = str.split('-').map(Number)
  return { year: y, month0: m - 1 }
}

function formatMonth(year, month0) {
  return `${year}-${String(month0 + 1).padStart(2, '0')}`
}

function buildMonthGrid(year, month0) {
  // Returns array of { date: 'YYYY-MM-DD' | null, day: number | null }
  const first = new Date(year, month0, 1)
  const last = new Date(year, month0 + 1, 0)
  const startWeekday = first.getDay() // 0..6
  const daysInMonth = last.getDate()
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null, day: null })
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ date: dateStr, day: d })
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null })
  return cells
}

export default function BodyWeightCalendar({ logs, initialMonth, onSave, onDelete }) {
  const start = initialMonth ?? formatMonth(new Date().getFullYear(), new Date().getMonth())
  const [{ year, month0 }, setView] = useState(() => parseMonth(start))
  const [editingDate, setEditingDate] = useState(null)
  const [draft, setDraft] = useState('')

  const byDate = new Map(logs.map(l => [l.date, l.weight]))
  const cells = buildMonthGrid(year, month0)

  function go(delta) {
    let m = month0 + delta
    let y = year
    while (m < 0) { m += 12; y-- }
    while (m > 11) { m -= 12; y++ }
    setView({ year: y, month0: m })
    setEditingDate(null)
  }

  function openCell(dateStr) {
    setEditingDate(dateStr)
    setDraft(byDate.has(dateStr) ? String(byDate.get(dateStr)) : '')
  }

  function save() {
    const w = parseFloat(draft)
    if (!(w > 0)) return
    onSave(editingDate, w)
    setEditingDate(null)
  }

  function del() {
    onDelete(editingDate)
    setEditingDate(null)
  }

  return (
    <div className="bw-cal">
      <div className="bw-cal-header">
        <button className="bw-cal-nav" aria-label="Previous month" onClick={() => go(-1)}>‹</button>
        <span className="bw-cal-title">{MONTHS[month0]} {year}</span>
        <button className="bw-cal-nav" aria-label="Next month" onClick={() => go(1)}>›</button>
      </div>
      <div className="bw-cal-day-labels">
        {DAY_LABELS.map((l, i) => <div key={i} className="bw-cal-day-label">{l}</div>)}
      </div>
      <div className="bw-cal-grid">
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} className="bw-cal-cell bw-cal-cell--empty" />
          const w = byDate.get(c.date)
          return (
            <button
              key={c.date}
              className={`bw-cal-cell${w != null ? ' bw-cal-cell--logged' : ''}`}
              onClick={() => openCell(c.date)}
            >
              <span className="bw-cal-cell-day">{c.day}</span>
              {w != null && <span className="bw-cal-cell-w">{w}</span>}
            </button>
          )
        })}
      </div>

      {editingDate && (
        <div className="bw-cal-editor">
          <div className="bw-cal-editor-date">{editingDate}</div>
          <input
            className="bw-cal-editor-input"
            type="number"
            inputMode="decimal"
            placeholder="kg"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
          />
          <div className="bw-cal-editor-actions">
            <button className="bw-cal-cancel" onClick={() => setEditingDate(null)}>Cancel</button>
            {byDate.has(editingDate) && (
              <button className="bw-cal-delete" onClick={del}>Delete</button>
            )}
            <button className="bw-cal-save" onClick={save}>Save</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add styles**

Create `src/components/BodyWeightCalendar.css`:

```css
.bw-cal { background: rgba(255,255,255,0.02); border-radius: 10px; padding: 12px; margin-top: 12px; }

.bw-cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.bw-cal-title { font-size: 14px; font-weight: 700; }
.bw-cal-nav {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.15);
  color: inherit;
  width: 32px; height: 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
}

.bw-cal-day-labels { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 4px; }
.bw-cal-day-label { text-align: center; font-size: 11px; opacity: 0.5; padding: 2px 0; }

.bw-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }

.bw-cal-cell {
  aspect-ratio: 1 / 1;
  background: rgba(255,255,255,0.03);
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
}
.bw-cal-cell--empty { background: transparent; border: 0; cursor: default; }
.bw-cal-cell--logged { background: rgba(94, 226, 196, 0.08); border-color: rgba(94, 226, 196, 0.3); }

.bw-cal-cell-day { font-size: 11px; opacity: 0.7; }
.bw-cal-cell-w { font-size: 12px; font-weight: 700; color: var(--accent, #5ee2c4); }

.bw-cal-editor {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
}
.bw-cal-editor-date { font-size: 13px; opacity: 0.7; margin-bottom: 6px; }
.bw-cal-editor-input {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 10px;
  color: inherit;
  font-size: 14px;
  margin-bottom: 8px;
}
.bw-cal-editor-actions { display: flex; gap: 8px; }
.bw-cal-editor-actions button {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.bw-cal-cancel { background: transparent; color: inherit; border: 1px solid rgba(255,255,255,0.15); }
.bw-cal-delete { background: rgba(255, 80, 80, 0.12); color: #ff5c5c; border: 1px solid rgba(255, 80, 80, 0.3); }
.bw-cal-save { background: var(--accent, #5ee2c4); color: #0a0a0a; border: 0; }
```

- [ ] **Step 5: Run tests**

Run: `npm run test:run -- tests/components/BodyWeightCalendar.test.jsx`
Expected: 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/BodyWeightCalendar.jsx src/components/BodyWeightCalendar.css tests/components/BodyWeightCalendar.test.jsx
git commit -m "feat(progress): BodyWeightCalendar component"
```

---

## Task 10: Progress page rewrite

**Files:**
- Modify: `src/pages/Progress.jsx`
- Modify: `src/pages/Progress.css`

- [ ] **Step 1: Replace `src/pages/Progress.jsx` with the new implementation**

Overwrite the file with:

```jsx
import { useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { toLocalDateStr } from '../utils/dateHelpers'
import { useLanguage } from '../context/LanguageContext'
import BodyWeightCalendar from '../components/BodyWeightCalendar'
import BigThreeCard from '../components/BigThreeCard'
import './Progress.css'

const ORM_PCTS = [100, 95, 90, 85, 80, 75, 70, 65, 60]
const DISCLOSURE_KEY = 'bw_calendar_open'

const BIG_THREE = [
  { lift: 'squat',    title: 'Squat' },
  { lift: 'bench',    title: 'Bench Press' },
  { lift: 'deadlift', title: 'Deadlift' },
]

export default function Progress() {
  const { t } = useLanguage()
  const [bodyWeightLogs, setBodyWeightLogs] = useStorage('body_weight_logs', [])
  const [bigThreeLogs, setBigThreeLogs] = useStorage('big_three_logs', [])
  const [newWeight, setNewWeight] = useState('')
  const [ormWeight, setOrmWeight] = useState('')
  const [ormReps, setOrmReps] = useState('')
  const [calOpen, setCalOpen] = useState(() => {
    try { return localStorage.getItem(DISCLOSURE_KEY) === '1' } catch { return false }
  })

  function toggleCal() {
    setCalOpen(prev => {
      const next = !prev
      try { localStorage.setItem(DISCLOSURE_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }

  function logBodyWeight() {
    const w = parseFloat(newWeight)
    if (!(w > 30 && w < 300)) return
    const todayStr = toLocalDateStr(new Date())
    setBodyWeightLogs(prev => [...prev.filter(l => l.date !== todayStr), { date: todayStr, weight: w }])
    setNewWeight('')
  }

  function saveBodyWeight(date, weight) {
    setBodyWeightLogs(prev => [...prev.filter(l => l.date !== date), { date, weight }])
  }

  function deleteBodyWeight(date) {
    setBodyWeightLogs(prev => prev.filter(l => l.date !== date))
  }

  function addBigThree(entry) {
    setBigThreeLogs(prev => [entry, ...prev])
  }

  function deleteBigThree(id) {
    setBigThreeLogs(prev => prev.filter(e => e.id !== id))
  }

  const wNum = parseFloat(ormWeight)
  const rNum = parseInt(ormReps)
  const oneRM = wNum > 0 && rNum >= 1 && rNum <= 30 ? Math.round(wNum * (1 + rNum / 30)) : null

  return (
    <div className="page progress-page">
      <h1 className="progress-title">{t('pr.title')}</h1>

      {/* Body weight */}
      <div className="card">
        <div className="bw-log-row">
          <input className="bw-input" type="number" inputMode="decimal"
            placeholder="kg" value={newWeight}
            onChange={e => setNewWeight(e.target.value)} />
          <button className="bw-btn" onClick={logBodyWeight}>Log</button>
        </div>

        <button className="bw-disclosure" onClick={toggleCal} aria-expanded={calOpen}>
          <span className="bw-disclosure-arrow">{calOpen ? '▾' : '▸'}</span>
          <span>Present Body Weight</span>
        </button>

        {calOpen && (
          <BodyWeightCalendar
            logs={bodyWeightLogs}
            onSave={saveBodyWeight}
            onDelete={deleteBodyWeight}
          />
        )}
      </div>

      {/* Big three */}
      {BIG_THREE.map(({ lift, title }) => (
        <BigThreeCard
          key={lift}
          lift={lift}
          title={title}
          entries={bigThreeLogs}
          onAdd={addBigThree}
          onDelete={deleteBigThree}
        />
      ))}

      {/* 1RM estimator */}
      <p className="section-title">{t('pr.one_rm')}</p>
      <div className="card">
        <div className="orm-inputs">
          <div className="orm-field">
            <label className="orm-label">{t('pr.one_rm_weight')}</label>
            <input className="bw-input" type="number" inputMode="decimal" placeholder="kg"
              value={ormWeight} onChange={e => setOrmWeight(e.target.value)} />
          </div>
          <div className="orm-field orm-field--reps">
            <label className="orm-label">{t('pr.one_rm_reps')}</label>
            <input className="bw-input" type="number" inputMode="numeric" placeholder="reps"
              min="1" max="30"
              value={ormReps} onChange={e => setOrmReps(e.target.value)} />
          </div>
        </div>
        {oneRM ? (
          <div className="orm-result">
            <div className="orm-result-header">
              <span className="orm-result-label">{t('pr.one_rm_result')}</span>
              <span className="orm-result-val">{oneRM} kg</span>
            </div>
            <div className="orm-pct-table">
              {ORM_PCTS.map(pct => (
                <div key={pct} className="orm-pct-row">
                  <span className="orm-pct">{pct}%</span>
                  <span className="orm-pct-val">{Math.round(oneRM * pct / 100)} kg</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="progress-empty">{t('pr.one_rm_hint')}</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Trim `src/pages/Progress.css`**

Replace the entire contents of `src/pages/Progress.css` with the styles still in use plus the new disclosure styles:

```css
.progress-page { padding-bottom: 100px; }

.progress-title { font-size: 22px; font-weight: 900; margin: 16px 0; }
.progress-empty { opacity: 0.6; font-size: 14px; text-align: center; padding: 12px 0; }

.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  opacity: 0.7;
  margin: 18px 0 8px;
}

/* Body weight log row */
.bw-log-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.bw-input {
  flex: 1;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 10px 12px;
  color: inherit;
  font-size: 14px;
}
.bw-btn {
  padding: 10px 18px;
  background: var(--accent, #5ee2c4);
  color: #0a0a0a;
  border: 0;
  border-radius: 8px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}

.bw-disclosure {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 0;
  color: var(--accent, #5ee2c4);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 0;
  cursor: pointer;
}
.bw-disclosure-arrow { font-size: 16px; }

/* 1RM */
.orm-inputs { display: flex; gap: 8px; }
.orm-field { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.orm-field--reps { flex: 0 0 90px; }
.orm-label { font-size: 11px; opacity: 0.7; }

.orm-result { margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.04); border-radius: 10px; }
.orm-result-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.orm-result-label { font-size: 13px; opacity: 0.8; }
.orm-result-val { font-size: 20px; font-weight: 700; color: var(--accent, #5ee2c4); }
.orm-pct-table { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
.orm-pct-row { display: flex; justify-content: space-between; padding: 6px 8px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 12px; }
.orm-pct { opacity: 0.7; }
.orm-pct-val { font-weight: 700; }
```

- [ ] **Step 3: Run the full test suite**

Run: `npm run test:run`
Expected: all tests pass.

- [ ] **Step 4: Sanity check the build**

Run: `npm run build`
Expected: build succeeds. The `recharts` import is no longer used by Progress, but is still pulled in by package.json — that's fine; cleanup is out of scope here.

- [ ] **Step 5: Run dev server and click through Progress**

Run: `npm run dev`
- Open `/progress`. Expect: title, Body Weight card, three big-three cards, 1RM estimator.
- Log a body weight. Expect it to appear when you open the calendar.
- Toggle the disclosure arrow. Refresh page. Expect the toggle state to persist.
- Add a Squat entry. Reload. Expect it to persist.
- Delete the entry. Reload. Expect it to be gone.
- Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Progress.jsx src/pages/Progress.css
git commit -m "feat(progress): rewrite around body-weight calendar and big-three"
```

---

## Task 11: Final manual verification

**Files:** none

- [ ] **Step 1: Run lint + tests + build**

```bash
npm run lint
npm run test:run
npm run build
```
Expected: zero errors, all tests pass, build succeeds.

- [ ] **Step 2: Run the dev server and verify each spec success criterion**

Run: `npm run dev`. In the browser, walk through:

- [ ] Nutrition page on a fresh account: the "Meal plan" section header shows but no template meals appear; only the **+ Add meal** button is visible.
- [ ] Add a food via Search → portion picker shows both **Cancel** and **Add to today** buttons. Cancel returns to the search list without adding.
- [ ] Custom food rows in search: the 🗑 button is visibly red.
- [ ] After adding a food via Search, the quick-log row's 🗑 is clearly red and easy to tap.
- [ ] DateStrip: log a workout for one date, log a meal/quick-log for a different date — both days show a dot.
- [ ] Settings page: there is no 🔔 Notifications section. Reloading the page does not log errors. `localStorage.getItem('motaz_notifications')` returns `null`.
- [ ] Progress page:
  - [ ] Renders without errors.
  - [ ] Body Weight card: log a weight → toggle the calendar open → see the weight in today's cell. Tap the cell → input pre-fills → Save changes the weight; Delete removes it.
  - [ ] Toggle the disclosure closed, reload — stays closed. Open it again, reload — stays open.
  - [ ] Big-three: Add a Squat entry → it shows in the latest summary and history. Reload → still there. Delete it → gone.
  - [ ] Big-three: only entries matching that lift appear in each card.
  - [ ] 1RM estimator works as before.
- [ ] Cross-device sync: log a big-three entry, then open the app in an incognito window logged into the same account — the entry appears.

- [ ] **Step 3: Stop the dev server**

Ctrl+C in the terminal running it.

> No commit for this task — verification only.

---

## Self-review notes

**Spec coverage:**
- Feature 1 (3 delete spots) → Tasks 4, 5, 6
- Feature 2 (empty meal plan) → Task 1
- Feature 3 (Progress rewrite) → Tasks 7, 8, 9, 10
- Feature 4 (remove notifications) → Task 3
- Feature 5 (DateStrip dot) → Task 2
- Sync key registration → Task 7
- Final verification → Task 11

**Names used consistently:** `big_three_logs` (storage key), `BIG_THREE` (component map), `BigThreeCard` (component), `BodyWeightCalendar` (component), `bw_calendar_open` (disclosure persistence key), `MIGRATABLE_KEYS` / `SYNC_KEYS` / `DATA_KEYS` (existing keys touched).

**Trade-offs flagged:**
- `recharts` stays in `package.json` even though Progress no longer uses it. Removing the dep is out of scope; can be done later if no other page picks it up.
- New copy ("Body Weight", "Present Body Weight", "+ Add", "Save", "Cancel", "Log") is hardcoded in English rather than going through `t()`. If you later want Arabic, those become small translation entries — not worth blocking this work on.
