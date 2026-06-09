# Design: Day Navigation + Editable Meals & Targets

**Date:** 2026-05-16  
**Status:** Approved

---

## Summary

Five improvements to the Motaz Gym app:

1. Navigate to any day (past or future) across Dashboard, WorkoutLogger, and Nutrition
2. Remove the hardcoded protein shake from the default meal plan
3. Edit, delete, and add meals inline in the Nutrition page
4. Edit daily calorie and macro targets in Settings
5. Macro calculator — enter weight, height, age, activity level, and goal to auto-calculate targets

---

## 1. Day Navigation

### Component: `DateStrip`

A shared week-strip component rendered at the top of Dashboard, WorkoutLogger, and Nutrition.

- Shows Mon–Sun of the selected week
- ‹ / › arrows jump to the previous/next week
- Today's date is highlighted in red
- Days with a completed workout log show a small red dot beneath the date number
- Tapping any day sets it as the active date

### Shared State: `DateContext`

A React context (`src/context/DateContext.jsx`) provides:

```js
{ selectedDate, setSelectedDate }
```

- `selectedDate` is a `Date` object, initialised to `new Date()` (today) on app load
- Wraps the entire app in `main.jsx`
- All three pages read `selectedDate` instead of calling `new Date()` directly

### Pages affected

| Page | Change |
|------|--------|
| Dashboard | Add `DateStrip`; use `selectedDate` for session, streak, nutrition summary |
| WorkoutLogger | Add `DateStrip`; use `selectedDate` to determine session and load/save the log |
| Nutrition | Add `DateStrip`; use `selectedDate` to load/save the daily nutrition log |

### Edge cases

- Future training days: WorkoutLogger shows the session card but the "Finish" button saves the log for that future date
- Rest days: WorkoutLogger shows the rest-day screen regardless of selected date if it is a rest day
- Streak calculation is always based on today, not the selected date

---

## 2. Editable Meals

### Storage

Meals move from the hardcoded `src/data/nutritionPlan.js` constant to localStorage key `motaz_meals`.

- On first launch (key absent), the app seeds localStorage with the default 4 meals (breakfast, lunch, afternoon snack, dinner — protein shake removed)
- Shape per meal: `{ id, name, emoji, time, description, calories, protein, carbs, fat }`
- A `useMeals()` hook in `src/hooks/useMeals.js` wraps `useStorage('motaz_meals', DEFAULT_MEALS)`

### UI: Inline editing in Nutrition page

Each `MealItem` card gets two icon buttons: ✏️ (edit) and 🗑 (delete).

**Edit flow:**
- Tapping ✏️ expands an inline form directly below the meal card (replaces the card display)
- Fields: Name, Emoji, Time, Description, Calories, Protein (g), Carbs (g), Fat (g)
- Buttons: Cancel / Save
- Save updates the meal in localStorage and collapses the form

**Delete flow:**
- Tapping 🗑 shows a browser `confirm()` prompt: "Delete [name]?"
- On confirm, removes the meal from the list

**Add meal:**
- A dashed "+ Add meal" button at the bottom of the meal list
- Opens the same inline form in "new meal" mode
- On save, appends the new meal to the list with a generated `id`

### Default meals (first launch)

| Meal | Calories | P | C | F |
|------|----------|---|---|---|
| Breakfast — 5 eggs + 80g oats + banana | 620 | 45g | 75g | 18g |
| Lunch — 200g chicken + 150g rice + veg | 620 | 55g | 70g | 8g |
| Afternoon Snack — Greek yogurt + almonds | 320 | 25g | 20g | 18g |
| Dinner — 200g beef + sweet potato + salad | 520 | 48g | 45g | 18g |

---

## 3. Editable Targets

### Storage

Targets move from hardcoded constants to localStorage key `motaz_targets`.

- On first launch (key absent), seeds with `{ calories: 2400, protein: 210, carbs: 250, fat: 70 }`
- A `useTargets()` hook in `src/hooks/useTargets.js` wraps `useStorage('motaz_targets', DEFAULT_TARGETS)`

### UI: Settings page

