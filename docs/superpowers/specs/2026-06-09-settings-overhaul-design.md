# Settings Overhaul Design Spec

**Date:** 2026-06-09
**Status:** Draft (awaiting user approval)

## Goal

Refresh IronMind's Settings page:

1. **Remove** the Import / Export Data section (no longer needed since Supabase syncs everything).
2. **Add** a single Profile card that replaces the duplicate profile inputs inside the macro calculator.
3. **Add** a kg ↔ lbs unit preference, display-only — all storage stays in kg.
4. **Add** a Change Password card inside Account.
5. **Add** a static About card at the bottom.

## Non-goals

- "Download my data" GDPR feature — out of scope for v1 (we keep the `exportAllData`/`importAllData` functions in `useStorage.js` but stop exposing them in the UI; we can re-surface them as a dedicated GDPR endpoint later).
- Server-side password rotation (token revocation, "log out other devices" etc.).
- Email change in-app (Supabase requires email verification for that — defer to a separate spec).
- Storing weights in lbs natively. Display-only conversion only.
- Per-page unit overrides. One global pref via Profile.

## Removal — Import / Export Data section

### What goes
- The entire JSX block in `src/pages/Settings.jsx` rendering the "Data" section (export row + import row + success/error status).
- State: `importStatus`, `timerRef`, the cleanup `useEffect` for the timer.
- The `handleImport` handler.
- The `data` entry from `TILES` and the `data` key from `sectionRefs`.
- The imports `exportAllData`, `importAllData` from `useStorage`.
- Translations: `st.data`, `st.data_sub`, `st.export`, `st.export_label`, `st.export_sub`, `st.import`, `st.import_label`, `st.import_sub`, `st.import_success`, `st.import_error`.

### What stays
- `exportAllData` and `importAllData` in `src/hooks/useStorage.js` — kept for a future GDPR feature, not deleted. No surface area in v1 means no maintenance cost.

## New section layout

TILES at the top become exactly:

```
🎨 Appearance       👤 Profile        💪 Training
🥗 Nutrition        🔒 Account
```

Sections stacked top-to-bottom:

1. **🎨 Appearance** — unchanged
2. **👤 Profile** — NEW; single source of truth for profile fields + unit preference
3. **💪 Training** — unchanged
4. **🥗 Nutrition** — keeps macro calc + targets, but its profile inputs are removed (it reads from Profile)
5. **🔒 Account** — adds Change Password card alongside existing Logout + Delete
6. **ℹ️ About** — NEW; static, at the bottom of the page (no TILE entry)

## Profile card

### UI
```
┌─────────────────────────────────────┐
│ 👤 Profile                          │
├─────────────────────────────────────┤
│ Name        [ Motaz ]                │
│ Email       motaz@example.com        │  ← read-only (from supabase.auth.getUser())
│                                       │
│ Weight      [ 75 ] [kg ▾]            │  ← unit selector (kg | lbs)
│ Height      [ 175 ] cm               │
│ Age         [ 25 ]                   │
│ Gender      [ Male ▾ ]               │
│ Activity    [ Moderate ▾ ]           │
│ Goal        [ Recomp ▾ ]             │
│                                       │
│              [ Save ]                 │
└─────────────────────────────────────┘
```

### Data shape change

The synced `profile` storage gains one optional field:

```js
{
  name, weight, height, age, gender, activityLevel, goal,
  weightUnit: 'kg' | 'lbs', // NEW, default 'kg'
}
```

`weightUnit` defaults to `'kg'` when absent — backwards-compatible.

### Behaviour

- Edits go to a `profileDraft` state. Tapping **Save** commits to `useStorage('profile')`.
- The Weight input shows whatever unit is currently selected; the underlying stored weight value is always kilograms.
- Changing the unit dropdown converts the displayed weight number on the fly, but the saved value in `profile.weight` stays in kg.
- Email is fetched from `supabase.auth.getUser()` on mount and shown read-only.

### Effect on the macro calculator

- The Nutrition section's "Calculate" card loses its weight / height / age / gender / activityLevel / goal inputs.
- It reads from `profile` directly. The Calculate button stays. The "Apply targets" button stays. Daily Targets card stays unchanged.

## Change Password card (inside Account section)

### UI

Collapsed state: a button labeled "Change password" sits between Logout and Delete account.

Expanded state (after tapping the button):

```
Current password    [ ********** ]
New password        [ ********** ]
Confirm new         [ ********** ]

           [ Cancel ]   [ Save ]
```

### Behaviour

1. On Save:
   - Validate inputs: new password ≥ 8 chars, new === confirm.
   - Read the current email via `supabase.auth.getUser()`.
   - Verify the current password: `supabase.auth.signInWithPassword({ email, password: current })`.
     - On error: show "Current password is incorrect." and stop.
   - On success: `supabase.auth.updateUser({ password: new })`.
     - On Supabase error: show its message.
     - On success: collapse the form and show a small "Password updated" toast/inline message that auto-clears in ~3 seconds.

