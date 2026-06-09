# Design: Onboarding + AI Workout Generator

**Date:** 2026-05-16  
**Status:** Approved (autonomous design)

---

## Summary

When a user opens the app for the first time, a full-screen onboarding wizard collects their profile, calculates personalised macros, and calls Claude to generate a workout program tailored specifically to them. Returning users skip onboarding entirely. Settings keeps a "Regenerate Program" button so users can redo it any time.

---

## 1. First-Launch Detection

`localStorage.getItem('motaz_onboarded')` — absent = not onboarded.

`App.jsx` checks this on mount. If not onboarded, renders `<Onboarding />` instead of the main router. When onboarding completes, sets `motaz_onboarded = '1'` and unmounts the wizard.

---

## 2. Onboarding Wizard Steps

A full-screen, single-page wizard. One step visible at a time. Progress dots at top. Back arrow on all steps except the first. No step can be skipped.

| # | Step | Inputs |
|---|------|--------|
| 1 | Welcome | Static screen — "Let's build your program" + Start button |
| 2 | Goal | Toggle: Recomp / Cut / Bulk (with one-line descriptions) |
| 3 | Profile | Gender (Male/Female toggle), Age (number), Weight (kg), Height (cm) |
| 4 | Activity | Select: Sedentary / Light / Moderate / Very Active / Extreme |
| 5 | Training | Days/week (3 / 4 / 5 / 6 chip selector), Experience (Beginner / Intermediate / Advanced) |
| 6 | Equipment | Full Gym / Home Gym (dumbbells) / Bodyweight Only |
| 7 | Generating | Full-screen loading state — "Building your program…" — calls both APIs in parallel |
| 8 | Summary | Shows calculated macros + session count + "Let's go" button |

---

## 3. What Happens on Complete

After the API returns on step 7:

1. `calcMacros({ weight, height, age, gender, activityLevel, goal })` → write to `motaz_targets`
2. API response `{ sessions, daySession }` → write to `motaz_exercises`  
   Shape: `{ sessions: { A: {...}, B: {...} }, daySession: { "0": "rest", "1": "A", ... } }`
3. Full profile → write to `motaz_profile`
4. `localStorage.setItem('motaz_onboarded', '1')`

---

## 4. Serverless Function: `api/generate-workout.js`

**Method:** POST  
**Body:** `{ goal, experience, daysPerWeek, equipment, weight, age }`  
**Model:** `claude-sonnet-4-6` (more reliable structured JSON)  
**Auth:** `ANTHROPIC_API_KEY` environment variable

**Prompt:**

```
You are an expert strength and conditioning coach. Create a personalised workout program.

User: goal=${goal}, experience=${experience}, ${daysPerWeek} days/week, equipment=${equipment}, age=${age}, weight=${weight}kg

Create exactly ${daysPerWeek} distinct sessions labeled A, B, C... Assign each training day to a session; remaining days are rest.

Return ONLY this JSON (no markdown, no explanation):
{
  "sessions": {
    "A": {
      "name": "string",
      "focus": "string",
      "muscles": "string",
      "exercises": [
        { "name": "string", "sets": number, "reps": "string", "rest": number, "muscles": "string" }
      ]
    }
  },
  "daySession": { "0": "rest_or_session_key", "1": "...", "2": "...", "3": "...", "4": "...", "5": "...", "6": "..." }
}

Rules:
- 5–8 exercises per session covering all major muscle groups across the week
- reps as string e.g. "8–10" or "12"
- rest in seconds (60–180)
- Equipment guidance: full gym=barbells+cables+machines; home gym=dumbbells+pull-up bar; bodyweight=no equipment
- Experience guidance: beginner=simple compound movements, moderate volume; intermediate=progressive overload focus; advanced=higher intensity, more volume
- Goal guidance: cut=higher reps(12-15), shorter rest, supersets; bulk=heavy compounds(5-8 reps), longer rest; recomp=balanced(8-12 reps)
- Day keys: 0=Sunday, 1=Monday, ..., 6=Saturday
```

**Error handling:** If Claude returns malformed JSON, return HTTP 500 with `{ error: 'Generation failed' }`. Client shows a retry button.

---

## 5. useExercises Hook

`src/hooks/useExercises.js` wraps `useStorage('motaz_exercises', DEFAULT_PROGRAM)`.

`DEFAULT_PROGRAM` exported from `src/data/workoutProgram.js`:
```js
export const DEFAULT_PROGRAM = { sessions: SESSIONS, daySession: DAY_SESSION }
```

`WorkoutLogger` switches from reading `SESSIONS` / `DAY_SESSION` directly to reading `useExercises()`:
```js
const [program, setProgram] = useExercises()
const sessions = program.sessions
const daySession = program.daySession
```

---

## 6. Settings: Regenerate Program

A "Regenerate Program" card in `Settings.jsx` (above the macro calculator card):
- Shows current program summary: "X sessions · generated [date]"
- "Regenerate" button → navigates to `/onboarding` route OR opens the wizard inline
- Simplest: set `motaz_onboarded` to `''` and reload — onboarding wizard appears again

---

## 7. Storage Keys

| Key | Shape | Used by |
|-----|-------|---------|
| `motaz_onboarded` | `'1'` or absent | App.jsx gate |
| `motaz_exercises` | `{ sessions, daySession }` | useExercises, WorkoutLogger |
| `motaz_profile` | existing shape | Settings macro calculator |
| `motaz_targets` | existing shape | useTargets, Nutrition, Settings |

`motaz_exercises` added to `DATA_KEYS` in `useStorage.js`.

---

## 8. File Changes

| File | Action |
|------|--------|
| `api/generate-workout.js` | Create |
| `src/pages/Onboarding.jsx` | Create |
| `src/pages/Onboarding.css` | Create |
| `src/hooks/useExercises.js` | Create |
| `src/data/workoutProgram.js` | Edit — add `DEFAULT_PROGRAM` export |
| `src/App.jsx` | Edit — onboarding gate |
| `src/pages/WorkoutLogger.jsx` | Edit — use `useExercises()` |
| `src/pages/Settings.jsx` | Edit — regenerate button |
| `src/hooks/useStorage.js` | Edit — add `motaz_exercises` to DATA_KEYS |
| `vercel.json` | Edit — exclude `/api/` from SPA rewrite |
| `package.json` | Edit — add `@anthropic-ai/sdk` |

---

## Out of Scope

- Editing the program schedule (which days = which session) — user edits exercises only
- Multiple programs / program history
- Re-running onboarding mid-session (use Settings regenerate button)
