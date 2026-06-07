# Food Search Improvements: Barcode + AI Estimate Design Spec

**Date:** 2026-06-07
**Status:** Draft (awaiting user approval)

## Goal

Make IronMind's food search useful for Gulf supermarket products and any random food the user remembers, without paying for a third-party data API. Two new affordances:

1. **Barcode scanning** — point camera at a package, look up exact macros via Open Food Facts' free barcode endpoint.
2. **AI text-estimate fallback** — when text search doesn't find a match, send the typed query to Groq (already used for the photo scanner) and let the user verify/adjust the estimate.

## Why this approach

- **The actual gap is Gulf-market products** (snacks, supermarket items). Paid APIs (Nutritionix, Edamam) are US/UK-centric and would not close this gap meaningfully.
- **OFF already has ~3M barcoded products** including many Gulf brands. The barcode endpoint is free, instant, and bypasses the unreliable text search entirely when the user has the package in front of them.
- **AI estimates cover the long tail** — anything no database has gets a usable estimate. With clear "AI estimate — verify" labeling, users get a starting point they can correct.
- **Groq cost is negligible**: ~$0.10 per 1000 calls. Even at 1000 active users × 5 estimates/day = ~$15/month.

## Non-goals

- Adding any paid food-data API.
- Voice search ("two eggs and rice").
- Crowd-sourced food submissions back to a community database.
- Replacing the existing photo-based AI scanner (`/api/analyze-food`) — that stays untouched.
- Server-side caching of OFF responses (deferred — the Vercel function call already takes <1s; cache later if metrics show heat).
- Refactoring the existing text-search pipeline.

## Audience scope

Users of the public IronMind PWA, primarily Gulf-region.

## Architecture

```
                        FoodSearchPage
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   🔍 Type query         📷 Photo scan         📊 Barcode scan
   (existing)             (existing)              (NEW)
        │                     │                     │
        │                     ▼                     ▼
        │            /api/analyze-food      BarcodeScanner UI
        │             (Groq vision)              │
        │                                        ▼
        │                                 /api/lookup-barcode
        │                                  (OFF barcode JSON)
        │
        ▼
   Search pipeline (unchanged):
     1. saudiFoods.json (local)
     2. custom_foods (user)
     3. /api/search-food (OFF text)
        │
        ▼
   Results list shows aggregated results
        │
        ▼
   At the bottom: ✨ "Can't find it? Estimate with AI" button
        │
        ▼
   /api/estimate-food (Groq text)
        │
        ▼
   Portion picker with AI-estimate badge
```

## New components

### `src/components/BarcodeScanner.jsx`

Modal/full-screen component that opens the camera and detects barcodes.

**Detection strategy:**
- **Primary**: native `window.BarcodeDetector` API (Chrome/Edge Android — no library cost).
- **Fallback**: `@zxing/browser` library (works on iOS Safari and older browsers, adds ~150 KB gzipped).
- Both paths return the same detected `{ barcode: string, format: 'ean_13' | 'upc_a' | … }` payload to the parent.

**UX:**
- Full-screen black background, camera viewfinder in the middle.
- Crosshair overlay box centered on the viewfinder.
- "Hold over the barcode" hint text.
- Close (×) button top-left, switch-camera button top-right (if multiple cameras).
- On successful detection:
  - Phone vibrates briefly (`navigator.vibrate?.(50)`).
  - Component closes, parent calls `/api/lookup-barcode?code=<digits>`.

**Props:**
```jsx
<BarcodeScanner
  onDetect={(barcode) => { /* lookup */ }}
  onClose={() => { /* close modal */ }}
/>
```

## Modified components

### `src/pages/FoodSearchPage.jsx`

Three small additions:

1. **📊 button in the header** next to the existing 🔍 and 📷.
2. **Modal state** for the barcode scanner (open/close), and a handler that calls `/api/lookup-barcode` on detect.
3. **"✨ Estimate with AI" footer button** below the results list (always visible, regardless of how many results came back). Tapping it calls `/api/estimate-food` with the current query and routes the response into the existing portion picker.

The portion picker (already in the file) gets one new prop or state branch: when the selected food has `_source === 'ai'`, show a yellow "AI estimate — verify before saving" badge above the macros and keep all macro inputs editable.

## New server endpoints (Vercel functions)

### `api/lookup-barcode.js`

```
POST /api/lookup-barcode
Body: { barcode: "5449000000996" }
```

Implementation:
- Validates `barcode` is a non-empty string of 8–14 digits.
- Calls `https://world.openfoodfacts.org/api/v2/product/{barcode}.json` with `User-Agent: IronMindApp/1.0`.
- If `status === 1` and product has nutriments: return `{ found: true, food: { id, name, brand, emoji, per100g, defaultPortion } }`.
- If product not found or missing nutriments: return `{ found: false }`.
- 6-second timeout via `AbortSignal.timeout(6000)`.

### `api/estimate-food.js`

```
POST /api/estimate-food
Body: { query: "Almarai labneh full fat" }
```

