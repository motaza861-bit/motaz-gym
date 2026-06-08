# Settings Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace IronMind's Settings page Data section with a Profile card (single source for profile fields), a kg ↔ lbs display-only unit preference, a Change Password card inside Account, and a static About card at the bottom.

**Architecture:** A new `src/utils/units.js` exposes pure conversion helpers; a `useWeightUnit` hook reads the unit pref from the synced `profile` storage; Progress, BigThreeCard, and BodyWeightCalendar use those helpers for display and parse-on-save. Settings becomes a sequence of cards: Appearance, Profile (which owns the weight/height/age/gender/activity/goal data the macro calc previously duplicated), Training, Nutrition (macro calc stays but reads from Profile), Account (with new Change Password card), About.

**Tech Stack:** React 19, react-router-dom 7, `@supabase/supabase-js` (for password update + current-password verification), Vitest.

**Source spec:** `docs/superpowers/specs/2026-06-09-settings-overhaul-design.md`

---

## File map

### Added
- `src/utils/units.js` — pure helpers: `kgToDisplay`, `displayToKg`, `unitLabel`
- `src/hooks/useWeightUnit.js` — one-liner reading `profile.weightUnit`
- `src/components/AboutCard.jsx` (uses Settings.css)
- `src/components/ProfileCard.jsx` (uses Settings.css)
- `src/components/ChangePasswordForm.jsx` (uses Settings.css)
- `tests/utils/units.test.js`

### Modified
- `vite.config.js` — `define` block for `__APP_VERSION__`
- `src/pages/Settings.jsx` — large restructure
- `src/pages/Settings.css` — small additions for new cards
- `src/i18n/translations.js` — drop legacy data keys, add new keys
- `src/pages/Progress.jsx` — units integration
- `src/components/BigThreeCard.jsx` — units integration
- `src/components/BodyWeightCalendar.jsx` — units integration
- `tests/components/BigThreeCard.test.jsx` — kg defaults pass through unchanged; no test rewrite needed
- `tests/components/BodyWeightCalendar.test.jsx` — same

### Unchanged
- `src/hooks/useStorage.js` — `exportAllData`/`importAllData` kept (no UI surface)
- Supabase schema

---

## Task 1: Remove Data section from Settings

**Files:**
- Modify: `src/pages/Settings.jsx`
- Modify: `src/i18n/translations.js`

- [ ] **Step 1: Delete the JSX block**

In `src/pages/Settings.jsx`, find the section starting with the `data` ref and the 💾 Data icon, e.g. `<div ref={sectionRefs.data}>` … `</div>`. Delete the entire block (the section header AND the inner export + import + status rows).

- [ ] **Step 2: Delete related state, handler, and refs**

In the same file remove:
- `const [importStatus, setImportStatus] = useState(null)`
- `const timerRef = useRef(null)`
- The `useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])` cleanup
- The entire `async function handleImport(e) { … }`
- The `data` entry from `TILES` array
- The `data:` line from `sectionRefs` object

- [ ] **Step 3: Drop imports no longer used**

Remove from the top of `Settings.jsx`:
```jsx
import { exportAllData, importAllData } from '../hooks/useStorage'
```
(Other `useStorage` imports stay.)

- [ ] **Step 4: Drop translation keys**

Run:
```
grep -n "st\.data\|st\.export\|st\.import" src/i18n/translations.js
```
Delete every matching line from BOTH the English and Arabic language objects:
- `st.data`, `st.data_sub`
- `st.export`, `st.export_label`, `st.export_sub`
- `st.import`, `st.import_label`, `st.import_sub`, `st.import_success`, `st.import_error`

- [ ] **Step 5: Verify**

```
npm run test:run
npm run build
```
Expected: 94 tests pass; build succeeds.

- [ ] **Step 6: Commit**

```
git add src/pages/Settings.jsx src/i18n/translations.js
git commit -m "refactor(settings): remove Data import/export section"
```

---

## Task 2: Define `__APP_VERSION__` build constant

**Files:**
- Modify: `vite.config.js`

- [ ] **Step 1: Edit `vite.config.js`**

Replace the file's contents with:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'icon-192.png', 'icon-512.png'],
      manifest: false,
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js',
    exclude: ['node_modules', 'dist', '.git', '.idea', '.cache', '.claude/**', '.worktrees/**'],
  },
})
```

The change: add `pkg` import and the `define` block. Everything else is unchanged.

- [ ] **Step 2: Verify**

```
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```
git add vite.config.js
git commit -m "chore: expose package.json version as __APP_VERSION__ build constant"
```