### Errors

- Inline messages above the form for each error type. No modal.

## About card (bottom of Settings)

### UI

```
┌─────────────────────────────────────┐
│ ℹ️  About                            │
├─────────────────────────────────────┤
│  IronMind v1.0.0                      │
│  React + Vite · Supabase · Gemini     │
│  Made by Motaz                        │
│                                       │
│  Privacy Policy              ›        │  ← internal link to /privacy
│  Terms of Service            ›        │  ← internal link to /terms
│  Send feedback               ›        │  ← mailto:adelmotaz861@gmail.com
└─────────────────────────────────────┘
```

### Behaviour

- Static content.
- Version number sourced at build time: in `vite.config.js`, `define: { __APP_VERSION__: JSON.stringify(version) }` reading from `package.json`. The About card uses `__APP_VERSION__`.
- Privacy / Terms use `<Link to="/privacy">` and `<Link to="/terms">`.
- Feedback uses `<a href="mailto:adelmotaz861@gmail.com">`.

## Units preference — display-only conversion

### New helper module

`src/utils/units.js`:

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

### New hook

`src/hooks/useWeightUnit.js`:

```js
import { useStorage } from './useStorage'
const DEFAULT_PROFILE = {}
export function useWeightUnit() {
  const [profile] = useStorage('profile', DEFAULT_PROFILE)
  return profile.weightUnit ?? 'kg'
}
```

This becomes the one-liner consumers use.

### Affected components

| File | What changes |
|---|---|
| `src/pages/Progress.jsx` | Body weight input placeholder; body weight log compute (parse to kg); 1RM estimator input + result + percentages all show in chosen unit |
| `src/components/BigThreeCard.jsx` | "Weight kg" placeholder → `Weight ${unitLabel}`; latest line + history row use `kgToDisplay`; on save, `displayToKg` |
| `src/components/BodyWeightCalendar.jsx` | Input placeholder; cell weights via `kgToDisplay`; on save, `displayToKg` |
| Macro calculator (Profile card) | Weight field uses the unit dropdown next to it; on Calculate, internal computation uses kg |

All storage stays in kg. **No data migration required.** Switching back and forth is lossless to the underlying numbers; only the rounded display value changes.

## Files added / modified

### Added
- `src/utils/units.js`
- `src/hooks/useWeightUnit.js`
- `src/components/AboutCard.jsx`, `src/components/AboutCard.css` (or share Settings.css — implementation detail for plan)
- `src/components/ChangePasswordForm.jsx`, `src/components/ChangePasswordForm.css`
- `tests/utils/units.test.js`

### Modified
- `src/pages/Settings.jsx` — large restructure (remove Data section, add Profile / About / ChangePassword)
- `src/pages/Settings.css` — small additions for new cards
- `src/i18n/translations.js` — drop the `st.data*`/`st.import*`/`st.export*` keys; add `st.profile*`, `st.about*`, `st.change_password*`, `st.unit_kg`, `st.unit_lbs` keys
- `src/pages/Progress.jsx` — units integration
- `src/components/BigThreeCard.jsx` — units integration
- `src/components/BodyWeightCalendar.jsx` — units integration
- `vite.config.js` — `define` block for `__APP_VERSION__`

### Unchanged
- `src/hooks/useStorage.js` — `exportAllData`/`importAllData` kept (dead-code for future GDPR feature)
- Supabase schema — no changes

## Success criteria

- Settings page has no Data section. Import + Export buttons gone.
- Quick-nav tiles show exactly: Appearance, Profile, Training, Nutrition, Account.
- Profile section: editing weight/height/age/gender/activity/goal and tapping Save persists across reload + cross-device.
- Email shown read-only on Profile.
- Toggling `kg` ↔ `lbs` next to Weight converts the number on the fly. Saving leaves the underlying stored value in kg.
- Macro calculator's "Calculate" button works the same — it just reads from `profile` instead of having its own inputs.
- Account section: tapping "Change password", entering correct current + new + confirm successfully changes the Supabase password. Wrong current shows "Current password is incorrect." Logout / Delete buttons unchanged.
- About card shows app version (read from package.json at build), provider/tech credits, and three rows: Privacy / Terms / Feedback.
- Every weight display across Progress, BigThreeCard, and BodyWeightCalendar uses `unitLabel` and `kgToDisplay`.
- `tests/utils/units.test.js` covers kg↔lbs round-trip + edge cases (NaN, empty, 0, large numbers).
- Existing 94 tests still pass; total grows by ~5–7 with the new units tests.

## Open questions for the implementation plan

- Whether to split `Settings.jsx` into a folder of section components. Recommendation: do it as part of this work — the file is already large and gets larger.
- Whether the Profile section should auto-save on field change (no Save button) or require explicit Save. Recommendation: require Save — the macro calc's expected behaviour today is also commit-on-button.
- Whether the unit dropdown lives next to the Weight field (recommended for discoverability) or in a separate "Units" row.
