# AI Coach Chatbot + Gemini Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the legacy "Tweak my program" / "Generate program" features, migrate the rest of IronMind's AI endpoints from Groq to Google Gemini, and add a WhatsApp-style AI Coach chatbot that proposes workout-modify and food-log changes the user confirms inline.

**Architecture:** Three sequential phases — (A) Removals strip dead code, (B) shared `api/_gemini.js` helper backs migrated endpoints + the new coach endpoint, (C) Coach UI page consumes a chat endpoint that returns either text or a single tool proposal; client-side appliers in `src/lib/coachTools.js` are the only writers to `localStorage` / Supabase, so the backend never mutates state.

**Tech Stack:** React 19, react-router-dom 7, Vercel serverless functions (Node), `@google/generative-ai` (new), Vitest, existing `useSyncedStorage` for cross-device sync.

**Source spec:** `docs/superpowers/specs/2026-06-08-ai-coach-chatbot-design.md`

---

## File map

### Added
- `api/_gemini.js` — shared Gemini client + helpers
- `api/coach-chat.js` — chat endpoint with function-calling
- `tests/api/coach-chat.test.js`
- `src/pages/Coach.jsx`, `src/pages/Coach.css`
- `src/components/ChatBubble.jsx`
- `src/components/ProposalCard.jsx`
- `src/components/Chat.css` (shared bubble + proposal styles)
- `src/lib/coachTools.js` — pure appliers for `modifyWorkout` and `logFood`
- `tests/lib/coachTools.test.js`

### Modified
- `package.json` — add `@google/generative-ai`, remove `groq-sdk`
- `api/analyze-food.js`, `api/analyze-meal-text.js`, `api/estimate-food.js`, `api/detect-muscles.js` — migrated to Gemini
- `tests/api/analyze-food.test.js`, `tests/api/estimate-food.test.js`, `tests/api/generate-workout.test.js` (deleted), `tests/api/analyze-meal-text.test.js` (if exists), `tests/api/detect-muscles.test.js` (if exists) — updated/removed
- `src/pages/WorkoutLogger.jsx` + `.css` — strip tweak panel; add Schedule link in header
- `src/pages/Settings.jsx` — strip "Regenerate Program" card
- `src/pages/Onboarding.jsx` — strip AI-generation step (skip step 7 and 8)
- `src/components/AuthGuard.jsx` — `chat_history` added to `SYNC_KEYS`
- `src/lib/sync.js` — `chat_history` added to `MIGRATABLE_KEYS`
- `src/hooks/useStorage.js` — `chat_history` added to `DATA_KEYS`
- `src/components/BottomNav.jsx` — Schedule → Coach
- `src/App.jsx` — register `/coach` route
- `src/i18n/translations.js` — drop legacy keys; add `nav.coach`, `coach.*`

### Deleted
- `api/edit-workout.js`
- `api/generate-workout.js`
- `tests/api/generate-workout.test.js` (and any edit-workout tests if they exist)

---

## Task 1: Remove "Tweak my program" panel

**Files:**
- Modify: `src/pages/WorkoutLogger.jsx`
- Modify: `src/pages/WorkoutLogger.css`

- [ ] **Step 1: Delete the panel JSX**

In `src/pages/WorkoutLogger.jsx`, find the block beginning `{/* AI Tweak Panel */}` and `<div className="tweak-panel card">`. Delete the entire block (panel + body + button) up to and including its closing `</div>`.

- [ ] **Step 2: Delete supporting state and helpers**

In the same file, delete:
- `const [tweakOpen, setTweakOpen] = useState(false)`
- `const [tweakText, setTweakText] = useState('')`
- `const [tweakStatus, setTweakStatus] = useState(null)`
- Any places that reset these (e.g., `setTweakOpen(false); setTweakText(''); setTweakStatus(null)`).
- The entire `async function applyTweak() { … }` function.

- [ ] **Step 3: Drop CSS rules**

In `src/pages/WorkoutLogger.css`, run:
```
grep -n "\.tweak" src/pages/WorkoutLogger.css
```
Delete every rule whose selector starts with `.tweak-`.

- [ ] **Step 4: Drop translation keys**

In `src/i18n/translations.js`, run:
```
grep -n "wl\\.tweak" src/i18n/translations.js
```
Delete every key starting with `wl.tweak` from both language objects (en + ar).

- [ ] **Step 5: Verify**

```
npm run test:run
npm run build
```
Expected: tests pass (79), build succeeds.

- [ ] **Step 6: Commit**

```
git add src/pages/WorkoutLogger.jsx src/pages/WorkoutLogger.css src/i18n/translations.js
git commit -m "refactor(workout): remove AI tweak panel"
```

---

## Task 2: Remove "Regenerate Program" card from Settings

**Files:**
- Modify: `src/pages/Settings.jsx`
- Modify: `src/i18n/translations.js`

- [ ] **Step 1: Delete the JSX block**

In `src/pages/Settings.jsx`, find the section using `{t('st.regen_desc')}` and `{t('st.regen_btn')}`. Delete the surrounding card. The block looks like:

```jsx
<div className="settings-card card">
  <div className="settings-card-title">{t('st.workout_program')}</div>
  <p className="settings-card-desc">{t('st.regen_desc')}</p>
  <button
    className="settings-btn settings-btn-outline"
    onClick={() => {
      if (window.confirm(t('st.regen_confirm'))) {
        try { localStorage.removeItem('motaz_onboarded') } catch {}
        window.location.reload()
      }
    }}
  >
    {t('st.regen_btn')}
  </button>
</div>
```

Delete the entire block.

- [ ] **Step 2: Drop related translations**

Run:
```
grep -n "st\\.regen\\|st\\.workout_program" src/i18n/translations.js
```
Delete the matching keys from both language objects. (Keep `st.workout_program` only if used elsewhere — re-grep `grep -n "st\\.workout_program" src/`.)

- [ ] **Step 3: Verify**

```
npm run test:run
npm run build
```
Expected: pass / succeed.

- [ ] **Step 4: Commit**

```
git add src/pages/Settings.jsx src/i18n/translations.js
git commit -m "refactor(settings): remove regenerate program card"
```

---

## Task 3: Strip AI generation step from Onboarding

**Files:**
- Modify: `src/pages/Onboarding.jsx`

The current onboarding has steps 0–9. Step 6 → calls `generate()` → step 7 (loading) → step 8 (preview/edit AI program) → step 9 (done, applies `setExercises`/`setTargets`/`setProfile`).

After this task, step 6 → `confirm()` directly (no AI call, no preview, no `setExercises`). Default program stays untouched.

- [ ] **Step 1: Replace the `next` handler**

Find:
```jsx
const next = () => step === 6 ? generate() : setStep(s => s + 1)
```
Replace with:
```jsx
const next = () => step === 6 ? finishOnboarding() : setStep(s => s + 1)
```

- [ ] **Step 2: Add a `finishOnboarding` function**

Add it in the helpers section, just above `next`:

```jsx
function finishOnboarding() {
  const targets = calcMacros({
    weight: parseFloat(form.weight) || 75,
    height: parseFloat(form.height) || 175,
    age: parseInt(form.age) || 25,
    gender: form.gender,
    activityLevel: form.activityLevel,
    goal: form.goal,
  })
  setTargets(targets)
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
  if (onComplete) onComplete()
}
```

Note: `setExercises` is intentionally NOT called — new users keep the default program from `DEFAULT_PROGRAM`.

- [ ] **Step 3: Delete the now-unused code**