---

## Task 3: Units helper module with tests

**Files:**
- Create: `src/utils/units.js`
- Create: `tests/utils/units.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/utils/units.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { kgToDisplay, displayToKg, unitLabel } from '../../src/utils/units.js'

describe('kgToDisplay', () => {
  it('rounds kg to 1 decimal when unit is kg', () => {
    expect(kgToDisplay(75, 'kg')).toBe(75)
    expect(kgToDisplay(75.45, 'kg')).toBe(75.5)
  })

  it('converts kg to lbs and rounds to 1 decimal when unit is lbs', () => {
    expect(kgToDisplay(100, 'lbs')).toBe(220.5)
    expect(kgToDisplay(1, 'lbs')).toBe(2.2)
  })

  it('returns empty string for nullish input', () => {
    expect(kgToDisplay(null, 'kg')).toBe('')
    expect(kgToDisplay(undefined, 'lbs')).toBe('')
  })
})

describe('displayToKg', () => {
  it('passes through positive kg input', () => {
    expect(displayToKg('75', 'kg')).toBe(75)
    expect(displayToKg('75.5', 'kg')).toBe(75.5)
  })

  it('converts lbs input back to kg', () => {
    const result = displayToKg('220.5', 'lbs')
    expect(result).toBeCloseTo(100, 1)
  })

  it('returns null for non-positive or invalid input', () => {
    expect(displayToKg('', 'kg')).toBeNull()
    expect(displayToKg('0', 'kg')).toBeNull()
    expect(displayToKg('-5', 'kg')).toBeNull()
    expect(displayToKg('abc', 'lbs')).toBeNull()
  })

  it('round-trips kg → lbs → kg within rounding tolerance', () => {
    const original = 82.5
    const displayed = kgToDisplay(original, 'lbs')
    const back = displayToKg(String(displayed), 'lbs')
    expect(back).toBeCloseTo(original, 1)
  })
})

describe('unitLabel', () => {
  it('returns "lbs" for lbs', () => {
    expect(unitLabel('lbs')).toBe('lbs')
  })
  it('returns "kg" for kg or anything else', () => {
    expect(unitLabel('kg')).toBe('kg')
    expect(unitLabel(undefined)).toBe('kg')
    expect(unitLabel('foo')).toBe('kg')
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

```
npm run test:run -- tests/utils/units.test.js
```
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Create `src/utils/units.js`**

```js
const LBS_PER_KG = 2.20462

export function kgToDisplay(kg, unit) {
  if (kg == null) return ''
  if (unit === 'lbs') return Math.round(kg * LBS_PER_KG * 10) / 10
  return Math.round(kg * 10) / 10
}

export function displayToKg(value, unit) {
  const n = parseFloat(value)
  if (!isFinite(n) || n <= 0) return null
  return unit === 'lbs' ? n / LBS_PER_KG : n
}

export function unitLabel(unit) {
  return unit === 'lbs' ? 'lbs' : 'kg'
}
```

- [ ] **Step 4: Run tests to confirm pass**

```
npm run test:run -- tests/utils/units.test.js
```
Expected: 10 tests PASS.

- [ ] **Step 5: Run full suite**

```
npm run test:run
```
Expected: 104 tests pass (94 prior + 10 new).

- [ ] **Step 6: Commit**

```
git add src/utils/units.js tests/utils/units.test.js
git commit -m "feat(units): kg ↔ lbs display helpers"
```

---

## Task 4: `useWeightUnit` hook

**Files:**
- Create: `src/hooks/useWeightUnit.js`

- [ ] **Step 1: Write the hook**

```js
import { useStorage } from './useStorage'

const EMPTY = {}

