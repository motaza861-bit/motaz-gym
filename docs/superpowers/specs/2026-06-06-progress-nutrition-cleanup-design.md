# Progress Rewrite, Nutrition Cleanup, and Calendar Marker: Design Spec

**Date:** 2026-06-06
**Status:** Draft (awaiting user approval)

## Goal

A bundle of five small-to-medium changes the user requested in one batch:

1. Make delete buttons more prominent in three places in the food-search/quick-log flow.
2. Strip the default meal templates from the Nutrition page so it starts empty.
3. Rewrite the Progress page to keep only the 1RM estimator, add a body-weight tracker with a hidden calendar, and add per-lift tracking for the powerlifting big three.
4. Remove the Notifications section from Settings.
5. Mark days with workout *or* nutrition data on the DateStrip.

## Non-goals

- Push / service-worker notifications. The existing in-window notification feature is being removed; rebuilding it as a real push system is a separate spec.
- Charting strength progress on the big-three (just last-N entries, no graphs).
- Backfilling old workouts into the new big-three storage.
- Translating new UI strings (English-only is acceptable for v1 of this change; the existing `t()` calls stay where they were already added).

## Feature 1 — Food search delete buttons

Three spots get a clearer "delete" affordance. None changes behavior — only styling and one new button.

| Spot | File | Change |
|---|---|---|
| Quick-log row in Nutrition page | `src/pages/Nutrition.jsx`, `src/pages/Nutrition.css` | The existing `🗑` icon button gets a red tint and a larger hit target. |
| Portion picker in food search | `src/pages/FoodSearchPage.jsx`, `src/pages/FoodSearchPage.css` | New **Cancel** button next to **Add to today** — sets `selected` back to `null` so the user returns to the search list. |
| Custom food row in search results | `src/pages/FoodSearchPage.jsx`, `src/components/FoodSearch.css` | The existing `fcf-row-btn--delete` button gets the same red treatment. |

### Visual specs

- Bigger hit target: minimum 36px × 36px touch area.
- Red color: existing `--danger` CSS variable if present, otherwise `#ff5c5c`.
- Text label on the new Cancel button — emoji-only buttons get an accessible aria-label.

No data shape changes.

## Feature 2 — Nutrition: empty meal plan by default

### Change

`src/data/nutritionPlan.js`:
```js
export const DEFAULT_MEALS = []
```

### What this affects

- New users (and reset profiles) see no template meals.
- Existing users who already have meals in `localStorage['meals']` (or in their `user_data` row) — unchanged.
- The "Meal plan" section heading stays.
- The **+ Add meal** button stays — empty state shows just it.

`DEFAULT_TARGETS` and other exports in `nutritionPlan.js` are unchanged.

## Feature 3 — Progress page rewrite

Largest change. Full rewrite of `src/pages/Progress.jsx`.

### What's deleted

- Stats grid (total sessions, this month, total volume)
- Body weight chart (`recharts` LineChart)
- Tab row: Strength / Volume / History
- Strength chart, Volume chart, History accordion (`HistoryRow` component goes too)
- PR list
- All imports for `recharts`, `getPRs`, `calcVolumeBySession`, `movingAverage`

### What's kept

- 1RM estimator (Epley formula) — exact same code, moved to the bottom.

### What's added

**Body weight section** (top of page):

```
┌──────────────────────────────────────┐
│  Body Weight                         │
│  [ 73.4 ] [ Log ]                    │
│  ▾ Present Body Weight  ← disclosure │
└──────────────────────────────────────┘
```

When expanded:

```
┌──────────────────────────────────────┐
│  ‹  June 2026  ›                     │
│   S    M    T    W    T    F    S    │
│        1    2    3    4    5    6    │
│                       73.4  73.2  -- │
│   7    8    9    10   11   12   13   │
│   72.9  --   --   --   --   --   --  │
│  ...                                  │
└──────────────────────────────────────┘
```