Remove from the file:
- The entire `async function generate() { … }`.
- The entire `function confirm() { … }`.
- The state hooks for generation/preview:
  - `const [generating, setGenerating] = useState(false)`
  - `const [error, setError] = useState(null)`
  - `const [generatedData, setGeneratedData] = useState(null)`
  - `const [draftData, setDraftData] = useState(null)`
  - `const [editingSession, setEditingSession] = useState(null)`
  - `const [calcedTargets, setCalcedTargets] = useState(null)`
- All JSX blocks rendering step 7 (loading screen) and step 8 (preview/edit). Search for `{step === 7 && (…)}` and `{step === 8 && (…)}` and delete those branches.

- [ ] **Step 4: Update the progress dots**

The header has six dots `[1,2,3,4,5,6].map(...)` — keep as-is (6 steps before completion).

- [ ] **Step 5: Update the step rendering condition if needed**

Find:
```jsx
{step > 0 && step < 7 && (
  <div className="ob-header">
```
Keep this — steps 1–6 still need the header.

- [ ] **Step 6: Verify**

```
npm run test:run
npm run build
```
Expected: pass / succeed.

- [ ] **Step 7: Manual sanity check**

Run `npm run dev`. Sign up a new account in incognito (or wipe localStorage). Walk through onboarding. Expect: 6 steps, then directly to dashboard with the default program in WorkoutLogger and macro targets set. Stop the server.

- [ ] **Step 8: Commit**

```
git add src/pages/Onboarding.jsx
git commit -m "refactor(onboarding): drop AI workout generation step"
```

---

## Task 4: Delete `edit-workout.js`, `generate-workout.js`, and their tests

**Files:**
- Delete: `api/edit-workout.js`
- Delete: `api/generate-workout.js`
- Delete: `tests/api/generate-workout.test.js`
- Delete: `tests/api/edit-workout.test.js` (if it exists)

- [ ] **Step 1: Confirm what exists**

Run:
```
ls api/edit-workout.js api/generate-workout.js tests/api/edit-workout.test.js tests/api/generate-workout.test.js 2>/dev/null
```

- [ ] **Step 2: Delete the files that exist**

```
rm api/edit-workout.js api/generate-workout.js
rm tests/api/generate-workout.test.js 2>/dev/null
rm tests/api/edit-workout.test.js 2>/dev/null
```

- [ ] **Step 3: Verify**

```
npm run test:run
npm run build
```
Expected: tests pass (the count drops by however many tests the deleted files contained); build succeeds.

- [ ] **Step 4: Commit**

```
git add -u
git commit -m "chore: remove unused edit-workout and generate-workout endpoints"
```

---

## Task 5: Install `@google/generative-ai` (do NOT remove groq yet)

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

```
npm install @google/generative-ai
```
Expected: `@google/generative-ai` added to `dependencies`.

- [ ] **Step 2: Commit**

```
git add package.json package-lock.json
git commit -m "chore: add @google/generative-ai SDK"
```

> **Manual step (do once, no commit):** Add `GEMINI_API_KEY` to your local `.env.local` (get it from Google AI Studio at https://aistudio.google.com/apikey). Add the same key to Vercel → Project Settings → Environment Variables (Production / Preview / Development).

---

## Task 6: Create `api/_gemini.js` shared helper

**Files:**
- Create: `api/_gemini.js`

- [ ] **Step 1: Write the helper**

```js
// api/_gemini.js
import { GoogleGenerativeAI } from '@google/generative-ai'

let client = null
export function getGemini() {
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return client
}

export async function generateJSON({ model, system, user, schema, maxOutputTokens = 256 }) {
  const m = getGemini().getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: {
      responseMimeType: 'application/json',
      ...(schema ? { responseSchema: schema } : {}),
      maxOutputTokens,
      temperature: 0,
    },
  })
  const result = await m.generateContent(user)
  const text = result.response.text().trim()
  const stripped = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(stripped)
}

export async function generateText({ model, system, user, maxOutputTokens = 128 }) {
  const m = getGemini().getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: { maxOutputTokens, temperature: 0 },
  })
  const result = await m.generateContent(user)
  return result.response.text().trim()
}

export async function generateVisionJSON({ model, system, imageBase64, mimeType, user, maxOutputTokens = 256 }) {
  const m = getGemini().getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens,
      temperature: 0,
    },
  })
  const result = await m.generateContent([
    { inlineData: { data: imageBase64, mimeType } },
    { text: user },
  ])
  const text = result.response.text().trim()
  const stripped = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(stripped)
}
```

- [ ] **Step 2: Commit**

```
git add api/_gemini.js
git commit -m "feat(api): shared Gemini helper module"
```

---

## Task 7: Migrate `api/analyze-food.js` (photo scanner)

**Files:**
- Modify: `api/analyze-food.js`
- Modify: `tests/api/analyze-food.test.js`

- [ ] **Step 1: Replace `api/analyze-food.js` content**

```js
import { generateVisionJSON } from './_gemini.js'

const MODEL = 'gemini-2.0-flash'
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BASE64_BYTES = 5 * 1024 * 1024

const SYSTEM = `You are a nutrition expert analysing a food photo.
Step 1 — Identify the food item(s) visible.
Step 2 — Estimate the visible portion weight in grams based on plate/container size, density, and context clues.
Step 3 — Using standard nutrition data, compute calories, protein, carbs, and fat for that exact weight.

Return ONLY this JSON (no markdown, no explanation):
{"food":"name","portionGrams":number,"calories":number,"protein":number,"carbs":number,"fat":number}

If you cannot identify any food, return: {"error":"Could not identify food"}`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { image, mimeType = 'image/jpeg' } = req.body
  if (!image) return res.status(400).json({ error: 'No image provided' })
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return res.status(400).json({ error: 'Unsupported image type' })
  if (image.length > MAX_BASE64_BYTES) return res.status(400).json({ error: 'Image too large' })

  try {
    const data = await generateVisionJSON({
      model: MODEL,
      system: SYSTEM,
      imageBase64: image,
      mimeType,
      user: 'Analyse this image.',
    })

    if (data.error) return res.status(422).json(data)

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

- [ ] **Step 2: Update the existing test file**

Open `tests/api/analyze-food.test.js`. Replace the `vi.mock('groq-sdk', ...)` block with a mock of `_gemini.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ visionMock: vi.fn() }))

vi.mock('../../api/_gemini.js', () => ({
  generateVisionJSON: mocks.visionMock,
}))

import handler from '../../api/analyze-food.js'

function mockRes() {
  return {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this },
    json(p) { this.payload = p; return this },
  }
}

beforeEach(() => { mocks.visionMock.mockReset() })