export function useWeightUnit() {
  const [profile] = useStorage('profile', EMPTY)
  return profile?.weightUnit ?? 'kg'
}
```

- [ ] **Step 2: Verify**

```
npm run test:run
```
Expected: 104 tests pass (no new tests; the hook is one line that delegates to a tested hook).

- [ ] **Step 3: Commit**

```
git add src/hooks/useWeightUnit.js
git commit -m "feat(hooks): useWeightUnit reads profile.weightUnit with kg fallback"
```

---

## Task 5: Wire units into `Progress.jsx`

**Files:**
- Modify: `src/pages/Progress.jsx`

- [ ] **Step 1: Add imports**

At the top of `src/pages/Progress.jsx`, alongside existing imports, add:

```jsx
import { useWeightUnit } from '../hooks/useWeightUnit'
import { kgToDisplay, displayToKg, unitLabel } from '../utils/units'
```

- [ ] **Step 2: Read the unit pref inside the component**

Inside the `Progress` function, right after the existing `const { t } = useLanguage()` line, add:

```jsx
const unit = useWeightUnit()
const label = unitLabel(unit)
```

- [ ] **Step 3: Rewire the body-weight log input**

Find the body weight section that uses `bw-input` with placeholder `"kg"` and the `logBodyWeight` handler. Replace the handler:

```jsx
function logBodyWeight() {
  const kg = displayToKg(newWeight, unit)
  if (kg == null || kg < 30 || kg > 300) return
  const todayStr = toLocalDateStr(new Date())
  setBodyWeightLogs(prev => [...prev.filter(l => l.date !== todayStr), { date: todayStr, weight: kg }])
  setNewWeight('')
}
```
(Note: the body weight 30-300 sanity range is now applied on the kg value after conversion, not on the user-typed value.)

Change the input element to use `label` for placeholder:

```jsx
<input
  className="bw-input"
  type="number"
  inputMode="decimal"
  placeholder={label}
  value={newWeight}
  onChange={e => setNewWeight(e.target.value)}
/>
```

- [ ] **Step 4: Rewire the 1RM estimator inputs and outputs**

Inside the 1RM card, change the weight input to use `label`:

```jsx
<input className="bw-input" type="number" inputMode="decimal" placeholder={label}
  value={ormWeight} onChange={e => setOrmWeight(e.target.value)} />
```

Change the 1RM compute to interpret the user's typed value via `displayToKg`:

```jsx
const wKg = displayToKg(ormWeight, unit)
const rNum = parseInt(ormReps)
const oneRMKg = wKg && rNum >= 1 && rNum <= 30 ? Math.round(wKg * (1 + rNum / 30)) : null
const oneRM = oneRMKg != null ? kgToDisplay(oneRMKg, unit) : null
```

(Notice we keep the legacy `oneRM` name for the *display* value — that's what the JSX renders. The kg value is `oneRMKg`.)

Change the result row and percent rows to use `label`:

```jsx
<span className="orm-result-val">{oneRM} {label}</span>
```

and

```jsx
{ORM_PCTS.map(pct => (
  <div key={pct} className="orm-pct-row">
    <span className="orm-pct">{pct}%</span>
    <span className="orm-pct-val">{kgToDisplay(oneRMKg * pct / 100, unit)} {label}</span>
  </div>
))}
```

(Replace `Math.round(oneRM * pct / 100)` with the display helper.)

- [ ] **Step 5: Pass `unit` to BodyWeightCalendar**

Find the calendar render:
```jsx
<BodyWeightCalendar
  logs={bodyWeightLogs}
  onSave={saveBodyWeight}
  onDelete={deleteBodyWeight}
/>
```
Add the `unit` prop (BodyWeightCalendar accepts it after Task 7):
```jsx
<BodyWeightCalendar
  logs={bodyWeightLogs}
  unit={unit}
  onSave={saveBodyWeight}
  onDelete={deleteBodyWeight}
/>
```

Also update `saveBodyWeight` to convert the editor value back to kg. The current signature is `saveBodyWeight(date, weight)` where `weight` is what the editor returned. After Task 7, the editor returns kg directly (the calendar does the conversion internally) — so `saveBodyWeight` stays the same. NO change needed here in Progress.jsx (this note is for verification — leave the existing handler alone).

- [ ] **Step 6: Verify**

```
npm run test:run
npm run build
```
Expected: 104 tests pass; build succeeds.

- [ ] **Step 7: Commit**

```
git add src/pages/Progress.jsx
git commit -m "feat(progress): kg ↔ lbs display via useWeightUnit"
```

---

## Task 6: Wire units into `BigThreeCard.jsx`

**Files:**
- Modify: `src/components/BigThreeCard.jsx`

- [ ] **Step 1: Add a `unit` prop with a default**

Add imports:
```jsx
import { kgToDisplay, displayToKg, unitLabel } from '../utils/units'
```

Change the component signature:
```jsx
export default function BigThreeCard({ lift, title, entries, onAdd, onDelete, unit = 'kg' })
```

Compute `label`:
```jsx
const label = unitLabel(unit)
```

- [ ] **Step 2: Update display of latest + history rows**

Replace the existing latest line and history rows. Wherever you see `{e.weight} kg`, switch to `{kgToDisplay(e.weight, unit)} {label}`. Specifically:

```jsx
{latest ? (
  <div className="b3-latest">
    Latest: {kgToDisplay(latest.weight, unit)} {label} × {latest.reps} · {latest.date}
  </div>
) : (
  <div className="b3-empty">No entries yet — tap + Add to start tracking.</div>
)}
```

```jsx
{visible.map(e => (
  <div key={e.id} className="b3-row">
    <span className="b3-row-text">{kgToDisplay(e.weight, unit)} {label} × {e.reps} · {e.date.slice(5)}</span>
    <button className="b3-del-btn" aria-label="Delete" onClick={() => onDelete(e.id)}>🗑</button>
  </div>
))}
```

- [ ] **Step 3: Update the weight input placeholder + saveEntry**

Input:
```jsx
<input className="b3-input" type="number" inputMode="decimal" placeholder={`Weight ${label}`}
  value={weight} onChange={e => setWeight(e.target.value)} />
