# IronMind Visual Redesign — Design Spec
**Date:** 2026-05-17
**Status:** Approved

---

## Overview

A full visual overhaul of IronMind replacing the current flat red/black aesthetic with a dynamic theming system. The new default is **Arctic Glass** — deep navy background, frosted glass cards, cyan glow orbs, and SVG macro rings. Users can fully customise the accent colour, card style, and background darkness from the Settings page with changes applying instantly and persisting to localStorage.

---

## 1. CSS Variable Architecture

All colour values across the entire app move to CSS custom properties on `:root`. No hardcoded hex values in component CSS files.

### New variables

```css
:root {
  /* Theme — written by the customiser */
  --accent:        #00E5FF;   /* drives all highlights, rings, glows, borders */
  --accent-dark:   #0099BB;   /* darker shade for gradients, derived from --accent */
  --accent-glow:   rgba(0,229,255,0.2);  /* glow color, derived */
  --bg:            #060A12;   /* base background */
  --bg-card:       #0a1220;   /* card surface (flat mode) */

  /* Static */
  --text:          #e0f4ff;
  --text-muted:    #2a4a5e;
  --text-dim:      #1a3040;
  --border:        rgba(255,255,255,0.06);
  --border-accent: color-mix(in srgb, var(--accent) 15%, transparent);  /* accent-tinted border */
  --radius:        18px;
  --radius-sm:     12px;
  --radius-pill:   20px;
  --font:          'Segoe UI', system-ui, sans-serif;
}
```

`--accent-dark` and `--accent-glow` are derived at runtime in JavaScript when the user picks a colour (by lightening/darkening the hex). A small utility function computes these from `--accent` and writes them to `:root` via `element.style.setProperty`.

### Card style attribute

The `<html>` element gets a `data-card-style` attribute (`"glass"` or `"flat"`). Card CSS uses attribute selectors:

```css
/* Glass (default) */
[data-card-style="glass"] .card {
  background: rgba(255,255,255,0.03);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: inset 0 1px 0 var(--accent-glow), 0 8px 32px rgba(0,0,0,0.3);
}
[data-card-style="glass"] .card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0.25;
}

/* Flat */
[data-card-style="flat"] .card {
  background: var(--bg-card);
  backdrop-filter: none;
}
```

### Background presets

Four named presets map to `--bg` and `--bg-card` values:

| Name   | `--bg`    | `--bg-card` |
|--------|-----------|-------------|
| Abyss  | `#000000` | `#0d0d0d`   |
| Deep   | `#060A12` | `#0a1220`   |
| Dark   | `#0d0d0d` | `#141414`   |
| Void   | `#1a1a2e` | `#1f1f3a`   |

---

## 2. Theme Persistence

A single `useTheme` hook reads and writes theme settings to localStorage key `motaz_theme`.

```js
// Default theme
const DEFAULT_THEME = {
  accent:     '#00E5FF',
  cardStyle:  'glass',      // 'glass' | 'flat'
  bgPreset:   'deep',       // 'abyss' | 'deep' | 'dark' | 'void'
}
```

The hook:
- On mount, reads `motaz_theme` from localStorage, falls back to defaults
- Applies all variables to `:root` and the `data-card-style` attribute immediately
- Exposes `setAccent(hex)`, `setCardStyle(style)`, `setBgPreset(name)` — each persists to localStorage and re-applies
- Derives `--accent-dark` (HSL lightness reduced by 25 percentage points, e.g. `hsl(H, S%, 50%)` → `hsl(H, S%, 25%)`) and `--accent-glow` (accent hex at 20% opacity) from the chosen hex using a tiny colour utility

The hook is called once in `App.jsx` at the top level. No context needed — it operates via CSS variables directly on the document root.

---

## 3. Global Style Changes (index.css)

- Replace `--red`, `--red-dark`, `--red-glow` with `--accent`, `--accent-dark`, `--accent-glow` everywhere
- Default background changes from `#0d0d0d` to `var(--bg)` (Deep preset = `#060A12`)
- `.card` gets the glass/flat dual-mode CSS described above, plus `position: relative; overflow: hidden` to support the top-edge highlight
- `.btn-primary` gradient becomes `linear-gradient(90deg, var(--accent-dark), var(--accent))`
- Glow orbs: add two absolutely-positioned blurred `div`s inside `#root` for the background atmosphere. They inherit `--accent` colour.

---

## 4. Macro Rings Component

A new `MacroRing` component replaces `MacroBar` on the Dashboard nutrition section.

```jsx
// Props
MacroRing({ label, value, target, color? })
```

- Renders an SVG circle with `stroke-dasharray` / `stroke-dashoffset` for progress
- Ring colour defaults to `var(--accent)` for protein, `var(--accent-dark)` for carbs, and `hexToRgba(accent, 0.4)` (accent at 40% opacity) for fat — each passed via the optional `color` prop from the parent
- Shows percentage in the centre as text
- Shows `value`g / `target`g below the ring
- Caps at 100% fill; over-target shows a full ring with a different opacity

The Dashboard nutrition card renders three `MacroRing` components in a flex row, replacing the three `MacroBar` components.

`MacroBar` is kept as-is (still used in Nutrition page detail view).

---

## 5. Background Glow Orbs

Two fixed-position orbs are added to `App.jsx` (or `index.css` via pseudo-elements on `#root`) that paint a subtle atmosphere:

- **Top-right orb:** 200px circle, `var(--accent)` at 5% opacity, blurred 60px, fixed behind all content
- **Bottom-left orb:** 140px circle, `var(--accent)` at 6% opacity, blurred 50px

These are `pointer-events: none`, `z-index: 0`, positioned absolutely inside `#root`. Content sits at `z-index: 1`.

---

## 6. Settings Page — Appearance Section

A new "Appearance" section is added to `Settings.jsx` above the existing sections.

### Accent Colour

- 6 preset colour dots (Cyan, Red, Volt, Gold, Violet, Ember)
- A native `<input type="color">` for fully custom colour, displayed as a row showing the current hex value
- Clicking any preset calls `setAccent(hex)` immediately

### Card Style

- Two-button toggle: **Glass** / **Flat**
- Active option highlighted with `--accent` border

### Background

- 4 swatches in a 2×2 grid: Abyss, Deep, Dark, Void
- Active swatch highlighted with `--accent` border

Changes apply live (no save button needed).

---

## 7. Files Changed

| File | Change |
|------|--------|
| `src/index.css` | New CSS variables, glass/flat card modes, glow orbs, btn-primary update |
| `src/App.jsx` | Call `useTheme()`, add background orb divs |
| `src/hooks/useTheme.js` | New hook — reads/writes/applies theme settings |
| `src/utils/colorUtils.js` | New — `darkenHex(hex, amount)`, `hexToRgba(hex, alpha)` |
| `src/components/MacroRing.jsx` | New component |
| `src/components/MacroRing.css` | New styles |
| `src/pages/Dashboard.jsx` | Replace `MacroBar` → `MacroRing` in nutrition card |
| `src/pages/Settings.jsx` | Add Appearance section at top |
| `src/pages/Settings.css` | Styles for colour picker, toggles, swatches |

All existing page/component CSS files have their hardcoded colour values (`#ff3c3c`, `#0d0d0d`, etc.) replaced with CSS variables.

---

## 8. What Doesn't Change

- App routing, data model, localStorage keys, all functional logic
- `MacroBar` component (kept for Nutrition page)
- All existing page structure and layout
- Test suite — no logic changes, only visual

---

## 9. Out of Scope

- Light mode
- Font customisation
- Animated transitions between theme changes (instant apply is sufficient)
- Per-page theme overrides