Behavior:
- The disclosure remembers its open/closed state in `localStorage['bw_calendar_open']` (a preference, not synced).
- The visible month starts at today's month. `‹` and `›` paginate.
- Each cell with a logged weight shows the weight number (1 decimal).
- Tap a cell → inline editor opens *under* the calendar:
  - For a logged day: input pre-filled with the weight, **Save** + **Delete** buttons.
  - For an unlogged day: input empty, only **Save** button.

**Big three lift cards** (one card per lift):

```
┌──────────────────────────────────────┐
│  🏋 Squat                            │
│  Latest: 120 kg × 5 · 2026-06-04     │
│                          [+ Add]     │
├──────────────────────────────────────┤
│  120 kg × 5  · 06-04          [🗑]   │
│  115 kg × 5  · 06-01          [🗑]   │
│  ...                                  │
└──────────────────────────────────────┘
```

Behavior:
- Three cards in fixed order: Squat → Bench Press → Deadlift.
- **+ Add** opens an inline form: `[weight kg] [reps] [date]` → **Save** / **Cancel**.
- Date defaults to today, can be edited.
- Saving prepends to the per-lift entry list.
- Each row has a 🗑 — confirm → removed.
- Show the latest 5 entries by date desc; "Show more" link reveals the rest if there are more.
- Empty state: "No entries yet — tap **+ Add** to start tracking."

### Data shape

New synced key: **`big_three_logs`**

```js
[
  {
    id: 'big3_1717689600000_a4f',
    lift: 'squat' | 'bench' | 'deadlift',
    date: '2026-06-04',     // YYYY-MM-DD, local
    weight: 120,             // kg, integer or float
    reps: 5,                 // integer 1..30
  },
  ...
]
```

### Sync integration

- Add `'big_three_logs'` to:
  - `SYNC_KEYS` in `src/components/AuthGuard.jsx`
  - `MIGRATABLE_KEYS` in `src/lib/sync.js`
  - `DATA_KEYS` in `src/hooks/useStorage.js`

No schema change required — the `user_data` blob table handles new keys automatically.

### Files added / changed

- Modified: `src/pages/Progress.jsx` (largely rewritten)
- Modified: `src/pages/Progress.css` (new section styles, drop chart styles)
- Created: `src/components/BodyWeightCalendar.jsx` (~120 lines — month grid + editor)
- Created: `src/components/BodyWeightCalendar.css`
- Created: `src/components/BigThreeCard.jsx` (~80 lines — single lift card with add/list)
- Created: `src/components/BigThreeCard.css`

### Out of scope (deferred)

- Charting big-three progress (no recharts here).
- Per-lift PR detection (manual entries are the source of truth).
- Importing existing workout-log strength data into `big_three_logs`.

## Feature 4 — Settings: remove notifications

### Removed

- The `<div ref={sectionRefs.notifications}>…</div>` block in `Settings.jsx`.
- The `useStorage('motaz_notifications', …)` hook call and the local `notifStatus` state.
- The `notifications` entry from the `TILES` array.
- The `notifications` ref entry in `sectionRefs`.
- All `enableNotifications`, `updateNotifPref` helpers in `Settings.jsx`.
- `src/utils/notifications.js` (deleted entirely).
- The `requestPermission`/`scheduleNotifications` imports.
- The notification bootstrap in `src/main.jsx` — lines 5 (`scheduleNotifications` import) and 9–12 (the `try { … prefs.enabled … }` block).

### Storage key cleanup

`motaz_notifications` in localStorage becomes unused. We add a small one-shot cleanup in `src/main.jsx`:

```js
try { localStorage.removeItem('motaz_notifications') } catch {}
```

So old users don't carry the dead key around.

### Translations

Strings starting `st.notif_` removed from `src/i18n/translations.js`.

## Feature 5 — DateStrip: dot if either workout or nutrition data exists

### Change in `src/components/DateStrip.jsx`