describe('analyze-food', () => {
  it('rejects non-POST', async () => {
    const res = mockRes(); await handler({ method: 'GET', body: {} }, res)
    expect(res.statusCode).toBe(405)
  })
  it('rejects missing image', async () => {
    const res = mockRes(); await handler({ method: 'POST', body: {} }, res)
    expect(res.statusCode).toBe(400)
  })
  it('rejects unsupported mimeType', async () => {
    const res = mockRes(); await handler({ method: 'POST', body: { image: 'abc', mimeType: 'image/bmp' } }, res)
    expect(res.statusCode).toBe(400)
  })
  it('returns parsed data on success', async () => {
    mocks.visionMock.mockResolvedValueOnce({ food: 'Apple', portionGrams: 150, calories: 78, protein: 0, carbs: 21, fat: 0 })
    const res = mockRes(); await handler({ method: 'POST', body: { image: 'abc', mimeType: 'image/jpeg' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.food).toBe('Apple')
  })
  it('returns 422 when AI reports error', async () => {
    mocks.visionMock.mockResolvedValueOnce({ error: 'Could not identify food' })
    const res = mockRes(); await handler({ method: 'POST', body: { image: 'abc', mimeType: 'image/jpeg' } }, res)
    expect(res.statusCode).toBe(422)
  })
  it('returns 500 on internal failure', async () => {
    mocks.visionMock.mockRejectedValueOnce(new Error('boom'))
    const res = mockRes(); await handler({ method: 'POST', body: { image: 'abc', mimeType: 'image/jpeg' } }, res)
    expect(res.statusCode).toBe(500)
  })
})
```

- [ ] **Step 3: Verify**

```
npm run test:run -- tests/api/analyze-food.test.js
```
Expected: 6 tests PASS.

```
npm run test:run
```
Expected: full suite passes.

- [ ] **Step 4: Commit**

```
git add api/analyze-food.js tests/api/analyze-food.test.js
git commit -m "refactor(api): analyze-food switched to Gemini Flash 2.0"
```

---

## Task 8: Migrate `api/analyze-meal-text.js`

**Files:**
- Modify: `api/analyze-meal-text.js`

- [ ] **Step 1: Replace the file content**

```js
import { generateJSON } from './_gemini.js'

const MODEL = 'gemini-2.0-flash'

const SYSTEM = `You are a nutrition expert. Estimate macros for a meal description.
Return ONLY valid JSON with whole numbers, no explanation:
{"calories":number,"protein":number,"carbs":number,"fat":number}`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { description } = req.body ?? {}
  if (!description?.trim()) return res.status(400).json({ error: 'Missing description' })

  try {
    const data = await generateJSON({
      model: MODEL,
      system: SYSTEM,
      user: description.trim(),
      maxOutputTokens: 128,
    })

    return res.status(200).json({
      calories: Math.max(0, Math.round(data.calories) || 0),
      protein:  Math.max(0, Math.round(data.protein)  || 0),
      carbs:    Math.max(0, Math.round(data.carbs)    || 0),
      fat:      Math.max(0, Math.round(data.fat)      || 0),
    })
  } catch (err) {
    console.error('analyze-meal-text error:', err)
    return res.status(500).json({ error: 'Failed to estimate macros' })
  }
}
```

- [ ] **Step 2: Verify**

```
npm run test:run
npm run build
```
Expected: pass / succeed (no test file exists for this endpoint; if it does, mirror the analyze-food test pattern).

- [ ] **Step 3: Commit**

```
git add api/analyze-meal-text.js
git commit -m "refactor(api): analyze-meal-text switched to Gemini Flash 2.0"
```

---

## Task 9: Migrate `api/estimate-food.js`

**Files:**
- Modify: `api/estimate-food.js`
- Modify: `tests/api/estimate-food.test.js`

- [ ] **Step 1: Replace `api/estimate-food.js`**

```js
import { generateJSON } from './_gemini.js'

const MODEL = 'gemini-2.0-flash'

const SYSTEM = `You are a nutrition expert. The user typed a food name. Estimate macros per 100g for that food.
Return ONLY this JSON (no markdown, no explanation):
{"name":"<canonical name>","emoji":"<single emoji>","per100g":{"calories":<int>,"protein":<int>,"carbs":<int>,"fat":<int>},"defaultPortion":<int grams>}
Use your best judgement for region-specific or branded products.
If the query is too vague or you can't make a sensible estimate, return: {"error":"Could not estimate"}`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query } = req.body ?? {}
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Missing query' })
  }

  try {
    const data = await generateJSON({
      model: MODEL,
      system: SYSTEM,
      user: query.trim(),
      maxOutputTokens: 256,
    })

    if (data.error) return res.status(422).json(data)

    const { name, emoji, per100g, defaultPortion } = data
    if (
      typeof name !== 'string' ||
      !per100g ||
      typeof per100g.calories !== 'number' ||
      typeof per100g.protein !== 'number' ||
      typeof per100g.carbs !== 'number' ||
      typeof per100g.fat !== 'number'
    ) {
      return res.status(422).json({ error: 'Invalid estimate shape' })
    }

    return res.status(200).json({
      id: `ai_${Date.now()}`,
      name,
      emoji: emoji || '✨',
      per100g: {
        calories: Math.round(per100g.calories),
        protein:  Math.round(per100g.protein),
        carbs:    Math.round(per100g.carbs),
        fat:      Math.round(per100g.fat),
      },
      defaultPortion: typeof defaultPortion === 'number' ? Math.round(defaultPortion) : 100,
      _source: 'ai',
      _aiEstimate: true,
    })
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(422).json({ error: 'Could not parse estimate' })
    }
    return res.status(500).json({ error: 'Failed to estimate' })
  }
}
```

- [ ] **Step 2: Update `tests/api/estimate-food.test.js`**

Replace the `vi.mock('groq-sdk', ...)` block at the top with:

```js
const mocks = vi.hoisted(() => ({ jsonMock: vi.fn() }))
vi.mock('../../api/_gemini.js', () => ({
  generateJSON: mocks.jsonMock,
}))
```

And update the test bodies to make `mocks.jsonMock` directly return the parsed object (no need to wrap in a `choices[0].message.content` shape):

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ jsonMock: vi.fn() }))
vi.mock('../../api/_gemini.js', () => ({ generateJSON: mocks.jsonMock }))

import handler from '../../api/estimate-food.js'

function mockRes() {
  return {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this },
    json(p) { this.payload = p; return this },
  }
}

beforeEach(() => { mocks.jsonMock.mockReset() })

describe('estimate-food', () => {
  it('rejects non-POST', async () => {
    const res = mockRes(); await handler({ method: 'GET', body: {} }, res)
    expect(res.statusCode).toBe(405)
  })
  it('rejects empty query', async () => {
    const res = mockRes(); await handler({ method: 'POST', body: { query: '   ' } }, res)
    expect(res.statusCode).toBe(400)
  })
  it('returns parsed estimate on success', async () => {
    mocks.jsonMock.mockResolvedValueOnce({
      name: 'Almarai Labneh Full Fat',
      emoji: '🥛',
      per100g: { calories: 95, protein: 5, carbs: 4, fat: 7 },
      defaultPortion: 100,
    })
    const res = mockRes(); await handler({ method: 'POST', body: { query: 'Almarai labneh full fat' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.name).toBe('Almarai Labneh Full Fat')
    expect(res.payload._source).toBe('ai')
    expect(res.payload._aiEstimate).toBe(true)
  })
  it('returns 422 when AI reports error', async () => {
    mocks.jsonMock.mockResolvedValueOnce({ error: 'Could not estimate' })
    const res = mockRes(); await handler({ method: 'POST', body: { query: 'xyz' } }, res)
    expect(res.statusCode).toBe(422)
  })
  it('returns 422 when JSON parse fails (SyntaxError)', async () => {
    mocks.jsonMock.mockRejectedValueOnce(new SyntaxError('bad json'))
    const res = mockRes(); await handler({ method: 'POST', body: { query: 'qwerty' } }, res)
    expect(res.statusCode).toBe(422)
  })
  it('returns 422 on invalid shape', async () => {
    mocks.jsonMock.mockResolvedValueOnce({ name: 'X' /* missing per100g */ })
    const res = mockRes(); await handler({ method: 'POST', body: { query: 'x' } }, res)
    expect(res.statusCode).toBe(422)
  })
  it('returns 500 on other failures', async () => {
    mocks.jsonMock.mockRejectedValueOnce(new Error('boom'))
    const res = mockRes(); await handler({ method: 'POST', body: { query: 'rice' } }, res)
    expect(res.statusCode).toBe(500)
  })
})
```