Implementation:
- Validates `query` is a non-empty string.
- Calls Groq's chat completion endpoint with the same Llama-4-Scout model already used by `analyze-food.js`.
- Prompt:
  > "You are a nutrition expert. The user typed a food name. Estimate macros per 100g.
  > Return ONLY this JSON (no markdown): `{"name":"…","emoji":"…","per100g":{"calories":N,"protein":N,"carbs":N,"fat":N},"defaultPortion":N}`.
  > Use your best judgement for region-specific products. If the query is too vague, return: `{"error":"Could not estimate"}`."
- Parses the JSON like `analyze-food.js` does.
- Returns the parsed object on success, or `{ error: "Could not estimate" }` on parse/AI failure.

## Data shape additions

The result objects returned by the new endpoints (and surfaced into the search results list) gain one optional field:

```js
{
  id: 'off_barcode_5449000000996',  // or 'ai_<hash>'
  name: 'Coca-Cola Classic',
  emoji: '🥤',
  per100g: { calories: 42, protein: 0, carbs: 11, fat: 0 },
  defaultPortion: 330,
  _source: 'barcode' | 'ai',  // NEW — drives UI badging
  _aiEstimate: true,  // present only when _source === 'ai'
}
```

These flow through the existing quick-log pipeline into Nutrition page unchanged — quick-log entries already accept arbitrary shapes.

## UX details

### Barcode "not found" flow

- Show a small message: "Not found in our database."
- Offer two buttons:
  - **"Add manually"** → opens the existing custom-food form, pre-populated with `nameAr: ''`, `name: ''`, and a `barcode: <digits>` field stored on the custom food so future scans of the same code find it instantly.
  - **"Try AI estimate"** → sends `"<barcode> product"` to `/api/estimate-food` (or prompts the user to type a name first). Probably less useful than manual entry — kept as a secondary action.

### AI estimate fail flow

- If `/api/estimate-food` returns `{ error: ... }` or 422: show "Couldn't estimate that. Try a more specific name, or add it manually."

### Network failure

- Both new endpoints surface their `_source` to the client; on fetch failure the UI shows "Could not reach server" and keeps the user on the search list (existing UX pattern from `/api/search-food`).

### "AI estimate" persistence

- Quick-log entries created from AI estimates carry `_aiEstimate: true` in the stored object.
- The Nutrition quick-log row shows a small "✨" before the name when `_aiEstimate` is true — visual reminder that those macros are estimates the user might want to double-check later.

## Files added / modified

### Added
- `src/components/BarcodeScanner.jsx`
- `src/components/BarcodeScanner.css`
- `api/lookup-barcode.js`
- `api/estimate-food.js`
- `tests/api/lookup-barcode.test.js` (mocked fetch)
- `tests/api/estimate-food.test.js` (mocked Groq)

### Modified
- `src/pages/FoodSearchPage.jsx` — new 📊 button, modal, AI estimate footer button
- `src/pages/FoodSearchPage.css` — styles for the new button + AI estimate badge
- `src/components/MealItem.jsx` (or wherever quick-logs render) — ✨ prefix when `_aiEstimate`
- `package.json` — add `@zxing/browser` dependency

### Environment variables (Vercel)
- `GROQ_API_KEY` — already present (used by `analyze-food.js`); no new keys needed.

## Out of scope (deferred)

- Switching the existing `/api/search-food` text endpoint to a different data source.
- Saving AI estimates as new custom foods automatically (for now they're quick-logs only — saving as custom food is a manual user action via the existing form).
- A "verify your AI estimates" reminder/screen.
- Server-side caching of OFF or Groq responses.
- Caching barcode lookups locally for offline scanning.
- Auto-detecting which barcode region (EU vs US) the product is from.

## Success criteria

- A user can tap the 📊 button on the food search page, scan a real product's barcode at a supermarket, and see the correct macros within ~3 seconds.
- If the barcode is not in OFF, the "Add manually" path opens the existing form pre-populated with the barcode.
- A user can type a brand name that returns no search results, tap "✨ Estimate with AI", and receive a usable macro estimate they can edit before saving.
- AI estimates are visually distinct from curated data (badge + ✨ prefix on quick-logs).
- No existing flow regresses — typing a known food still uses the existing pipeline and returns the same results in the same order.
- Tests pass; build succeeds; PWA still installable.

## Open questions for the implementation plan

- Should the `@zxing/browser` fallback be lazy-loaded only when native `BarcodeDetector` isn't available? (Recommended yes — keeps bundle small for Android users.)
- Should the barcode scanner support EAN-8 in addition to EAN-13/UPC-A? Both OFF and most snacks use 13-digit codes; EAN-8 is rare on packaged goods. (Recommendation: yes by default, the cost is one config value in BarcodeDetector.)
- The custom-food shape doesn't currently store a barcode. Adding an optional `barcode` field on custom foods (so scanning a known code finds them instantly later) is a small data-shape change; the plan should call this out.
