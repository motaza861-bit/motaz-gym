# Design: AI Food Scanner

**Date:** 2026-05-16  
**Status:** Approved (autonomous design)

---

## Summary

A camera button in the Nutrition page lets the user photograph their food. The image is sent to a Vercel serverless function that calls Claude's vision API and returns an estimated calorie + macro breakdown. The user can then add the result to their daily meal log with one tap.

---

## 1. User Flow

1. User taps the camera icon (📷) in the Nutrition page header
2. Phone camera opens (or file picker on desktop) via `<input type="file" accept="image/*" capture="environment">`
3. Image is compressed client-side (max 800 px, JPEG 80%) using Canvas API
4. "Analysing…" loading state shown
5. Result card appears: food name + calories + protein + carbs + fat estimate
6. User taps **Add to log** → meal added to today's log as a new entry
7. Scanner dismisses

---

## 2. Serverless Function: `api/analyze-food.js`

**Method:** POST  
**Body:** `{ image: base64string, mimeType: 'image/jpeg' }`  
**Model:** `claude-haiku-4-5-20251001` (cheap, fast, good vision)  
**Auth:** `ANTHROPIC_API_KEY` environment variable

**Prompt:**
```
You are a nutrition expert. Analyse this food photo and estimate the nutritional content for the portion visible.
Return ONLY this JSON (no markdown, no explanation):
{"food":"food name","calories":number,"protein":number,"carbs":number,"fat":number}
Base estimates on typical serving sizes. If multiple foods are visible, sum the totals.
If you cannot identify any food, return {"error":"Could not identify food"}.
```

**Success response:** `{ food, calories, protein, carbs, fat }`  
**Error response:** `{ error: string }`

---

## 3. FoodScanner Component

`src/components/FoodScanner.jsx` — full-screen overlay modal.

States:
- `idle` — shows camera icon + "Take a photo of your food"
- `loading` — spinner + "Analysing…"
- `result` — shows food name + macro chips + two buttons: **Add to log** / **Try again**
- `error` — shows error message + retry button

The hidden `<input type="file">` is triggered programmatically on mount (or on tap of the overlay) so the camera opens immediately.

**Add to log** creates a meal entry:
```js
{
  id: `scan_${Date.now()}`,
  name: result.food,
  emoji: '📸',
  time: '',
  description: 'Scanned meal',
  calories: result.calories,
  protein: result.protein,
  carbs: result.carbs,
  fat: result.fat,
}
```
Appended to `motaz_meals` via `setMeals`.

---

## 4. Nutrition Page Changes

- Camera icon button in the page header (top right, next to the date strip area)
- `scannerOpen` boolean state — renders `<FoodScanner />` when true
- FoodScanner receives `onAdd(meal)` and `onClose()` props

---

## 5. Image Compression

Client-side before API call:
```js
function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const max = 800
      const scale = Math.min(max / img.width, max / img.height, 1)
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]) // base64 only
    }
    img.src = URL.createObjectURL(file)
  })
}
```

---

## 6. File Changes

| File | Action |
|------|--------|
| `api/analyze-food.js` | Create |
| `src/components/FoodScanner.jsx` | Create |
| `src/components/FoodScanner.css` | Create |
| `src/pages/Nutrition.jsx` | Edit — add camera button + FoodScanner modal |
| `src/pages/Nutrition.css` | Edit — camera button styles |

`@anthropic-ai/sdk` already added in the onboarding spec.

---

## Out of Scope

- Barcode / nutrition label scanning
- Saving scan history
- Manual calorie correction before adding