```js
const [workoutLogs] = useStorage('workout_logs', [])
const [nutritionLogs] = useStorage('nutrition_logs', [])

const workoutDates = new Set(workoutLogs.filter(l => l.completed).map(l => l.date))
const nutritionDates = new Set(
  nutritionLogs
    .filter(l =>
      (l.meals?.some(m => m.eaten)) ||
      (l.quickLogs?.length > 0) ||
      (l.calorieBump ?? 0) !== 0
    )
    .map(l => l.date)
)

// dot if either set has the date
const hasLog = workoutDates.has(str) || nutritionDates.has(str)
```

Same single dot, same accent color. No style change.

## Out of scope across the whole spec

- Strength chart over time (deferred indefinitely).
- A "history" replacement for the deleted Progress history view.
- Importing old workout logs into the new `big_three_logs` shape.
- Body-weight goal tracking (just logging, no goal line).
- Background / push notifications.
- Editing meals via the Meal-plan section UI — unchanged.

## Files added / changed (full list)

### Added
- `src/components/BodyWeightCalendar.jsx`
- `src/components/BodyWeightCalendar.css`
- `src/components/BigThreeCard.jsx`
- `src/components/BigThreeCard.css`

### Modified
- `src/data/nutritionPlan.js` (DEFAULT_MEALS → [])
- `src/pages/Progress.jsx` (rewrite)
- `src/pages/Progress.css` (drop chart styles, add new sections)
- `src/pages/Nutrition.jsx`, `src/pages/Nutrition.css` (stylized delete button)
- `src/pages/FoodSearchPage.jsx`, `src/pages/FoodSearchPage.css` (Cancel button on portion picker, restyled delete)
- `src/components/FoodSearch.css` (restyled delete on custom rows)
- `src/components/DateStrip.jsx` (nutrition-aware dot)
- `src/pages/Settings.jsx`, `src/pages/Settings.css` (notification section removed)
- `src/main.jsx` (delete lines 5 + 9–12: the `scheduleNotifications` import and the bootstrap try/catch; add a one-shot `localStorage.removeItem('motaz_notifications')` cleanup)
- `src/i18n/translations.js` (remove `st.notif_*` strings)
- `src/components/AuthGuard.jsx` (add `big_three_logs` to SYNC_KEYS)
- `src/lib/sync.js` (add `big_three_logs` to MIGRATABLE_KEYS)
- `src/hooks/useStorage.js` (add `big_three_logs` to DATA_KEYS for export/import)

### Deleted
- `src/utils/notifications.js`

## Success criteria

- Existing meals in localStorage are preserved; new accounts see an empty Meal plan section.
- Delete buttons in Nutrition quick-logs, search custom rows, and portion picker are visually obvious (red, large hit target) — manual visual test on dev server.
- Progress page renders without errors with empty data and with sample data.
- Body weight calendar:
  - Toggles open/closed via the arrow.
  - Remembers state across reloads.
  - Logging a weight on a day shows it in the cell.
  - Tapping a logged day opens the editor pre-filled.
  - Save and Delete work as described.
- Big-three card:
  - Adding an entry persists; the latest entry appears at the top.
  - Deleting an entry persists.
  - Refresh keeps the data.
- The same `big_three_logs` data is visible on a second logged-in device after sync.
- DateStrip shows a dot on days with any workout, nutrition meal-eaten, quick-log, or calorie bump.
- Settings page no longer has a Notifications section. No errors from removed imports.
- `localStorage['motaz_notifications']` is gone after one app load.
- All existing tests still pass.

## Open questions for the plan

- Internationalization for new copy ("Body Weight", "Present Body Weight", "+ Add", "Save", "Cancel") — likely added to translations.js as a small batch with English-only values, or hardcoded. The plan can decide.
- Whether the BodyWeight inline editor should also appear when tapping an *unlogged* day (lets the user backfill missed days), or only on logged days. The spec includes the backfill path; the plan should confirm.
- Whether to keep the existing `bodyWeightLogs` storage key as the source for the calendar (yes — it already exists), or migrate to a new shape. Keeping the existing key.