```

`saveEntry`:
```jsx
function saveEntry() {
  const w = displayToKg(weight, unit)
  const r = parseInt(reps)
  if (!(w > 0) || !(r >= 1 && r <= 30) || !date) return
  onAdd({ id: generateId(), lift, date, weight: w, reps: r })
  setAdding(false)
}
```

(The function still stores weight in kg — only the parse changes.)

- [ ] **Step 4: Update the existing tests**

In `tests/components/BigThreeCard.test.jsx`, the entries the tests pass to the component have `weight: 120` etc. Those values are interpreted as kg now, and the displayed `120 kg × 5` matches `kgToDisplay(120, 'kg') + ' kg'` = `'120 kg'`. Tests that expect `/120 kg × 5/i` still match.

The test that simulates typing a weight:
```jsx
fireEvent.change(screen.getByPlaceholderText(/weight/i), { target: { value: '100' } })
```
…remains valid because the placeholder still contains `Weight` (now `Weight kg`).

The assertion that `arg.weight` equals 100 (from `displayToKg('100', 'kg')`) is still `100`. No changes to the test file are required.

Re-run to confirm:
```
npm run test:run -- tests/components/BigThreeCard.test.jsx
```
Expected: 6/6 PASS.

- [ ] **Step 5: Run full suite + build**

```
npm run test:run
npm run build
```
Expected: 104 tests pass; build succeeds.

- [ ] **Step 6: Commit**

```
git add src/components/BigThreeCard.jsx
git commit -m "feat(big-three): kg ↔ lbs display via unit prop"
```

---

## Task 7: Wire units into `BodyWeightCalendar.jsx`

**Files:**
- Modify: `src/components/BodyWeightCalendar.jsx`

- [ ] **Step 1: Accept a `unit` prop**

Update the component signature:
```jsx
export default function BodyWeightCalendar({ logs, initialMonth, onSave, onDelete, unit = 'kg' }) {
```

Add imports:
```jsx
import { kgToDisplay, displayToKg, unitLabel } from '../utils/units'
```

Compute label inside the component:
```jsx
const label = unitLabel(unit)
```

- [ ] **Step 2: Display logged weights in the chosen unit**

Find the line that renders the cell weight:
```jsx
{w != null && <span className="bw-cal-cell-w">{w}</span>}
```
Replace with:
```jsx
{w != null && <span className="bw-cal-cell-w">{kgToDisplay(w, unit)}</span>}
```

- [ ] **Step 3: Editor pre-fill and save conversion**

Find `openCell`:
```jsx
function openCell(dateStr) {
  setEditingDate(dateStr)
  setDraft(byDate.has(dateStr) ? String(byDate.get(dateStr)) : '')
}
```
Replace with:
```jsx
function openCell(dateStr) {
  setEditingDate(dateStr)
  const kg = byDate.get(dateStr)
  setDraft(kg != null ? String(kgToDisplay(kg, unit)) : '')
}
```

Find `save`:
```jsx
function save() {
  const w = parseFloat(draft)
  if (!(w > 0)) return
  onSave(editingDate, w)
  setEditingDate(null)
}
```
Replace with:
```jsx
function save() {
  const kg = displayToKg(draft, unit)
  if (kg == null) return
  onSave(editingDate, kg)
  setEditingDate(null)
}
```

- [ ] **Step 4: Editor input placeholder uses the unit label**

```jsx
<input
  className="bw-cal-editor-input"
  type="number"
  inputMode="decimal"
  placeholder={label}
  value={draft}
  onChange={e => setDraft(e.target.value)}
  autoFocus
/>
```

- [ ] **Step 5: Verify existing tests still pass**

```
npm run test:run -- tests/components/BodyWeightCalendar.test.jsx
```

Note: the existing tests pass kg numbers (73.4, etc.) and the unit defaults to `'kg'` since no `unit` prop is passed. `kgToDisplay(73.4, 'kg')` returns `73.4`, so `getByText('73.4')` still finds the cell. The save test: `displayToKg('73.0', 'kg')` returns `73`, matching the existing assertion. Expected: 6/6 PASS.

- [ ] **Step 6: Run full suite + build**

```
npm run test:run
npm run build
```
Expected: 104 tests pass; build succeeds.

- [ ] **Step 7: Commit**

```
git add src/components/BodyWeightCalendar.jsx
git commit -m "feat(bw-calendar): kg ↔ lbs display via unit prop"
```

---

## Task 8: ProfileCard component + Settings refactor (profile fields)

This is the biggest task. It (a) creates a new `ProfileCard`, (b) moves the macro-calc's duplicated profile inputs out of the macro-calc, and (c) updates Settings to render Profile alongside the existing Appearance/Training/Nutrition cards (TILES updated).

**Files:**
- Create: `src/components/ProfileCard.jsx`
- Modify: `src/pages/Settings.jsx`
- Modify: `src/pages/Settings.css`
- Modify: `src/i18n/translations.js`

- [ ] **Step 1: Add translations**

In `src/i18n/translations.js`, add to BOTH language objects (place near the other `st.*` keys):

English:
```js
'st.profile': 'Profile',
'st.profile_sub': 'Your basic info',
'st.profile_name': 'Name',
'st.profile_email': 'Email',
'st.profile_save': 'Save',
'st.profile_saved': 'Saved',
'st.unit_kg': 'kg',
'st.unit_lbs': 'lbs',
```

Arabic:
```js
'st.profile': 'الملف الشخصي',
'st.profile_sub': 'بياناتك الأساسية',
'st.profile_name': 'الاسم',
'st.profile_email': 'البريد الإلكتروني',
'st.profile_save': 'حفظ',
'st.profile_saved': 'تم الحفظ',
'st.unit_kg': 'كغ',
'st.unit_lbs': 'باوند',
```

- [ ] **Step 2: Create `src/components/ProfileCard.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { supabase } from '../lib/supabase'
import { kgToDisplay, displayToKg, unitLabel } from '../utils/units'
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
  const [draft, setDraft] = useState(() => ({ ...DEFAULT_PROFILE, ...profile }))
  const [email, setEmail] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email ?? '')
    })
  }, [])

  // Re-sync draft if profile changes externally (e.g. cloud sync brings new values in)
  useEffect(() => {
    setDraft(prev => ({ ...DEFAULT_PROFILE, ...profile, ...prev }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.name, profile.weight, profile.height, profile.age, profile.gender, profile.activityLevel, profile.goal, profile.weightUnit])

  function setField(key, value) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  function changeUnit(nextUnit) {
    // Convert the displayed weight value to the new unit's display number.
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

  // Convert stored kg to display value once when the profile field changes externally
  useEffect(() => {
    if (profile.weight) {
      const stored = parseFloat(profile.weight)
      if (isFinite(stored) && stored > 0) {
        const display = kgToDisplay(stored, draft.weightUnit)
        setDraft(prev => ({ ...prev, weight: String(display) }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.weight])

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
```

- [ ] **Step 3: Append styles to `src/pages/Settings.css`**

```css
.profile-card { padding: 16px; }
.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.profile-field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.profile-field-full { grid-column: 1 / -1; }
.profile-label { opacity: 0.7; font-size: 12px; }
.profile-weight-row { display: flex; gap: 6px; }
.profile-weight-row .calc-input { flex: 1; }
.profile-unit { flex: 0 0 80px; }
```

- [ ] **Step 4: Update Settings.jsx TILES and section layout**

In `src/pages/Settings.jsx`:

(a) Replace the `TILES` array with:
```jsx
const TILES = [
  { key: 'appearance',    icon: '🎨', label: t('st.appearance'),    sub: t('st.appearance_sub') },
  { key: 'profile',       icon: '👤', label: t('st.profile'),       sub: t('st.profile_sub') },
  { key: 'training',      icon: '🏋️', label: t('st.training'),      sub: t('st.training_sub') },
  { key: 'nutrition',     icon: '🥗', label: t('st.nutrition'),     sub: t('st.nutrition_sub') },
]
```

(b) Replace `sectionRefs` with:
```jsx
const sectionRefs = {
  appearance: useRef(null),
  profile:    useRef(null),
  training:   useRef(null),
  nutrition:  useRef(null),
}
```

(c) Import the new component at the top of `Settings.jsx`:
```jsx
import ProfileCard from '../components/ProfileCard'
```

(d) In the JSX, add a Profile section between Appearance and Training:
```jsx
{/* Profile */}
<div ref={sectionRefs.profile}>
  <div className="settings-section-header">
    <span className="settings-section-icon">👤</span>
    <span className="settings-section-label">{t('st.profile')}</span>
  </div>
  <ProfileCard />
</div>
```

(e) Remove the profile input fields inside the Nutrition section's macro calculator (the weight/height/age/gender/activityLevel/goal inputs). Replace the entire `<div className="calc-grid">` block at the top of the macro calc with a simple "Reads from Profile" note + the Calculate button. The macro calc section's intent now reads:

```jsx
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
```

(f) Update `handleCalc` to read from `profile` (no longer from per-field state):

```jsx
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
```

(`profile.weight` is now always in kg per Task 8 step 2's save logic.)

(g) Delete the now-unused `setProfileField` helper and any state hooks that were only used for the macro calc's profile fields. Verify with grep:

```
grep -n "setProfileField\|profile\\.weight\|profile\\.height\|profile\\.age" src/pages/Settings.jsx
```

`setProfileField` should have zero matches; the `profile.*` reads in `handleCalc` are expected matches.

- [ ] **Step 5: Verify**

```
npm run test:run
npm run build
```
Expected: 104 tests pass; build succeeds.

- [ ] **Step 6: Commit**

```
git add src/components/ProfileCard.jsx src/pages/Settings.jsx src/pages/Settings.css src/i18n/translations.js
git commit -m "feat(settings): ProfileCard with units pref, macro calc reads from profile"
```

---

## Task 9: Change Password card

**Files:**
- Create: `src/components/ChangePasswordForm.jsx`
- Modify: `src/pages/Settings.jsx`
- Modify: `src/pages/Settings.css`
- Modify: `src/i18n/translations.js`

- [ ] **Step 1: Add translations**

Append to both language objects:

English:
```js
'st.change_password': 'Change password',
'st.cp_current': 'Current password',
'st.cp_new': 'New password',
'st.cp_confirm': 'Confirm new password',
'st.cp_save': 'Save',
'st.cp_cancel': 'Cancel',
'st.cp_success': 'Password updated.',
'st.cp_wrong_current': 'Current password is incorrect.',
'st.cp_short': 'New password must be at least 8 characters.',
'st.cp_mismatch': 'New passwords do not match.',
```

Arabic:
```js
'st.change_password': 'تغيير كلمة المرور',
'st.cp_current': 'كلمة المرور الحالية',
'st.cp_new': 'كلمة المرور الجديدة',
'st.cp_confirm': 'تأكيد كلمة المرور الجديدة',
'st.cp_save': 'حفظ',
'st.cp_cancel': 'إلغاء',
'st.cp_success': 'تم تحديث كلمة المرور.',
'st.cp_wrong_current': 'كلمة المرور الحالية غير صحيحة.',
'st.cp_short': 'يجب أن تكون كلمة المرور الجديدة 8 أحرف على الأقل.',
'st.cp_mismatch': 'كلمتا المرور الجديدتان غير متطابقتين.',
```

- [ ] **Step 2: Create `src/components/ChangePasswordForm.jsx`**

```jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'

export default function ChangePasswordForm({ onClose }) {
  const { t } = useLanguage()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setError('')
    if (next.length < 8) { setError(t('st.cp_short')); return }
    if (next !== confirm) { setError(t('st.cp_mismatch')); return }
    setBusy(true)

    const { data: userData } = await supabase.auth.getUser()
    const email = userData?.user?.email
    if (!email) { setError('No active session.'); setBusy(false); return }

    const verify = await supabase.auth.signInWithPassword({ email, password: current })
    if (verify.error) {
      setError(t('st.cp_wrong_current'))
      setBusy(false)
      return
    }

    const update = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (update.error) {
      setError(update.error.message)
      return
    }

    onClose({ ok: true })
  }

  return (
    <div className="cp-form">
      {error && <div className="auth-error">{error}</div>}
      <label className="profile-field">
        <span className="profile-label">{t('st.cp_current')}</span>
        <input className="calc-input" type="password" autoComplete="current-password"
          value={current} onChange={e => setCurrent(e.target.value)} />
      </label>
      <label className="profile-field">
        <span className="profile-label">{t('st.cp_new')}</span>
        <input className="calc-input" type="password" autoComplete="new-password"
          value={next} onChange={e => setNext(e.target.value)} />
      </label>
      <label className="profile-field">
        <span className="profile-label">{t('st.cp_confirm')}</span>
        <input className="calc-input" type="password" autoComplete="new-password"
          value={confirm} onChange={e => setConfirm(e.target.value)} />
      </label>
      <div className="cp-form-actions">
        <button className="settings-btn" onClick={() => onClose({ ok: false })} disabled={busy}>
          {t('st.cp_cancel')}
        </button>
        <button className="settings-btn" onClick={save} disabled={busy}>
          {busy ? '…' : t('st.cp_save')}
        </button>
      </div>
    </div>
  )
}
```

(The `auth-error` class is reused from the existing auth pages.)

- [ ] **Step 3: Append styles**

To `src/pages/Settings.css`:

```css
.cp-form { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 10px; }
.cp-form-actions { display: flex; gap: 8px; margin-top: 4px; }
.cp-form-actions .settings-btn { flex: 1; }
.cp-success { margin-top: 8px; color: var(--accent, #5ee2c4); font-size: 13px; }
```

- [ ] **Step 4: Wire it into the Account section of `Settings.jsx`**

At the top of the file alongside the existing imports:
```jsx
import ChangePasswordForm from '../components/ChangePasswordForm'
```

Add state and a flash near the other `useState` calls:
```jsx
const [showChangePassword, setShowChangePassword] = useState(false)
const [cpFlash, setCpFlash] = useState(false)
```

In the Account section (the "Danger zone"-style block at the bottom — the one with the Logout and Delete buttons), insert a new button + form before the Delete button:

```jsx
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
```

- [ ] **Step 5: Verify**

```
npm run test:run
npm run build
```
Expected: 104 tests pass; build succeeds.

- [ ] **Step 6: Commit**

```
git add src/components/ChangePasswordForm.jsx src/pages/Settings.jsx src/pages/Settings.css src/i18n/translations.js
git commit -m "feat(settings): change password card"
```

---

## Task 10: About card

**Files:**
- Create: `src/components/AboutCard.jsx`
- Modify: `src/pages/Settings.jsx`
- Modify: `src/pages/Settings.css`
- Modify: `src/i18n/translations.js`

- [ ] **Step 1: Add translations**

English:
```js
'st.about': 'About',
'st.about_made_by': 'Made by Motaz',
'st.about_privacy': 'Privacy Policy',
'st.about_terms': 'Terms of Service',
'st.about_feedback': 'Send feedback',
```

Arabic:
```js
'st.about': 'حول التطبيق',
'st.about_made_by': 'من تطوير معاذ',
'st.about_privacy': 'سياسة الخصوصية',
'st.about_terms': 'شروط الاستخدام',
'st.about_feedback': 'إرسال ملاحظات',
```

- [ ] **Step 2: Create `src/components/AboutCard.jsx`**

```jsx
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'

const FEEDBACK_EMAIL = 'adelmotaz861@gmail.com'

export default function AboutCard() {
  const { t } = useLanguage()
  return (
    <div className="card settings-card about-card">
      <div className="settings-card-title">{t('st.about')}</div>
      <div className="about-meta">
        <div className="about-name">IronMind v{__APP_VERSION__}</div>
        <div className="about-stack">React + Vite · Supabase · Gemini</div>
        <div className="about-author">{t('st.about_made_by')}</div>
      </div>
      <div className="about-links">
        <Link to="/privacy" className="about-link">
          <span>{t('st.about_privacy')}</span><span>›</span>
        </Link>
        <Link to="/terms" className="about-link">
          <span>{t('st.about_terms')}</span><span>›</span>
        </Link>
        <a href={`mailto:${FEEDBACK_EMAIL}`} className="about-link">
          <span>{t('st.about_feedback')}</span><span>›</span>
        </a>
      </div>
    </div>
  )
}
```

(The Vite `define` block from Task 2 makes `__APP_VERSION__` available globally at build time. ESLint may not know about it — add a comment if needed: `/* global __APP_VERSION__ */` at the top of the file.)

- [ ] **Step 3: Append styles**

To `src/pages/Settings.css`:

```css
.about-card { padding: 16px; margin-top: 24px; }
.about-meta { font-size: 13px; line-height: 1.5; opacity: 0.85; }
.about-name { font-weight: 700; font-size: 14px; opacity: 1; }
.about-stack, .about-author { opacity: 0.7; }
.about-links { display: flex; flex-direction: column; margin-top: 12px; gap: 4px; }
.about-link {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-radius: 8px;
  background: rgba(255,255,255,0.03);
  color: inherit; text-decoration: none;
  font-size: 14px;
}
.about-link:hover { background: rgba(255,255,255,0.06); }
```

- [ ] **Step 4: Mount the card at the bottom of `Settings.jsx`**

Add the import at the top:
```jsx
import AboutCard from '../components/AboutCard'
```

In the JSX, find the closing `</div>` of the page wrapper. Just before it (after the Account section block from Task 9), add:
```jsx
<AboutCard />
```

- [ ] **Step 5: Add the `__APP_VERSION__` ESLint global**

If `npm run lint` complains about `'__APP_VERSION__' is not defined`, add this comment as the first line of `src/components/AboutCard.jsx`:
```jsx
/* global __APP_VERSION__ */
```

- [ ] **Step 6: Verify**

```
npm run test:run
npm run build
```
Expected: 104 tests pass; build succeeds.

- [ ] **Step 7: Commit**

```
git add src/components/AboutCard.jsx src/pages/Settings.jsx src/pages/Settings.css src/i18n/translations.js
git commit -m "feat(settings): About card with version + privacy/terms/feedback links"
```

---

## Task 11: Final manual verification

**Files:** none

- [ ] **Step 1: Lint, tests, build**

```
npm run lint
npm run test:run
npm run build
```
Expected: tests pass (104), build succeeds.

- [ ] **Step 2: Dev server**

```
npm run dev
```

- [ ] **Step 3: Walk the success criteria**

- [ ] Settings page: no "Data" section. TILES show: Appearance, Profile, Training, Nutrition.
- [ ] Profile section: editing weight/height/age/gender/activity/goal + Save persists. Reload — values still there.
- [ ] Email shows read-only and matches your logged-in account.
- [ ] Switch the Weight unit dropdown to lbs → the number flips on the fly. Save. The displayed value in lbs reappears after reload.
- [ ] Open Progress → 1RM estimator inputs/result show `kg` if profile is kg, `lbs` if profile is lbs. Body weight log input matches.
- [ ] Open WorkoutLogger's BigThreeCard sections: latest summary and history rows render in the chosen unit. Adding a new entry parses the input correctly.
- [ ] Open the body weight calendar: logged cells render in the chosen unit. Tap a cell, edit, save — value persists; switching units later still shows the right number.
- [ ] Nutrition section's macro calc: tap Calculate → result computes correctly from the Profile values.
- [ ] Account section: tap "Change password". Enter a wrong current password → "Current password is incorrect." Try again with correct current and a new password — see "Password updated." Re-login flow optional manual confirm.
- [ ] About section at the bottom: shows `IronMind v<version>`, the stack credits, "Made by Motaz", and three rows opening Privacy / Terms / mail client.

- [ ] **Step 4: Stop the dev server**

Ctrl+C.

> No commit for this task — verification only.

---

## Self-review notes

**Spec coverage:**
- Spec §1 (removal) → Task 1
- Spec §2 (layout) → addressed in Task 8 (TILES) and Task 10 (About appended at bottom)
- Spec §3 (Profile card) → Task 8
- Spec §4 (About) → Task 10
- Spec §5 (Change Password) → Task 9
- Spec §6 (Units) → Tasks 3 (helper), 4 (hook), 5–7 (component migrations), 8 (Profile dropdown writes the pref)

**Names consistent across tasks:**
- `weightUnit` field on `profile` (Tasks 4, 8)
- `useWeightUnit` hook (Tasks 4, 5)
- `kgToDisplay` / `displayToKg` / `unitLabel` from `src/utils/units.js` (Tasks 3, 5, 6, 7, 8)
- `ProfileCard`, `ChangePasswordForm`, `AboutCard` (Tasks 8, 9, 10)
- `__APP_VERSION__` (Tasks 2, 10)

**Trade-offs flagged:**
- ProfileCard re-renders the weight display whenever the unit pref changes locally — this is intentional to give immediate feedback. The stored value in `profile.weight` is always kg.
- The macro calculator's "Calculate" no longer has its own per-field inputs; if the user clicks Calculate with empty Profile fields, nothing happens. This is the same UX the existing code had when the inputs were empty.
- The Change Password flow re-signs-in via Supabase to verify the current password. Supabase auto-rotates the session token on successful sign-in, so the user stays logged in — but the token does refresh. Acceptable for v1.
- Existing tests for `BigThreeCard` and `BodyWeightCalendar` continue to pass without modification because they don't pass a `unit` prop and the components default to `'kg'`, which round-trips numerically through the new helpers.
- The version label uses `__APP_VERSION__`, baked at build time. If `package.json` version isn't bumped between releases, the About card will show stale-looking data; that's acceptable.
