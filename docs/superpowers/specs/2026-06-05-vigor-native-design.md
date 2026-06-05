# Vigor — Native Mobile App Design Spec (v1)
_Date: 2026-06-05_

## Overview

Vigor is a fully local React Native fitness app for workout logging and nutrition tracking. v1 is a lean foundation — two screens, no backend, no AI, no charts — intended as the first phase of replacing the IronMind web app with a native experience. The Saudi foods database from IronMind is reused unchanged.

The user is a beginner. The design prioritizes readable JavaScript, a flat folder structure with one responsibility per file, and simple state management.

**Stack:** React Native · Expo Managed Workflow · React Navigation (bottom tabs) · AsyncStorage · pure StyleSheet · JavaScript

---

## 1. Project Location

`C:\Users\Ehab\Projects\Vigor` — a standalone repository, separate from the IronMind web app at `C:\Users\Ehab\.local\bin\IronMind`.

---

## 2. Folder Structure

```
Vigor/
├── App.js                          # NavigationContainer wraps the tab navigator
├── app.json                        # Expo config (name: Vigor)
├── package.json
├── babel.config.js
├── .gitignore                      # Expo defaults
├── assets/                         # Expo-generated icon, splash, adaptive icon, favicon
└── src/
    ├── navigation/
    │   └── AppTabs.js              # Bottom tabs: Workout, Nutrition
    ├── screens/
    │   ├── WorkoutScreen.js
    │   └── NutritionScreen.js
    ├── components/
    │   ├── ExerciseCard.js         # One exercise + its sets
    │   ├── SetRow.js               # reps × weight + edit/delete
    │   ├── FoodPickerModal.js      # Search/filter saudiFoods, set portion (g)
    │   ├── CustomFoodForm.js       # Manual entry: name, kcal, P, C, F
    │   └── MacroBar.js             # Reusable progress bar (label, current, target)
    ├── storage/
    │   ├── workoutStorage.js       # AsyncStorage wrapper for workout days
    │   └── nutritionStorage.js     # AsyncStorage wrapper for nutrition days
    ├── data/
    │   └── saudiFoods.json         # Copied from IronMind unchanged
    └── utils/
        ├── date.js                 # todayKey() → "YYYY-MM-DD"
        └── portion.js              # scaleByPortion(per100g, grams) → totals
```

Each folder has one responsibility. Every file is small enough to read in one screenful.

---

## 3. Navigation

`React Navigation` v7 with `@react-navigation/bottom-tabs`. Two tabs:

- **Workout** — `WorkoutScreen`
- **Nutrition** — `NutritionScreen`

No stack navigation in v1 — modals (food picker, custom form, edit goals) are rendered inside their parent screen using React Native's `Modal` component. Keeps mental model flat.

---

## 4. Data Model

All data is stored in AsyncStorage as JSON strings, one key per day per domain.

### 4.1 Workout day

Key: `workout:YYYY-MM-DD` (e.g. `workout:2026-06-05`)

```js
{
  date: "2026-06-05",
  exercises: [
    {
      id: "abc",
      name: "Bench Press",
      sets: [
        { id: "s1", reps: 10, weight: 60 },
        { id: "s2", reps: 8,  weight: 65 }
      ]
    }
  ]
}
```

IDs are generated client-side (random short strings or timestamps). Weight unit is kilograms in v1 — no unit toggle.

### 4.2 Nutrition day

Key: `nutrition:YYYY-MM-DD`

```js
{
  date: "2026-06-05",
  entries: [
    // Picked from saudiFoods.json:
    {
      id: "e1",
      source: "saudi",
      foodId: "kabsa_chicken",
      grams: 400,
      computed: { calories: 600, protein: 48, carbs: 72, fat: 16 }
    },
    // Custom entry:
    {
      id: "e2",
      source: "custom",
      name: "Protein shake",
      computed: { calories: 220, protein: 40, carbs: 10, fat: 2 }
    }
  ]
}
```

The `computed` block is snapshotted at the moment the food is logged. This way, if `saudiFoods.json` is ever updated, historical entries remain unchanged.

### 4.3 Targets

Key: `nutrition:targets` (single global object, not per day)

```js
{ calories: 2500, protein: 180, carbs: 250, fat: 70 }
```

Defaults shown above. Editable via an "Edit goals" link on the Nutrition screen — opens a modal with four number inputs.

---

## 5. Food Data — `saudiFoods.json`

Reused unchanged from IronMind at `src/data/saudiFoods.json` (~26 KB). Each entry shape:

```js
{
  id: "kabsa_chicken",
  name: "Kabsa (Chicken)",
  nameAr: "كبسة دجاج",
  category: "traditional",
  emoji: "🍗",
  per100g: { calories: 150, protein: 12, carbs: 18, fat: 4 },
  defaultPortion: 400        // grams
}
```