- [ ] **Step 3: Verify**

```
npm run test:run -- tests/api/estimate-food.test.js
```
Expected: 7 tests PASS.

- [ ] **Step 4: Commit**

```
git add api/estimate-food.js tests/api/estimate-food.test.js
git commit -m "refactor(api): estimate-food switched to Gemini Flash 2.0"
```

---

## Task 10: Migrate `api/detect-muscles.js`

**Files:**
- Modify: `api/detect-muscles.js`

- [ ] **Step 1: Replace the file content**

```js
import { generateText } from './_gemini.js'

const MODEL = 'gemini-2.0-flash'

const SYSTEM = `List the primary muscles trained by an exercise name. Return ONLY a short comma-separated list, for example: "Chest, Triceps, Front Delt". No explanation, no extra text, just the list.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { exercise } = req.body ?? {}
  if (!exercise?.trim()) return res.status(400).json({ error: 'Missing exercise name' })

  try {
    const text = await generateText({
      model: MODEL,
      system: SYSTEM,
      user: exercise.trim(),
      maxOutputTokens: 60,
    })
    const muscles = text.replace(/^["']|["']$/g, '')
    return res.status(200).json({ muscles })
  } catch (err) {
    console.error('detect-muscles error:', err)
    return res.status(500).json({ error: 'Failed to detect muscles' })
  }
}
```

- [ ] **Step 2: Verify**

```
npm run test:run
npm run build
```
Expected: pass / succeed.

- [ ] **Step 3: Commit**

```
git add api/detect-muscles.js
git commit -m "refactor(api): detect-muscles switched to Gemini Flash 2.0"
```

---

## Task 11: Remove `groq-sdk` dependency

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Verify no source still imports Groq**

```
grep -rn "from 'groq-sdk'\|require('groq-sdk')\|groq-sdk" api/ src/ 2>/dev/null
```
Expected: zero matches (only this `package.json` line should reference it).

- [ ] **Step 2: Uninstall**

```
npm uninstall groq-sdk
```

- [ ] **Step 3: Verify and commit**

```
npm run test:run
npm run build
```
Expected: pass / succeed.

```
git add package.json package-lock.json
git commit -m "chore: remove groq-sdk now that Gemini migration is complete"
```

> **Manual step (post-merge, no commit):** Remove `GROQ_API_KEY` from Vercel project env vars.

---

## Task 12: Register `chat_history` as a synced storage key

**Files:**
- Modify: `src/components/AuthGuard.jsx`, `src/lib/sync.js`, `src/hooks/useStorage.js`

- [ ] **Step 1: Add to `SYNC_KEYS` in `AuthGuard.jsx`**

Find:
```jsx
const SYNC_KEYS = [
  'workout_logs', 'nutrition_logs', 'body_weight_logs',
  'meals', 'targets', 'profile', 'exercises', 'custom_foods',
  'big_three_logs',
]
```
Replace with the same array plus `'chat_history'` at the end:
```jsx
const SYNC_KEYS = [
  'workout_logs', 'nutrition_logs', 'body_weight_logs',
  'meals', 'targets', 'profile', 'exercises', 'custom_foods',
  'big_three_logs',
  'chat_history',
]
```

- [ ] **Step 2: Add to `MIGRATABLE_KEYS` in `src/lib/sync.js`**

Add `'chat_history'` to the existing `new Set([...])`.

- [ ] **Step 3: Add to `DATA_KEYS` in `src/hooks/useStorage.js`**

Add `'chat_history'` to the existing array.

- [ ] **Step 4: Verify + commit**

```
npm run test:run
git add src/components/AuthGuard.jsx src/lib/sync.js src/hooks/useStorage.js
git commit -m "feat(sync): register chat_history as a synced key"
```

---

## Task 13: `src/lib/coachTools.js` with tests

**Files:**
- Create: `src/lib/coachTools.js`
- Create: `tests/lib/coachTools.test.js`

Pure functions: given current state + tool params, return new state. No side effects, easily testable.

- [ ] **Step 1: Write failing tests**

```js
// tests/lib/coachTools.test.js
import { describe, it, expect } from 'vitest'
import { applyModifyWorkout, applyLogFood } from '../../src/lib/coachTools.js'

const baseProgram = {
  sessions: {
    A: { name: 'Push', focus: 'Chest', muscles: 'Chest, Tri', exercises: [{ name: 'Squat', sets: 3, reps: '5' }] },
  },
  daySession: { 0: 'rest', 1: 'A', 2: 'rest', 3: 'rest', 4: 'rest', 5: 'rest', 6: 'rest' },
}

describe('applyModifyWorkout', () => {
  it('adds an exercise to a session', () => {
    const next = applyModifyWorkout(baseProgram, {
      operation: 'add_exercise',
      sessionKey: 'A',
      exerciseName: 'Bench Press',
      sets: 3,
      reps: '8-10',
    })
    expect(next.sessions.A.exercises).toHaveLength(2)
    expect(next.sessions.A.exercises[1].name).toBe('Bench Press')
    expect(next.sessions.A.exercises[1].sets).toBe(3)
    expect(next.sessions.A.exercises[1].reps).toBe('8-10')
  })

  it('removes an exercise by name', () => {
    const next = applyModifyWorkout(baseProgram, {
      operation: 'remove_exercise',
      sessionKey: 'A',
      exerciseName: 'Squat',
    })
    expect(next.sessions.A.exercises).toHaveLength(0)
  })

  it('updates exercise sets and reps', () => {
    const next = applyModifyWorkout(baseProgram, {
      operation: 'update_exercise',
      sessionKey: 'A',
      exerciseName: 'Squat',
      sets: 5,
      reps: '3',
    })
    expect(next.sessions.A.exercises[0].sets).toBe(5)
    expect(next.sessions.A.exercises[0].reps).toBe('3')
  })

  it('adds a new session', () => {
    const next = applyModifyWorkout(baseProgram, {
      operation: 'add_session',
      sessionKey: 'B',
      newName: 'Pull',
    })
    expect(next.sessions.B.name).toBe('Pull')
    expect(next.sessions.B.exercises).toEqual([])
  })

  it('renames a session', () => {
    const next = applyModifyWorkout(baseProgram, {
      operation: 'rename_session',
      sessionKey: 'A',
      newName: 'Upper',
    })
    expect(next.sessions.A.name).toBe('Upper')
  })

  it('changes a weekday assignment', () => {
    const next = applyModifyWorkout(baseProgram, {
      operation: 'change_day_session',
      weekday: 1,
      newSessionKey: 'rest',
    })
    expect(next.daySession[1]).toBe('rest')
  })

  it('returns the original program unchanged when operation is unknown', () => {
    const next = applyModifyWorkout(baseProgram, { operation: 'nonsense' })
    expect(next).toEqual(baseProgram)
  })
})

describe('applyLogFood', () => {
  const today = '2026-06-08'
  const existingLogs = []

  it('creates a new day log when none exists and appends items', () => {
    const params = {
      items: [
        { name: 'Chicken breast', emoji: '🍗', grams: 150,
          per100g: { calories: 165, protein: 31, carbs: 0, fat: 4 } },
      ],
    }
    const next = applyLogFood(existingLogs, today, params)
    expect(next).toHaveLength(1)
    expect(next[0].date).toBe(today)
    expect(next[0].quickLogs).toHaveLength(1)
    const entry = next[0].quickLogs[0]
    expect(entry.name).toBe('Chicken breast')
    expect(entry.portionG).toBe(150)
    expect(entry.calories).toBe(Math.round(165 * 1.5))
    expect(entry.protein).toBe(Math.round(31 * 1.5))
    expect(entry._source).toBe('ai-chat')
  })

  it('appends to an existing day log without losing prior quickLogs', () => {
    const initial = [{
      date: today,
      meals: [],
      quickLogs: [{ id: 'q1', name: 'Apple', emoji: '🍎', portionG: 100, calories: 52, protein: 0, carbs: 14, fat: 0 }],
      calorieBump: 0,
    }]
    const params = { items: [{ name: 'Egg', emoji: '🥚', grams: 50, per100g: { calories: 143, protein: 13, carbs: 1, fat: 10 } }] }
    const next = applyLogFood(initial, today, params)
    expect(next[0].quickLogs).toHaveLength(2)
    expect(next[0].quickLogs[0].name).toBe('Apple')
    expect(next[0].quickLogs[1].name).toBe('Egg')
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

```
npm run test:run -- tests/lib/coachTools.test.js
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/coachTools.js`**

```js
// src/lib/coachTools.js — pure appliers for AI Coach tool proposals.

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function generateEntryId(prefix = 'qlog') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function applyModifyWorkout(program, params) {
  const next = clone(program)
  const { operation } = params

  switch (operation) {
    case 'add_exercise': {
      const s = next.sessions[params.sessionKey]
      if (!s) return program
      s.exercises = [...(s.exercises ?? []), {
        name: params.exerciseName,
        sets: params.sets ?? 3,
        reps: params.reps ?? '8-10',
      }]
      return next
    }
    case 'remove_exercise': {
      const s = next.sessions[params.sessionKey]
      if (!s) return program
      s.exercises = (s.exercises ?? []).filter(e => e.name !== params.exerciseName)
      return next
    }
    case 'update_exercise': {
      const s = next.sessions[params.sessionKey]
      if (!s) return program
      s.exercises = (s.exercises ?? []).map(e =>
        e.name === params.exerciseName
          ? { ...e, ...(params.sets != null && { sets: params.sets }), ...(params.reps != null && { reps: params.reps }) }
          : e
      )
      return next
    }
    case 'add_session': {
      next.sessions[params.sessionKey] = {
        name: params.newName ?? params.sessionKey,
        focus: '',
        muscles: '',
        exercises: [],
      }
      return next
    }
    case 'rename_session': {
      const s = next.sessions[params.sessionKey]
      if (!s) return program
      s.name = params.newName
      return next
    }
    case 'change_day_session': {
      next.daySession[params.weekday] = params.newSessionKey
      return next
    }
    default:
      return program
  }
}

export function applyLogFood(nutritionLogs, dateStr, params) {
  const next = clone(nutritionLogs)
  const entries = (params.items ?? []).map(item => {
    const ratio = (item.grams ?? 100) / 100
    return {
      id: generateEntryId('aichat'),
      name: item.name,
      emoji: item.emoji ?? '✨',
      portionG: item.grams ?? 100,
      calories: Math.round((item.per100g?.calories ?? 0) * ratio),
      protein:  Math.round((item.per100g?.protein  ?? 0) * ratio),
      carbs:    Math.round((item.per100g?.carbs    ?? 0) * ratio),
      fat:      Math.round((item.per100g?.fat      ?? 0) * ratio),
      _source: 'ai-chat',
    }
  })

  const existing = next.find(l => l.date === dateStr)
  if (existing) {
    existing.quickLogs = [...(existing.quickLogs ?? []), ...entries]
    return next
  }
  next.push({ date: dateStr, meals: [], quickLogs: entries, calorieBump: 0 })
  return next
}
```

- [ ] **Step 4: Run tests**

```
npm run test:run -- tests/lib/coachTools.test.js
```
Expected: 9 tests PASS.

- [ ] **Step 5: Commit**

```
git add src/lib/coachTools.js tests/lib/coachTools.test.js
git commit -m "feat(coach): pure appliers for modifyWorkout and logFood"
```

---

## Task 14: `api/coach-chat.js` endpoint with tests

**Files:**
- Create: `api/coach-chat.js`
- Create: `tests/api/coach-chat.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/api/coach-chat.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ generateMock: vi.fn() }))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mocks.generateMock }
    }
  },
}))

import handler from '../../api/coach-chat.js'

function mockRes() {
  return {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this },
    json(p) { this.payload = p; return this },
  }
}

beforeEach(() => { mocks.generateMock.mockReset() })

describe('coach-chat', () => {
  it('rejects non-POST', async () => {
    const res = mockRes(); await handler({ method: 'GET', body: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects empty message', async () => {
    const res = mockRes(); await handler({ method: 'POST', body: { message: '   ', history: [], context: {} } }, res)
    expect(res.statusCode).toBe(400)
  })

  it('returns text reply when model returns text', async () => {
    mocks.generateMock.mockResolvedValueOnce({
      response: {
        text: () => 'Eat more protein.',
        functionCalls: () => [],
      },
    })
    const res = mockRes(); await handler({ method: 'POST', body: { message: 'tips?', history: [], context: {} } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.reply.type).toBe('text')
    expect(res.payload.reply.content).toBe('Eat more protein.')
  })

  it('returns a tool proposal when model calls modifyWorkout', async () => {
    mocks.generateMock.mockResolvedValueOnce({
      response: {
        text: () => '',
        functionCalls: () => [{
          name: 'modifyWorkout',
          args: { operation: 'add_exercise', sessionKey: 'A', exerciseName: 'Bench Press', sets: 3, reps: '8-10', summary: 'Add 3x8-10 bench press to session A' },
        }],
      },
    })
    const res = mockRes(); await handler({ method: 'POST', body: { message: 'add bench press', history: [], context: {} } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.reply.type).toBe('tool_proposal')
    expect(res.payload.reply.proposal.tool).toBe('modifyWorkout')
    expect(res.payload.reply.proposal.params.exerciseName).toBe('Bench Press')
  })

  it('returns a tool proposal when model calls logFood', async () => {
    mocks.generateMock.mockResolvedValueOnce({
      response: {
        text: () => '',
        functionCalls: () => [{
          name: 'logFood',
          args: {
            items: [{ name: 'Egg', emoji: '🥚', grams: 50, per100g: { calories: 143, protein: 13, carbs: 1, fat: 10 } }],
            summary: 'Log 50g egg',
          },
        }],
      },
    })
    const res = mockRes(); await handler({ method: 'POST', body: { message: 'I ate an egg', history: [], context: {} } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.reply.type).toBe('tool_proposal')
    expect(res.payload.reply.proposal.tool).toBe('logFood')
    expect(res.payload.reply.proposal.params.items).toHaveLength(1)
  })

  it('returns a text "try rephrasing" fallback when tool call is malformed', async () => {
    mocks.generateMock.mockResolvedValueOnce({
      response: {
        text: () => '',
        functionCalls: () => [{ name: 'modifyWorkout', args: { operation: 'invalid' } }],
      },
    })
    const res = mockRes(); await handler({ method: 'POST', body: { message: 'do something', history: [], context: {} } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.reply.type).toBe('text')
    expect(res.payload.reply.content).toMatch(/rephrasing/i)
  })

  it('returns 500 when the model errors', async () => {
    mocks.generateMock.mockRejectedValueOnce(new Error('boom'))
    const res = mockRes(); await handler({ method: 'POST', body: { message: 'hi', history: [], context: {} } }, res)
    expect(res.statusCode).toBe(500)
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

```
npm run test:run -- tests/api/coach-chat.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `api/coach-chat.js`**

```js
import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL = 'gemini-2.0-flash'

const VALID_OPERATIONS = new Set([
  'add_exercise', 'remove_exercise', 'update_exercise',
  'add_session', 'rename_session', 'change_day_session',
])

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'modifyWorkout',
        description: "Modify the user's workout program template.",
        parameters: {
          type: 'OBJECT',
          properties: {
            operation: { type: 'STRING' },
            sessionKey: { type: 'STRING' },
            exerciseName: { type: 'STRING' },
            sets: { type: 'NUMBER' },
            reps: { type: 'STRING' },
            newName: { type: 'STRING' },
            weekday: { type: 'NUMBER' },
            newSessionKey: { type: 'STRING' },
            summary: { type: 'STRING' },
          },
          required: ['operation', 'summary'],
        },
      },
      {
        name: 'logFood',
        description: "Log one or more foods into today's nutrition quick log.",
        parameters: {
          type: 'OBJECT',
          properties: {
            items: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING' },
                  emoji: { type: 'STRING' },
                  grams: { type: 'NUMBER' },
                  per100g: {
                    type: 'OBJECT',
                    properties: {
                      calories: { type: 'NUMBER' },
                      protein:  { type: 'NUMBER' },
                      carbs:    { type: 'NUMBER' },
                      fat:      { type: 'NUMBER' },
                    },
                    required: ['calories', 'protein', 'carbs', 'fat'],
                  },
                },
                required: ['name', 'grams', 'per100g'],
              },
            },
            summary: { type: 'STRING' },
          },
          required: ['items', 'summary'],
        },
      },
    ],
  },
]

function buildSystem(context) {
  const program = JSON.stringify(context?.program ?? {})
  const targets = JSON.stringify(context?.targets ?? {})
  const profile = JSON.stringify(context?.profile ?? {})
  return `You are a fitness and nutrition coach embedded in the IronMind app.
You speak in a friendly, concise tone — like a trainer texting a client.
When the user wants to add/remove/change exercises, sessions, or which weekday runs which session,
call the modifyWorkout tool with a single operation.
When the user says they ate or drank something, call the logFood tool.
Otherwise reply with normal text.

Current user state (use this for context, do NOT echo it back):
- Program template: ${program}
- Macro targets: ${targets}
- Profile: ${profile}`
}

function historyToContents(history) {
  return (history ?? []).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content ?? m.proposal?.summary ?? '' }],
  }))
}

function validateModifyWorkout(args) {
  if (!args || !VALID_OPERATIONS.has(args.operation)) return null
  if (!args.summary || typeof args.summary !== 'string') return null
  return args
}

function validateLogFood(args) {
  if (!args || !Array.isArray(args.items) || args.items.length === 0) return null
  for (const it of args.items) {
    if (!it.name || typeof it.grams !== 'number' || !it.per100g) return null
    const p = it.per100g
    if (typeof p.calories !== 'number' || typeof p.protein !== 'number' || typeof p.carbs !== 'number' || typeof p.fat !== 'number') return null
  }
  if (!args.summary) return null
  return args
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { history, message, context } = req.body ?? {}
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Missing message' })
  }

  try {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = client.getGenerativeModel({
      model: MODEL,
      systemInstruction: buildSystem(context),
      tools: TOOLS,
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
    })

    const contents = [
      ...historyToContents(history),
      { role: 'user', parts: [{ text: message.trim() }] },
    ]

    const result = await model.generateContent({ contents })
    const calls = (result.response.functionCalls?.() ?? [])

    if (calls.length > 0) {
      const call = calls[0]
      let params = null
      if (call.name === 'modifyWorkout') params = validateModifyWorkout(call.args)
      else if (call.name === 'logFood')   params = validateLogFood(call.args)

      if (!params) {
        return res.status(200).json({
          reply: {
            role: 'assistant',
            type: 'text',
            content: "I had trouble understanding that — try rephrasing.",
          },
        })
      }

      return res.status(200).json({
        reply: {
          role: 'assistant',
          type: 'tool_proposal',
          proposal: { tool: call.name, params, summary: params.summary },
        },
      })
    }

    const text = result.response.text().trim()
    return res.status(200).json({
      reply: { role: 'assistant', type: 'text', content: text || "I'm not sure what to say." },
    })
  } catch (err) {
    console.error('coach-chat error:', err)
    return res.status(500).json({ error: 'Coach unavailable' })
  }
}
```

- [ ] **Step 4: Run tests**

```
npm run test:run -- tests/api/coach-chat.test.js
```
Expected: 7 tests PASS.

```
npm run test:run
```
Expected: full suite passes.

- [ ] **Step 5: Commit**

```
git add api/coach-chat.js tests/api/coach-chat.test.js
git commit -m "feat(coach): chat endpoint with Gemini function-calling"
```

---

## Task 15: `ChatBubble` + `ProposalCard` components

**Files:**
- Create: `src/components/ChatBubble.jsx`
- Create: `src/components/ProposalCard.jsx`
- Create: `src/components/Chat.css`

- [ ] **Step 1: Write `src/components/Chat.css`**

```css
/* WhatsApp-style chat bubble + proposal card */

.chat-row { display: flex; padding: 4px 12px; }
.chat-row.left  { justify-content: flex-start; }
.chat-row.right { justify-content: flex-end; }

.chat-bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-bubble.assistant {
  background: rgba(94, 226, 196, 0.12);
  color: #d8fff5;
  border: 1px solid rgba(94, 226, 196, 0.3);
  border-bottom-left-radius: 4px;
}
.chat-bubble.user {
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  border-bottom-right-radius: 4px;
}

.chat-typing {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 8px 14px;
}
.chat-typing-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(255,255,255,0.5);
  animation: chat-pulse 1.2s infinite;
}
.chat-typing-dot:nth-child(2) { animation-delay: 0.15s; }
.chat-typing-dot:nth-child(3) { animation-delay: 0.3s; }
@keyframes chat-pulse {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}

.proposal-card {
  background: rgba(94, 226, 196, 0.08);
  border: 1px solid rgba(94, 226, 196, 0.3);
  border-radius: 14px;
  padding: 12px;
  margin: 6px 0;
  max-width: 80%;
}
.proposal-card-header {
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 6px;
}
.proposal-card-summary {
  font-size: 14px;
  margin-bottom: 8px;
}
.proposal-card-details {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  margin-bottom: 10px;
  white-space: pre-wrap;
  font-family: monospace;
}
.proposal-card-actions { display: flex; gap: 8px; }
.proposal-card-actions button {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.proposal-cancel { background: transparent; color: inherit; border: 1px solid rgba(255,255,255,0.15); }
.proposal-apply  { background: var(--accent, #5ee2c4); color: #0a0a0a; border: 0; }

.proposal-applied {
  font-size: 12px;
  opacity: 0.7;
  margin-top: 4px;
}
```

- [ ] **Step 2: Write `src/components/ChatBubble.jsx`**

```jsx
import './Chat.css'

export default function ChatBubble({ role, type, content }) {
  if (type === 'typing') {
    return (
      <div className="chat-row left">
        <div className="chat-bubble assistant chat-typing">
          <span className="chat-typing-dot" />
          <span className="chat-typing-dot" />
          <span className="chat-typing-dot" />
        </div>
      </div>
    )
  }
  const side = role === 'user' ? 'right' : 'left'
  const cls = role === 'user' ? 'user' : 'assistant'
  return (
    <div className={`chat-row ${side}`}>
      <div className={`chat-bubble ${cls}`}>{content}</div>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/components/ProposalCard.jsx`**

```jsx
import './Chat.css'

function describeWorkoutParams(params) {
  const lines = [`Operation: ${params.operation}`]
  if (params.sessionKey)    lines.push(`Session: ${params.sessionKey}`)
  if (params.exerciseName)  lines.push(`Exercise: ${params.exerciseName}`)
  if (params.sets != null)  lines.push(`Sets: ${params.sets}`)
  if (params.reps != null)  lines.push(`Reps: ${params.reps}`)
  if (params.newName)       lines.push(`New name: ${params.newName}`)
  if (params.weekday != null) lines.push(`Weekday: ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][params.weekday]}`)
  if (params.newSessionKey) lines.push(`New session: ${params.newSessionKey}`)
  return lines.join('\n')
}

function describeFoodParams(params) {
  return (params.items ?? []).map(item => {
    const ratio = (item.grams ?? 100) / 100
    const cal = Math.round((item.per100g?.calories ?? 0) * ratio)
    return `${item.emoji ?? '✨'} ${item.name} — ${item.grams}g (~${cal} kcal)`
  }).join('\n')
}

export default function ProposalCard({ proposal, applied, onApply, onCancel }) {
  const title = proposal.tool === 'modifyWorkout' ? '📋 Change to your program' : '🍽️ Log this food'
  const details = proposal.tool === 'modifyWorkout'
    ? describeWorkoutParams(proposal.params)
    : describeFoodParams(proposal.params)

  return (
    <div className="chat-row left">
      <div className="proposal-card">
        <div className="proposal-card-header">{title}</div>
        <div className="proposal-card-summary">{proposal.summary}</div>
        <pre className="proposal-card-details">{details}</pre>
        {applied ? (
          <div className="proposal-applied">✓ Applied</div>
        ) : (
          <div className="proposal-card-actions">
            <button className="proposal-cancel" onClick={onCancel}>Cancel</button>
            <button className="proposal-apply"  onClick={onApply}>Apply</button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

```
npm run test:run
npm run build
```
Expected: pass / succeed (no automated tests for these visual components).

- [ ] **Step 5: Commit**

```
git add src/components/ChatBubble.jsx src/components/ProposalCard.jsx src/components/Chat.css
git commit -m "feat(coach): chat bubble and proposal card components"
```

---

## Task 16: `Coach.jsx` page

**Files:**
- Create: `src/pages/Coach.jsx`
- Create: `src/pages/Coach.css`

- [ ] **Step 1: Write `src/pages/Coach.css`**

```css
.coach-page {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  padding-bottom: 64px; /* room for bottom nav */
}

.coach-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.coach-title { font-size: 16px; font-weight: 700; }
.coach-menu-btn {
  background: transparent; border: 0; color: inherit;
  font-size: 18px; width: 36px; height: 36px; cursor: pointer;
}

.coach-feed {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.coach-empty {
  text-align: center;
  padding: 24px;
  font-size: 14px;
  opacity: 0.7;
}

.coach-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom, 0));
  border-top: 1px solid rgba(255,255,255,0.05);
  background: var(--bg, #060A12);
}
.coach-input {
  flex: 1;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 10px 12px;
  color: inherit;
  font-size: 14px;
}
.coach-send {
  background: var(--accent, #5ee2c4);
  color: #0a0a0a;
  border: 0;
  border-radius: 10px;
  width: 44px; height: 44px;
  font-size: 18px;
  cursor: pointer;
}
.coach-send:disabled { opacity: 0.4; cursor: not-allowed; }

.coach-error {
  margin: 8px 12px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 80, 80, 0.1);
  border: 1px solid rgba(255, 80, 80, 0.3);
  color: #ff8b8b;
  font-size: 13px;
}
```

- [ ] **Step 2: Write `src/pages/Coach.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react'
import { useStorage } from '../hooks/useStorage'
import { useExercises } from '../hooks/useExercises'
import { useTargets } from '../hooks/useTargets'
import { toLocalDateStr } from '../utils/dateHelpers'
import { applyModifyWorkout, applyLogFood } from '../lib/coachTools'
import ChatBubble from '../components/ChatBubble'
import ProposalCard from '../components/ProposalCard'
import './Coach.css'

const MAX_HISTORY = 200
const SEND_HISTORY_WINDOW = 30

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function Coach() {
  const [history, setHistory] = useStorage('chat_history', [])
  const [program, setProgram] = useExercises()
  const [targets] = useTargets()
  const [profile] = useStorage('profile', {})
  const [nutritionLogs, setNutritionLogs] = useStorage('nutrition_logs', [])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const feedRef = useRef(null)

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [history, busy])

  function append(msg) {
    setHistory(prev => {
      const next = [...prev, msg]
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
    })
  }

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setError('')
    setInput('')
    const userMsg = { id: newId('msg'), role: 'user', type: 'text', content: text, timestamp: new Date().toISOString() }
    append(userMsg)
    setBusy(true)

    try {
      const recent = history.slice(-SEND_HISTORY_WINDOW)
      const res = await fetch('/api/coach-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: recent,
          message: text,
          context: { program, targets, profile },
        }),
      })
      if (!res.ok) throw new Error('Coach unavailable')
      const data = await res.json()
      const reply = data.reply
      if (reply.type === 'tool_proposal') {
        append({
          id: newId('msg'), role: 'assistant', type: 'tool_proposal',
          proposal: reply.proposal,
          timestamp: new Date().toISOString(),
        })
      } else {
        append({
          id: newId('msg'), role: 'assistant', type: 'text',
          content: reply.content,
          timestamp: new Date().toISOString(),
        })
      }
    } catch {
      setError("Couldn't reach your coach. Try again.")
    } finally {
      setBusy(false)
    }
  }

  function applyProposal(msg) {
    const { proposal } = msg
    if (proposal.tool === 'modifyWorkout') {
      setProgram(prev => applyModifyWorkout(prev, proposal.params))
    } else if (proposal.tool === 'logFood') {
      const today = toLocalDateStr(new Date())
      setNutritionLogs(prev => applyLogFood(prev, today, proposal.params))
    }
    setHistory(prev => prev.map(m => m.id === msg.id ? { ...m, type: 'tool_applied', appliedAt: new Date().toISOString() } : m))
  }

  function cancelProposal(msg) {
    setHistory(prev => prev.map(m => m.id === msg.id ? { ...m, type: 'tool_cancelled' } : m))
  }

  function clearChat() {
    if (!window.confirm('Clear chat history? Workout and nutrition data are not affected.')) return
    setHistory([])
  }

  return (
    <div className="coach-page">
      <div className="coach-header">
        <span className="coach-title">🤖 AI Coach</span>
        <button className="coach-menu-btn" aria-label="Clear chat" onClick={clearChat}>⋯</button>
      </div>

      <div className="coach-feed" ref={feedRef}>
        {history.length === 0 && (
          <div className="coach-empty">
            Hi! I'm your fitness coach. Want to build a program together, or log what you've eaten today?
          </div>
        )}
        {history.map(msg => {
          if (msg.type === 'text') {
            return <ChatBubble key={msg.id} role={msg.role} type="text" content={msg.content} />
          }
          if (msg.type === 'tool_proposal') {
            return (
              <ProposalCard
                key={msg.id}
                proposal={msg.proposal}
                applied={false}
                onApply={() => applyProposal(msg)}
                onCancel={() => cancelProposal(msg)}
              />
            )
          }
          if (msg.type === 'tool_applied') {
            return (
              <ProposalCard
                key={msg.id}
                proposal={msg.proposal}
                applied={true}
                onApply={() => {}}
                onCancel={() => {}}
              />
            )
          }
          if (msg.type === 'tool_cancelled') {
            return <ChatBubble key={msg.id} role="assistant" type="text" content={`(cancelled) ${msg.proposal?.summary ?? ''}`} />
          }
          return null
        })}
        {busy && <ChatBubble role="assistant" type="typing" content="" />}
      </div>

      {error && <div className="coach-error">{error}</div>}

      <div className="coach-input-row">
        <input
          className="coach-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Talk to your coach…"
          onKeyDown={e => { if (e.key === 'Enter') send() }}
        />
        <button className="coach-send" onClick={send} disabled={!input.trim() || busy}>▶</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

```
npm run test:run
npm run build
```
Expected: pass / succeed.

- [ ] **Step 4: Commit**

```
git add src/pages/Coach.jsx src/pages/Coach.css
git commit -m "feat(coach): Coach page with chat feed and proposal flow"
```

---

## Task 17: BottomNav + route + Schedule link in WorkoutLogger + translations

**Files:**
- Modify: `src/components/BottomNav.jsx`
- Modify: `src/App.jsx`
- Modify: `src/pages/WorkoutLogger.jsx`
- Modify: `src/i18n/translations.js`

- [ ] **Step 1: Update BottomNav tabs**

Replace the `TABS` array in `src/components/BottomNav.jsx` with:

```jsx
const TABS = [
  { to: '/dashboard', icon: '🏠', key: 'nav.home' },
  { to: '/workout',   icon: '🏋️', key: 'nav.workout' },
  { to: '/nutrition', icon: '🥗', key: 'nav.nutrition' },
  { to: '/progress',  icon: '📈', key: 'nav.progress' },
  { to: '/coach',     icon: '🤖', key: 'nav.coach' },
]
```

- [ ] **Step 2: Register `/coach` route in `src/App.jsx`**

Add the import alongside the existing page imports:
```jsx
import Coach from './pages/Coach'
```

Inside the `<Routes>` block, add (next to the existing `/schedule`, `/settings`, etc. lines):
```jsx
<Route path="/coach" element={<><Coach /><BottomNav /></>} />
```

Leave the `/schedule` route in place — it's still reachable directly.

- [ ] **Step 3: Add a small Schedule link to the WorkoutLogger header**

Find where the WorkoutLogger renders its page title/header. Add a small link/button (above or next to the title) that navigates to `/schedule`:

```jsx
import { useNavigate } from 'react-router-dom'
// inside the component:
const navigate = useNavigate()
// in JSX, near the top of the page:
<button className="wl-schedule-link" onClick={() => navigate('/schedule')}>
  📅 Schedule
</button>
```

Append to `src/pages/WorkoutLogger.css`:
```css
.wl-schedule-link {
  background: transparent;
  color: var(--accent, #5ee2c4);
  border: 0;
  font-size: 13px;
  padding: 6px 0;
  cursor: pointer;
}
```

- [ ] **Step 4: Add translations**

In `src/i18n/translations.js`, both language objects, add:

```js
'nav.coach': 'Coach',
```

(For Arabic: `'nav.coach': 'المدرّب',`.)

- [ ] **Step 5: Verify**

```
npm run test:run
npm run build
```
Expected: pass / succeed.

- [ ] **Step 6: Commit**

```
git add src/components/BottomNav.jsx src/App.jsx src/pages/WorkoutLogger.jsx src/pages/WorkoutLogger.css src/i18n/translations.js
git commit -m "feat(coach): bottom-nav tab, /coach route, Schedule header link"
```

---

## Task 18: Final manual verification

**Files:** none

- [ ] **Step 1: Lint, tests, build**

```
npm run lint
npm run test:run
npm run build
```
Expected: zero errors, tests pass, build succeeds, PWA service worker still generated.

- [ ] **Step 2: Dev server**

```
npm run dev
```

- [ ] **Step 3: Walk the success criteria**

- [ ] Workout page: no AI tweak panel; a small "📅 Schedule" link in the header opens the schedule view.
- [ ] Settings: no "Regenerate Program" card.
- [ ] Onboarding (fresh account or wipe localStorage): 6 steps, lands on Dashboard with default program in WorkoutLogger and macro targets set. No "Generating your program…" loading screen.
- [ ] Photo scanner (`/food-scan`): still works — Gemini analyses an image and returns macros.
- [ ] AI text estimate on `/food-search`: still works — tap "Estimate with AI" on a query, see a result.
- [ ] Detect-muscles in `ExerciseEditForm`: still works when adding a custom exercise.
- [ ] Bottom nav: 🏠 / 🏋️ / 🥗 / 📈 / 🤖 (Schedule removed).
- [ ] `/coach` route renders the Coach page with the empty-state greeting.
- [ ] Type "add 3 sets of bench press to session A" → AI returns a Proposal card → tap Apply → check `/workout` shows Bench Press 3x8-10 in session A.
- [ ] Type "I just ate a chicken breast and 200g of rice" → AI returns a Proposal card with two items → tap Apply → check `/nutrition` shows two quick-log entries for today with `_source: 'ai-chat'`.
- [ ] Refresh the page — chat history persists.
- [ ] Open the app in an incognito window logged into the same account — chat history is there.
- [ ] Tap ⋯ → confirm → chat clears, but `/workout` and `/nutrition` data is untouched.

- [ ] **Step 4: Stop the dev server**

Ctrl+C.

> No commit for this task — verification only.

---

## Self-review notes

**Spec coverage:**
- Part A (removals) → Tasks 1, 2, 3, 4
- Part B (Gemini migration) → Tasks 5, 6, 7, 8, 9, 10, 11
- Part C (chatbot infra + UI) → Tasks 12, 13, 14, 15, 16, 17
- Final verification → Task 18

**Names consistent across tasks:**
- `chat_history` storage key (Tasks 12, 16)
- Tool names `modifyWorkout` / `logFood` (Tasks 13, 14, 15, 16)
- `applyModifyWorkout` / `applyLogFood` exported from `coachTools.js` (Tasks 13, 16)
- Message types `text` / `tool_proposal` / `tool_applied` / `tool_cancelled` (Tasks 14, 16)
- `api/_gemini.js` exports `generateJSON` / `generateText` / `generateVisionJSON` (Tasks 6, 7, 8, 9, 10)

**Trade-offs flagged:**
- The plan deliberately keeps the `/schedule` route AND removes the Schedule bottom-nav tab. The Schedule view is reached via a small link from the workout header — keeps the feature accessible without crowding the nav.
- No automated tests for `Coach.jsx` / `ChatBubble` / `ProposalCard` — heavy on browser APIs and visual state. Task 18 manual verification covers the integration.
- The chat history is capped at 200 messages client-side. Beyond that, oldest messages are dropped before save. Future spec could add server-side pagination if users want full history.
- The plan migrates Groq endpoints before deleting the dependency (Tasks 5–11 ordered to keep tests green at every commit). The merge is atomic-by-task — each commit ships a working app.
