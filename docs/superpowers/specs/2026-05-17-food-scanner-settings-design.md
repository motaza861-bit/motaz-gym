# Food Scanner Improvements + Settings Redesign — Design Spec
**Date:** 2026-05-17
**Status:** Approved

---

## Overview

Two independent improvements to IronMind:

1. **Food Scanner** — switch to a better vision model (Llama 4 Maverick via Groq, free tier), improve the prompt for portion-aware estimation, and add editable macro fields so the user can correct results before logging.
2. **Settings Redesign** — reorganise the Settings page with a 2×2 icon-tile navigation grid (Option B) for visual clarity, preserving all existing functionality.

---

## 1. Food Scanner Improvements

### 1.1 API — `api/analyze-food.js`

**Model change**
Replace `meta-llama/llama-4-scout-17b-16e-instruct` with `meta-llama/llama-4-maverick-17b-128e-instruct`. Maverick is Groq's higher-capability multimodal model and produces significantly better spatial and portion reasoning. Still free tier.

**Prompt rewrite**
Current prompt asks the model to estimate macros directly from a photo. New prompt instructs chain-of-thought reasoning:

```
You are a nutrition expert analysing a food photo.
Step 1 — Identify the food item(s) visible.
Step 2 — Estimate the visible portion weight in grams based on plate/container size, density, and context clues.
Step 3 — Using standard nutrition data, compute calories, protein, carbs, and fat for that exact weight.

Return ONLY this JSON (no markdown, no explanation):
{"food":"name","portionGrams":number,"calories":number,"protein":number,"carbs":number,"fat":number}

If you cannot identify any food, return: {"error":"Could not identify food"}
```

**Optional portion hint**
Accept an optional `portionGrams` number in the request body. When provided, skip Step 2 and instruct the model to compute macros for that exact weight instead of estimating. This allows the frontend to re-query with a user-corrected weight if needed (future use — not wired in this iteration).

**Response**
Add `portionGrams` to the success response alongside the existing fields.

**Validation**
Add `portionGrams` to the numeric field validation check.

---

### 1.2 Frontend — `FoodScanner.jsx`

**Editable result state**
After a successful API response, copy all values into local editable state:
```js
const [edits, setEdits] = useState({
  food: '', portionGrams: 0, calories: 0, protein: 0, carbs: 0, fat: 0
})
```

Initialised from the API result when it arrives.

**Portion field**
The result screen shows a **Portion** row above the macro inputs:
- Label: "Portion (g)"
- Input: number, pre-filled with `portionGrams` from API
- On change: scale all four macros proportionally —
  `newCalories = originalCalories * (newGrams / originalGrams)` — using the *original* API values as the base (stored in a ref so repeated edits don't compound rounding errors)

**Editable macro inputs**
Replace the four static display values with `<input type="number">` fields. Each is independently editable. Changing macros directly does not update the portion field.

**Add to Log**
Uses whatever is currently in `edits` — the user's final adjusted values. Food name comes from `edits.food`.

**No second API call** — all portion scaling is client-side math.

---

### 1.3 Files changed

| File | Change |
|------|--------|
| `api/analyze-food.js` | New model, new prompt, accept `portionGrams` hint, return `portionGrams` |
| `src/components/FoodScanner.jsx` | Editable portion + macro fields in result state |
| `src/components/FoodScanner.css` | Input styling for editable fields |

---

## 2. Settings Page Redesign

### 2.1 Layout — Option B (Icon Tiles)

The Settings page gains a **2×2 navigation grid** at the top. Each tile is a tappable card that scrolls to the corresponding section below.

**Tiles:**

| Icon | Label | Scrolls to |
|------|-------|-----------|
| 🎨 | Appearance | Accent colour, card style, background |
| 🏋️ | Training | Workout program regeneration |
| 🥗 | Nutrition | Macro calculator + daily targets |
| 💾 | Data | Export / import backup |

Tapping a tile calls `scrollIntoView({ behavior: 'smooth' })` on the corresponding section ref.

**Section headers**
Each section below the grid gets a card-style header row: icon + bold label + optional subtitle. This replaces the current plain `.section-title` text labels.

**Content preserved**
All existing inputs, buttons, and logic remain unchanged. Only visual structure and navigation change.

**About section**
Stays at the bottom as a simple footer card, not included in the tile grid.

### 2.2 Files changed

| File | Change |
|------|--------|
| `src/pages/Settings.jsx` | Add tile grid with refs + smooth scroll, update section headers |
| `src/pages/Settings.css` | Tile grid styles, section header styles |

---

## 3. What Doesn't Change

- All existing data model and localStorage keys
- Food scanner camera/file input flow
- Scanner error and retry behaviour
- Nutrition page (FoodScanner used there unchanged except result editing)
- All other pages
- Test suite

---

## 4. Out of Scope

- Re-query API with corrected portion weight (future)
- Food name search / text-based lookup (future)
- Settings sub-pages / navigation routing
- Light mode