### Food picker behavior
- Top of modal: text search input + horizontal category chips
- Search matches `name` (English) only in v1 — Arabic search is out of scope
- Each row renders: `emoji` + `name` + `nameAr` (small/muted) + `per100g.calories` (kcal/100g)
- Tap a row → number input pre-filled with `defaultPortion` → "Save" computes totals and adds the entry
- Computed totals use `scaleByPortion(per100g, grams)` from `utils/portion.js`

---

## 6. Workout Screen UX

- **Header:** "Today's Workout" + today's date (formatted human-readable)
- **List body:** `ExerciseCard` per exercise
  - Card header: exercise name + trash icon (delete the whole exercise, confirms first)
  - Card body: vertical list of `SetRow`s
  - Each `SetRow`: reps input · `×` · weight input · ✏️ (edit) · 🗑 (delete)
  - `+ Add Set` button at the bottom of each card (defaults to previous set's values when present, else empty)
- **Footer:** `+ Add Exercise` button — prompts for a name via a small inline form

Auto-save: every state mutation writes the updated day record to AsyncStorage in the same handler.

---

## 7. Nutrition Screen UX

- **Header:** "Today" + date + small `Edit goals` link
- **Summary block:**
  - Big calorie line: `1,250 / 2,500 kcal`
  - Three `MacroBar`s stacked: Protein, Carbs, Fat (each shows `current g / target g`)
- **Entries list:** food name (with emoji if from saudiFoods) + kcal + 🗑
- **Footer:** two buttons side by side — `Pick food` (opens `FoodPickerModal`) · `Add custom` (opens `CustomFoodForm`)

Auto-save: same pattern as Workout screen.

---

## 8. Persistence Pattern

Each screen on mount:
1. Computes `todayKey()` from `utils/date.js`
2. Calls `storage.load(key)` → returns the day object or a fresh empty one
3. Stores it in `useState`

Each handler:
1. Updates React state (immutable update)
2. Calls `storage.save(key, nextState)` immediately — no debouncing

This pattern is intentionally boring. No subscriptions, no global store, no effects beyond the initial load. For a beginner, this is the easiest pattern to reason about.

---

## 9. Build Order

1. Scaffold `npx create-expo-app Vigor --template blank` (JavaScript) at `C:\Users\Ehab\Projects\Vigor`
2. Install `@react-navigation/native`, `@react-navigation/bottom-tabs`, `react-native-screens`, `react-native-safe-area-context`, `@react-native-async-storage/async-storage`. Create the `src/` folder skeleton.
3. Wire `NavigationContainer` + bottom tab navigator + two placeholder screens. Verify with `npx expo start --web`.
4. Implement `workoutStorage`, `utils/date.js`, then build `WorkoutScreen` + `ExerciseCard` + `SetRow`.
5. Copy `saudiFoods.json` from IronMind. Implement `nutritionStorage`, `utils/portion.js`, `MacroBar`, then build `NutritionScreen` + `FoodPickerModal` + `CustomFoodForm`.
6. **Pause for user review.**

---

## 10. Dependencies

| Package | Purpose |
|---|---|
| `expo` | Managed workflow base |
| `react-native` | Core UI primitives |
| `@react-navigation/native` | Navigation container |
| `@react-navigation/bottom-tabs` | Bottom tab navigator |
| `react-native-screens` | Native screen optimization (peer of navigation) |
| `react-native-safe-area-context` | Safe area handling (peer of navigation) |
| `@react-native-async-storage/async-storage` | Local persistence |

No state library, no UI kit, no styling library, no animation library in v1.

---

## 11. Out of Scope for v1

The following are deliberately deferred to later phases:

- History view of past days (workout or nutrition)
- AI food scanner (Anthropic/Groq integration)
- Progress charts (Recharts equivalent)
- Schedule, Classes, Onboarding, Settings screens
- Themes / dark mode
- Multi-language UI (Arabic translations)
- Arabic search in the food picker
- Animations / reanimated
- Weekly or rolling stats
- Exercise presets / program library
- Photo logging or barcode scanning
- Per-meal grouping (breakfast / lunch / dinner)
- Cloud sync, accounts, RevenueCat

Each is potentially a follow-up phase once v1 is stable.

---

## 12. Testing Approach (v1)

Manual verification in `npx expo start --web` after each build-order step. No automated test suite in v1 — the user is a beginner and learning Jest/RTL alongside React Native would slow learning. Tests are added in a later phase once the architecture is stable.

---

## 13. Relationship to IronMind

Vigor is not a port of IronMind — it is a fresh, much smaller foundation that *borrows* IronMind's curated `saudiFoods.json`. The IronMind web app at `C:\Users\Ehab\.local\bin\IronMind` is left untouched. Future Vigor phases may port more IronMind concepts (PR detection, macro calculator, volume helpers) but only as concrete needs arise.
