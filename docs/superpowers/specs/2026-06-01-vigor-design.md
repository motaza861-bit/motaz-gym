# Vigor — App Design Spec
_Date: 2026-06-01_

## Overview

Vigor is a premium, fully local fitness and nutrition tracking app for high-level gym progression and daily calorie/macro logging. It is subscription-aware (tier-gated UI) but fully offline — no backend, no user accounts, no cloud sync at launch.

**Stack:** React Native · Expo Managed Workflow · Expo Router · NativeWind · MMKV · React Native Reanimated

---

## 1. Project Structure

```
C:\Users\Ehab\Projects\Vigor\
├── app/
│   ├── _layout.tsx              # Root layout — mounts AppProvider
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Bottom tab navigator
│   │   ├── index.tsx            # Home
│   │   ├── workout.tsx          # Workout
│   │   ├── nutrition.tsx        # Nutrition
│   │   ├── progress.tsx         # Progress
│   │   └── schedule.tsx         # Schedule
│   └── settings.tsx             # Full-screen modal: theme toggle + tier switcher
├── contexts/
│   ├── AppProvider.tsx          # Composes ThemeProvider + UserTierProvider
│   ├── ThemeContext.tsx          # Active theme key + setTheme(); persisted in MMKV
│   └── UserTierContext.tsx      # Tier ('Free' | 'Base' | 'Premium_AI') + setTier(); persisted in MMKV
├── theme/
│   ├── tokens.ts                # Spacing, radius, font sizes/weights (shared)
│   └── themes.ts                # Three named palettes (see §4)
├── stores/
│   ├── workoutStore.ts          # MMKV workout log (key: workout:YYYY-MM-DD)
│   └── nutritionStore.ts        # MMKV nutrition log (key: nutrition:YYYY-MM-DD)
├── components/
│   ├── ui/                      # Primitives: Button, Card, Badge, ProgressRing, TierGate
│   ├── home/                    # Home screen sub-components
│   ├── workout/                 # Workout screen sub-components
│   └── locked/                  # Locked overlay UI for TierGate
└── constants/
    └── fonts.ts                 # Font weight constants
```

---

## 2. Navigation

Five-tab bottom navigation via Expo Router file-based routing. Tab order: Home · Workout · Nutrition · Progress · Schedule.

Settings is a modal route (`/settings`) outside the tab group, reachable from any screen via `router.push('/settings')`. It hosts the theme switcher and (in dev builds) a tier override toggle.

---

## 3. State Architecture — Flat Context Stack (Option A)

`AppProvider` composes two independent context providers as siblings:

- **ThemeContext** — exposes `theme: ThemeTokens` and `setTheme(key: ThemeKey)`. Theme key is persisted to MMKV so it survives restarts.
- **UserTierContext** — exposes `tier: 'Free' | 'Base' | 'Premium_AI'` and `setTier()`. In production, `setTier` will be wired to RevenueCat purchase callbacks. For now it is a local MMKV value, togglable from the settings screen in dev builds.

No external state library. Context re-renders are bounded by memoizing each context value with `useMemo`.

---

## 4. Theme System

### Shared Tokens (`theme/tokens.ts`)

| Token     | Values |
|-----------|--------|
| `spacing` | xs:4 · sm:8 · md:16 · lg:24 · xl:32 · xxl:48 |
| `radius`  | sm:6 · md:12 · lg:20 · full:9999 |
| `font.sizes` | xs:11 · sm:13 · md:15 · lg:18 · xl:24 · xxl:32 · display:48 |
| `font.weights` | regular:400 · medium:500 · semibold:600 · bold:700 · black:900 |

### Palettes (`theme/themes.ts`)

| Key | bg | surface | border | accent | accentDim | text | textMuted |
|---|---|---|---|---|---|---|---|
| `DarkAthleticRed` | #000000 | #0F0F0F | #1A1A1A | #FF3B30 | #7A1A15 | #FFFFFF | #6B6B6B |
| `DarkVolt` | #000000 | #0A0A0A | #1C1C1C | #C8FF00 | #5A7200 | #FFFFFF | #666666 |
| `LightMinimal` | #F9F9F9 | #FFFFFF | #EBEBEB | #1A1A1A | #CCCCCC | #0A0A0A | #9A9A9A |

