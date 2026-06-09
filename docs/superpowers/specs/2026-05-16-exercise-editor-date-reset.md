# Design: Exercise Editor + Date Reset

**Date:** 2026-05-16  
**Status:** Approved (autonomous design)

---

## Summary

Two small improvements: (1) exercises in the WorkoutLogger become editable inline — the same pattern as meals in Nutrition — so the user can add, edit, and delete exercises per session. (2) The app always opens on today's date, even when the PWA stays in memory across days.

---

## 1. Exercise Editor

### Storage

`useExercises()` (already created for onboarding) provides `[program, setProgram]` where `program = { sessions, daySession }`.

WorkoutLogger already reads from `useExercises()` after the onboarding feature is done.

### UI in WorkoutLogger

Each `ExerciseBlock` gets two optional icon buttons in its header: ✏️ (edit) and 🗑 (delete).

**Edit flow:**
- Tapping ✏️ collapses the ExerciseBlock and shows an `ExerciseEditForm` in its place
- Fields: Name, Sets (number), Reps (string), Rest (seconds), Muscles
- Buttons: Cancel / Save
- Save updates the exercise in `program.sessions[sessionKey].exercises` and persists via `setProgram`

**Delete flow:**
- Tapping 🗑 shows `window.confirm('Delete [name]?')`
- On confirm, removes exercise from the session's list

**Add exercise:**
- A dashed "+ Add exercise" button at the bottom of the workout exercise list
- Opens `ExerciseEditForm` in "new" mode with empty fields
- On save, appends to the session's exercises list with all required fields

### ExerciseEditForm Component

`src/components/ExerciseEditForm.jsx` — follows identical pattern to `MealEditForm` in `MealItem.jsx`.

Props: `{ exercise, onSave, onCancel }`  
- `exercise` is `null` for new, existing object for edit  
- `onSave(updatedExercise)` called on submit  
- `onCancel()` called on cancel

Fields rendered in a 2-column grid: Name (full width), Sets, Reps, Rest (s), Muscles (full width).

### ExerciseBlock Changes

- Add optional `onEdit` and `onDelete` props
- When provided, render icon buttons in `.ex-block-header`
- When `editingId === exercise.name` in WorkoutLogger, render `ExerciseEditForm` instead of `ExerciseBlock`

### WorkoutLogger Changes

- `editingId` state: `null` | `exercise.name` | `'new'`
- `saveExercise(exercise)` — updates or appends in `program.sessions[sessionKey].exercises`
- `deleteExercise(name)` — removes from session
- "+ Add exercise" button below the last ExerciseBlock, hidden when `editingId === 'new'`
- Edit/delete only shown when a workout is **not in progress** (i.e., no sets completed yet) — prevents mid-workout edits corrupting state

---

## 2. Date Reset

### Problem

The PWA stays in memory when backgrounded. If the user viewed Monday's workout, put their phone down, then opened the app the next day, they'd still see Monday. `useState(() => new Date())` only runs on fresh JS initialisation.

### Fix

Add a `visibilitychange` listener in `DateContext.jsx` that resets `selectedDate` to today **only when the calendar day has changed** since the last visibility check.

```js
useEffect(() => {
  const resetIfNewDay = () => {
    if (document.visibilityState === 'visible') {
      setSelectedDate(prev => {
        const today = new Date()
        return prev.toDateString() !== today.toDateString() ? today : prev
      })
    }
  }
  document.addEventListener('visibilitychange', resetIfNewDay)
  return () => document.removeEventListener('visibilitychange', resetIfNewDay)
}, [])
```

This preserves intentional within-day navigation (user chose to look at yesterday) but resets when the calendar day rolls over.

---

## 3. File Changes

| File | Action |
|------|--------|
| `src/components/ExerciseEditForm.jsx` | Create |
| `src/components/ExerciseEditForm.css` | Create |
| `src/components/ExerciseBlock.jsx` | Edit — optional onEdit/onDelete props + buttons |
| `src/components/ExerciseBlock.css` | Edit — edit/delete button styles |
| `src/pages/WorkoutLogger.jsx` | Edit — editingId state, save/delete handlers, "+ Add exercise" button |
| `src/context/DateContext.jsx` | Edit — visibilitychange listener |

---

## Out of Scope

- Reordering exercises via drag-and-drop
- Per-day exercise overrides (different exercises on different days)
- Editing session name or day assignments