A new "Calorie & Macro Targets" card in Settings with four number inputs:
- Daily calories (kcal)
- Protein (g)
- Carbs (g)
- Fat (g)

Changes save on blur (or a "Save" button). The Nutrition page CalorieRing and MacroBar components update instantly since they read from the same hook.

---

## 4. Macro Calculator

### Storage

User profile stored in localStorage key `motaz_profile`.

- Shape: `{ weight, height, age, gender, activityLevel, goal }`
- `weight` (kg) — auto-filled from the most recent `motaz_body_weight_logs` entry if present
- `height` (cm)
- `age` (years)
- `gender`: `'male'` | `'female'`
- `activityLevel`: `'sedentary'` | `'light'` | `'moderate'` | `'very'` | `'extreme'`
- `goal`: `'recomp'` | `'cut'` | `'bulk'`

### Formula

**BMR — Miffin-St Jeor:**
- Male: `10 × weight + 6.25 × height − 5 × age + 5`
- Female: `10 × weight + 6.25 × height − 5 × age − 161`

**TDEE = BMR × activity multiplier:**

| Level | Label | Multiplier |
|-------|-------|-----------|
| sedentary | Desk job, no exercise | 1.2 |
| light | Light exercise 1–3 days/week | 1.375 |
| moderate | Moderate exercise 3–5 days/week | 1.55 |
| very | Hard exercise 6–7 days/week | 1.725 |
| extreme | Physical job + hard exercise | 1.9 |

**Calorie target by goal:**

| Goal | Adjustment |
|------|-----------|
| Recomp | TDEE (maintenance) |
| Cut | TDEE − 400 kcal |
| Bulk | TDEE + 250 kcal |

**Macro split:**
- Protein: 2.0 g/kg bodyweight (rounded to nearest 5g)
- Fat: 25% of calorie target ÷ 9 (rounded to nearest 5g)
- Carbs: remaining calories ÷ 4 (rounded to nearest 5g)

### UI: Settings page

A "Calculate My Macros" card in Settings above the manual targets card:

- Inputs: Weight (kg), Height (cm), Age, Gender (Male/Female toggle), Activity level (dropdown/select), Goal (Recomp / Cut / Bulk selector)
- **Calculate** button — runs formula and shows result inline: "~2 540 kcal · 210g P · 270g C · 71g F"
- **Apply to targets** button — writes result to `motaz_targets` and dismisses the result
- Profile values are saved to `motaz_profile` on every Calculate so the form remembers them

---

## 5. Backup

`exportAllData` and `importAllData` in `useStorage.js` add `motaz_meals`, `motaz_targets`, and `motaz_profile` to the `DATA_KEYS` list so they are included in JSON backups.

---

## File Changes

| File | Action |
|------|--------|
| `src/context/DateContext.jsx` | Create |
| `src/components/DateStrip.jsx` | Create |
| `src/components/DateStrip.css` | Create |
| `src/hooks/useMeals.js` | Create |
| `src/hooks/useTargets.js` | Create |
| `src/utils/macroCalculator.js` | Create — pure formula functions |
| `src/pages/Dashboard.jsx` | Edit — use DateContext, add DateStrip |
| `src/pages/WorkoutLogger.jsx` | Edit — use DateContext, add DateStrip |
| `src/pages/Nutrition.jsx` | Edit — use DateContext + useMeals + useTargets, add inline editing |
| `src/components/MealItem.jsx` | Edit — add edit/delete buttons and inline form |
| `src/components/MealItem.css` | Edit — styles for edit form |
| `src/pages/Settings.jsx` | Edit — add macro calculator card + targets card |
| `src/pages/Settings.css` | Edit — styles for calculator and targets inputs |
| `src/hooks/useStorage.js` | Edit — add motaz_meals, motaz_targets, motaz_profile to DATA_KEYS |
| `src/data/nutritionPlan.js` | Edit — remove protein shake; rename export to DEFAULT_MEALS |
| `main.jsx` | Edit — wrap app in DateContext provider |

---

## Out of Scope

- Syncing selected date to the URL
- Per-day meal plans (different meals on different days)
- Nutritional database / barcode scanner