`DarkAthleticRed` is the default. No component hardcodes a hex value — all reference `theme.accent`, `theme.bg`, etc. NativeWind's `cssInterop` bridge maps Tailwind class names to the active theme tokens at runtime.

---

## 5. Data Layer

### MMKV Key Schema

- `workout:YYYY-MM-DD` → `WorkoutLog` JSON
- `nutrition:YYYY-MM-DD` → `DayLog` JSON
- `theme:key` → active theme string
- `user:tier` → tier string

### WorkoutLog Shape

```ts
type WorkoutLog = {
  id: string
  date: string
  splitName: string
  exercises: {
    name: string
    sets: { reps: number; weight: number; completed: boolean }[]
  }[]
}
```

### DayLog Shape

```ts
type DayLog = {
  date: string
  entries: { name: string; calories: number; protein: number; carbs: number; fat: number }[]
  targets: { calories: number; protein: number; carbs: number; fat: number }
}
```

Daily reads are O(1) by date key. The Progress screen scans a rolling 90-day window by iterating known date keys.

---

## 6. Tier Gating

`<TierGate requiredTier="Base">` wraps any locked UI block. It renders children when `tier >= requiredTier`, otherwise renders a `LockedOverlay` with an upgrade CTA.

`Premium_AI` blocks render a distinct "Coming Soon" overlay with a dimmed preview instead of a hard paywall wall — visual presence without false promises.

Tier hierarchy: `Free < Base < Premium_AI`.

---

## 7. Animations

All screen entry animations use a shared `useFadeSlideIn(index: number)` hook built on Reanimated 3:

```ts
// stagger per card: index * 80ms delay, spring easing
withDelay(index * 80, withSpring(targetValue, { damping: 18, stiffness: 120 }))
```

No static reveals on any screen. The `ProgressRing` arc fill also animates on mount with `withTiming(targetFill, { duration: 800, easing: Easing.out(Easing.cubic) })`.

---

## 8. Screen Designs

### Home
- Greeting + today's split name (`display` weight, white)
- `ProgressRing` (SVG arc, accent fill, remaining kcal centered)
- Three quick-add shortcuts: Log Meal · Log Set · Log Weight
- `TierGate Base`: Weekly Consistency 7-day dot grid

### Workout
- Header: split name + elapsed session timer
- Exercise cards with swipeable set rows (reps · weight · checkmark)
- "Add Set" / "Add Exercise" buttons in accent red
- `TierGate Base`: volume trend (last 4 sessions per exercise)

### Nutrition
- Three Reanimated-filled macro bars: Protein · Carbs · Fat
- Large `display`-weight calorie ceiling number
- Daily entry list
- `TierGate Premium_AI`: AI meal suggestion — "Coming Soon" overlay

### Progress
- 2×2 card grid: Bodyweight Trend · Weekly Volume · Consistency Heatmap · PR Timeline
- All four gated behind `Base` tier
- Cards show shimmer placeholder graphic + label when locked (not blank)

### Schedule
- 7-column weekly grid, one cell per day
- Cell shows assigned split name or "Rest"
- Tap → bottom sheet to assign a split
- No tier gate — available to all users

---

## 9. Build Order

1. Scaffold Expo project at `C:\Users\Ehab\Projects\Vigor`, install dependencies, wire 5-tab navigation
2. Implement `ThemeContext` + `UserTierContext` + `AppProvider`; verify theme switching works across all tabs via settings modal
3. Build Home and Workout screen UI (dark athletic theme, Reanimated entry animations)
4. **Pause for approval** before implementing data-logging logic for individual screens

---

## 10. Dependencies

| Package | Purpose |
|---|---|
| `expo-router` | File-based navigation |
| `nativewind` | Tailwind CSS for React Native |
| `react-native-mmkv` | Fast local storage |
| `react-native-reanimated` | Staggered animations |
| `react-native-svg` | ProgressRing arc |
| `expo-status-bar` | Status bar theming |
