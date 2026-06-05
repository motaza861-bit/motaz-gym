# Vigor Native v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a React Native (Expo, JavaScript) app named **Vigor** at `C:\Users\Ehab\Projects\Vigor` with two working screens — Workout and Nutrition — backed by AsyncStorage and reusing IronMind's `saudiFoods.json`.

**Architecture:** Bottom-tab navigation with two screens. Each screen loads today's record from AsyncStorage on mount and writes back on every state change. No global store, no debouncing, no automated tests in v1. All UI is pure React Native `StyleSheet` — no UI library, no Tailwind, no animation library.

**Tech Stack:** Expo Managed Workflow · React Native · JavaScript · React Navigation (bottom tabs) · `@react-native-async-storage/async-storage` · `react-native-screens` · `react-native-safe-area-context`

**Source spec:** `docs/superpowers/specs/2026-06-05-vigor-native-design.md`

**Working directory note:** Tasks 1–2 run from `C:\Users\Ehab\Projects`. From Task 3 onward, all commands run from `C:\Users\Ehab\Projects\Vigor`. Shell is PowerShell on Windows.

**Verification approach:** No automated tests in v1. Each screen-building task ends with a manual verification step: start the dev server (`npx expo start --web`), use the feature in the browser, and confirm specific behaviors before committing.

---

## File Structure (final state at end of plan)

```
C:\Users\Ehab\Projects\Vigor\
├── App.js                          # Mounts NavigationContainer + AppTabs
├── app.json
├── package.json
├── babel.config.js
├── .gitignore
├── assets/                         # Expo defaults
└── src/
    ├── navigation/
    │   └── AppTabs.js
    ├── screens/
    │   ├── WorkoutScreen.js
    │   └── NutritionScreen.js
    ├── components/
    │   ├── ExerciseCard.js
    │   ├── SetRow.js
    │   ├── FoodPickerModal.js
    │   ├── CustomFoodForm.js
    │   ├── EditGoalsModal.js
    │   └── MacroBar.js
    ├── storage/
    │   ├── workoutStorage.js
    │   └── nutritionStorage.js
    ├── data/
    │   └── saudiFoods.json         # Copied from IronMind
    └── utils/
        ├── date.js
        ├── id.js
        └── portion.js
```

---

## Task 1: Verify prerequisites and create Projects directory

**Files:** None (environment check)

- [ ] **Step 1.1: Confirm Node.js 18+ is installed**

Run:
```powershell
node --version
```
Expected output: `v18.x.x` or higher (e.g. `v20.11.0`). If lower or missing, install Node.js LTS from nodejs.org and re-run.

- [ ] **Step 1.2: Confirm npm is available**

Run:
```powershell
npm --version
```
Expected output: a version like `10.x.x`.

- [ ] **Step 1.3: Ensure parent Projects directory exists**

Run:
```powershell
if (-not (Test-Path "C:\Users\Ehab\Projects")) { New-Item -ItemType Directory -Path "C:\Users\Ehab\Projects" | Out-Null }
Test-Path "C:\Users\Ehab\Projects"
```
Expected output: `True`.

- [ ] **Step 1.4: Confirm Vigor folder does NOT already exist**

Run:
```powershell
Test-Path "C:\Users\Ehab\Projects\Vigor"
```
Expected output: `False`. If `True`, stop and ask the user whether to delete or rename — do not proceed automatically.

---

## Task 2: Scaffold Expo blank (JavaScript) project

**Files:**
- Create: `C:\Users\Ehab\Projects\Vigor\` (entire scaffold by `create-expo-app`)

- [ ] **Step 2.1: Run the Expo scaffold**

Run from `C:\Users\Ehab\Projects`:
```powershell
Set-Location "C:\Users\Ehab\Projects"
npx create-expo-app@latest Vigor --template blank
```
Expected output: a long install log ending with "Your project is ready!" and instructions to `cd Vigor` and `npx expo start`. Takes 1–3 minutes.

- [ ] **Step 2.2: Switch into the new project root**

Run:
```powershell
Set-Location "C:\Users\Ehab\Projects\Vigor"
```

- [ ] **Step 2.3: Verify the scaffold contents**

Run:
```powershell
Get-ChildItem -Force | Select-Object Name | Format-Table -AutoSize
```
Expected output includes at minimum: `App.js`, `app.json`, `package.json`, `babel.config.js`, `.gitignore`, `assets`, `node_modules`.

- [ ] **Step 2.4: Verify the initial git commit was created by Expo**

Run:
```powershell
git log --oneline
```
Expected output: one line, the initial scaffold commit. If `git log` errors with "not a git repository", run:
```powershell
git init
git add .
git commit -m "chore: initial Expo blank scaffold"
```

---

## Task 3: Install navigation and storage dependencies

**Files:**
- Modify: `C:\Users\Ehab\Projects\Vigor\package.json` (npm will update)

- [ ] **Step 3.1: Install all required dependencies in one command**

Use `npx expo install` (not `npm install`) so versions match the Expo SDK.

Run from `C:\Users\Ehab\Projects\Vigor`:
```powershell
npx expo install @react-navigation/native @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context @react-native-async-storage/async-storage
```
Expected output: install log finishing without errors. `package.json` updates the `dependencies` block.

- [ ] **Step 3.2: Verify package.json has the new dependencies**

Run:
```powershell
Get-Content package.json
```
Expected output includes `@react-navigation/native`, `@react-navigation/bottom-tabs`, `react-native-screens`, `react-native-safe-area-context`, and `@react-native-async-storage/async-storage` under `dependencies`.

- [ ] **Step 3.3: Commit**

Run:
```powershell
git add package.json package-lock.json
git commit -m "chore: install navigation and AsyncStorage dependencies"
```

---

## Task 4: Create src/ folder skeleton

**Files:**
- Create: `src/`, `src/navigation/`, `src/screens/`, `src/components/`, `src/storage/`, `src/data/`, `src/utils/`

- [ ] **Step 4.1: Create all empty folders in one command**

Run from `C:\Users\Ehab\Projects\Vigor`:
```powershell
"src","src/navigation","src/screens","src/components","src/storage","src/data","src/utils" | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }
```

- [ ] **Step 4.2: Verify the structure**

Run:
```powershell
Get-ChildItem src -Recurse -Directory | Select-Object FullName
```
Expected: six subdirectories listed under `src/`.

No commit yet — empty folders won't be tracked. Files arrive in later tasks.

---

## Task 5: Implement `src/utils/date.js`

**Files:**
- Create: `src/utils/date.js`

- [ ] **Step 5.1: Define the contract**

The module exports two pure functions:
- `todayKey()` → returns today's date as a `YYYY-MM-DD` string in local time.
- `formatDateHuman(dateKey)` → takes `YYYY-MM-DD` and returns a friendly label like `Friday, June 5`.

- [ ] **Step 5.2: Write the file**

Create `src/utils/date.js`:
```js
export function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateHuman(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
```

- [ ] **Step 5.3: Commit**

```powershell
git add src/utils/date.js
git commit -m "feat: add date utilities (todayKey, formatDateHuman)"
```

---

## Task 6: Implement `src/utils/id.js`

**Files:**
- Create: `src/utils/id.js`

- [ ] **Step 6.1: Write the file**

Create `src/utils/id.js`:
```js
// Short random ID. Good enough for client-side row keys.
// Format: 8 base-36 characters, e.g. "k3a9f2lp".
export function newId() {
  return Math.random().toString(36).slice(2, 10);
}
```

- [ ] **Step 6.2: Commit**

```powershell
git add src/utils/id.js
git commit -m "feat: add newId helper for client-side row keys"
```

---

## Task 7: Implement `src/utils/portion.js`

**Files:**
- Create: `src/utils/portion.js`

- [ ] **Step 7.1: Define the contract**

`scaleByPortion(per100g, grams)` takes a macros object `{ calories, protein, carbs, fat }` representing per-100g values plus a portion size in grams, and returns a new object with the totals for that portion, rounded to 1 decimal.

- [ ] **Step 7.2: Write the file**

Create `src/utils/portion.js`:
```js
function round1(n) {
  return Math.round(n * 10) / 10;
}

export function scaleByPortion(per100g, grams) {
  const factor = grams / 100;
  return {
    calories: Math.round(per100g.calories * factor),
    protein: round1(per100g.protein * factor),
    carbs: round1(per100g.carbs * factor),
    fat: round1(per100g.fat * factor),
  };
}
```

- [ ] **Step 7.3: Commit**

```powershell
git add src/utils/portion.js
git commit -m "feat: add scaleByPortion macro helper"
```

---

## Task 8: Implement `src/storage/workoutStorage.js`

**Files:**
- Create: `src/storage/workoutStorage.js`

- [ ] **Step 8.1: Define the contract**

Module exports two async functions:
- `loadWorkoutDay(dateKey)` → returns the stored day object for `dateKey`, or a fresh empty one `{ date: dateKey, exercises: [] }` if nothing exists.
- `saveWorkoutDay(dateKey, day)` → writes the day object to AsyncStorage under `workout:<dateKey>`.

- [ ] **Step 8.2: Write the file**

Create `src/storage/workoutStorage.js`:
```js
import AsyncStorage from '@react-native-async-storage/async-storage';

function keyFor(dateKey) {
  return `workout:${dateKey}`;
}

export async function loadWorkoutDay(dateKey) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(dateKey));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // Fall through to empty default on parse or read errors.
  }
  return { date: dateKey, exercises: [] };
}

export async function saveWorkoutDay(dateKey, day) {
  await AsyncStorage.setItem(keyFor(dateKey), JSON.stringify(day));
}
```

- [ ] **Step 8.3: Commit**

```powershell
git add src/storage/workoutStorage.js
git commit -m "feat: add workout day AsyncStorage wrapper"
```

---

## Task 9: Implement `src/storage/nutritionStorage.js`

**Files:**
- Create: `src/storage/nutritionStorage.js`

- [ ] **Step 9.1: Define the contract**

Exports four async functions:
- `loadNutritionDay(dateKey)` → returns `{ date, entries: [] }` if nothing stored.
- `saveNutritionDay(dateKey, day)` → writes to `nutrition:<dateKey>`.
- `loadTargets()` → returns saved targets or defaults `{ calories: 2500, protein: 180, carbs: 250, fat: 70 }`.
- `saveTargets(targets)` → writes to `nutrition:targets`.

- [ ] **Step 9.2: Write the file**

Create `src/storage/nutritionStorage.js`:
```js
import AsyncStorage from '@react-native-async-storage/async-storage';

const TARGETS_KEY = 'nutrition:targets';
const DEFAULT_TARGETS = { calories: 2500, protein: 180, carbs: 250, fat: 70 };

function dayKey(dateKey) {
  return `nutrition:${dateKey}`;
}

export async function loadNutritionDay(dateKey) {
  try {
    const raw = await AsyncStorage.getItem(dayKey(dateKey));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // Fall through to empty default.
  }
  return { date: dateKey, entries: [] };
}

export async function saveNutritionDay(dateKey, day) {
  await AsyncStorage.setItem(dayKey(dateKey), JSON.stringify(day));
}

export async function loadTargets() {
  try {
    const raw = await AsyncStorage.getItem(TARGETS_KEY);
    if (raw) return { ...DEFAULT_TARGETS, ...JSON.parse(raw) };
  } catch (e) {
    // Fall through to defaults.
  }
  return { ...DEFAULT_TARGETS };
}

export async function saveTargets(targets) {
  await AsyncStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
}
```

- [ ] **Step 9.3: Commit**

```powershell
git add src/storage/nutritionStorage.js
git commit -m "feat: add nutrition day and targets AsyncStorage wrapper"
```

---

## Task 10: Create placeholder screens

**Files:**
- Create: `src/screens/WorkoutScreen.js` (placeholder)
- Create: `src/screens/NutritionScreen.js` (placeholder)

- [ ] **Step 10.1: Write the workout placeholder**

Create `src/screens/WorkoutScreen.js`:
```js
import { SafeAreaView, Text, StyleSheet } from 'react-native';

export default function WorkoutScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Workout (placeholder)</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600' },
});
```

- [ ] **Step 10.2: Write the nutrition placeholder**

Create `src/screens/NutritionScreen.js`:
```js
import { SafeAreaView, Text, StyleSheet } from 'react-native';

export default function NutritionScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Nutrition (placeholder)</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600' },
});
```

- [ ] **Step 10.3: Commit**

```powershell
git add src/screens/WorkoutScreen.js src/screens/NutritionScreen.js
git commit -m "feat: add placeholder Workout and Nutrition screens"
```

---

## Task 11: Implement `src/navigation/AppTabs.js`

**Files:**
- Create: `src/navigation/AppTabs.js`

- [ ] **Step 11.1: Write the navigator**

Create `src/navigation/AppTabs.js`:
```js
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import WorkoutScreen from '../screens/WorkoutScreen';
import NutritionScreen from '../screens/NutritionScreen';

const Tab = createBottomTabNavigator();

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF3B30',
        tabBarInactiveTintColor: '#888',
      }}
    >
      <Tab.Screen name="Workout" component={WorkoutScreen} />
      <Tab.Screen name="Nutrition" component={NutritionScreen} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 11.2: Commit**

```powershell
git add src/navigation/AppTabs.js
git commit -m "feat: add bottom-tab navigator wiring Workout and Nutrition"
```

---

## Task 12: Replace `App.js` to mount the navigator

**Files:**
- Modify: `App.js` (overwrite the Expo default)

- [ ] **Step 12.1: Overwrite `App.js`**

Replace the entire contents of `App.js` with:
```js
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AppTabs from './src/navigation/AppTabs';

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <AppTabs />
    </NavigationContainer>
  );
}
```

- [ ] **Step 12.2: Commit**

```powershell
git add App.js
git commit -m "feat: mount NavigationContainer with bottom-tab navigator in App.js"
```

---

## Task 13: First end-to-end verification in the browser

**Files:** None (verification only)

- [ ] **Step 13.1: Start the Expo dev server (web)**

Run from `C:\Users\Ehab\Projects\Vigor`:
```powershell
npx expo start --web
```
Expected: Metro bundler starts, a browser tab opens to a local URL (usually `http://localhost:8081`).

- [ ] **Step 13.2: Manually verify**

In the browser:
- A bottom tab bar is visible with two tabs: **Workout** and **Nutrition**
- The Workout tab shows "Workout (placeholder)"
- Tapping **Nutrition** switches to "Nutrition (placeholder)"
- Tapping back to **Workout** switches back
- The console (browser devtools) shows no red errors

- [ ] **Step 13.3: Stop the dev server**

Press `Ctrl+C` in the terminal running `expo start`.

If verification failed, do NOT proceed. Common issues:
- "Module not found" → re-run `npx expo install` from Task 3 and restart the dev server
- Tabs invisible → ensure `react-native-screens` and `react-native-safe-area-context` are installed (Task 3)
- White screen with no errors → check that `AppTabs.js` correctly imports both screen files and that screen filenames match exactly (`WorkoutScreen.js`, `NutritionScreen.js`)

---

## Task 14: Implement `src/components/SetRow.js`

**Files:**
- Create: `src/components/SetRow.js`

- [ ] **Step 14.1: Define the contract**

Renders a single set: a reps input, an `×` separator, a weight input, and a delete button. Props:
- `set: { id, reps, weight }`
- `onChange(patch)` — called with `{ reps?, weight? }` when either input changes (numbers)
- `onDelete()` — called when the trash button is tapped

- [ ] **Step 14.2: Write the file**

Create `src/components/SetRow.js`:
```js
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';

export default function SetRow({ set, onChange, onDelete }) {
  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={String(set.reps ?? '')}
        onChangeText={(t) => onChange({ reps: Number(t) || 0 })}
        placeholder="reps"
      />
      <Text style={styles.x}>×</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={String(set.weight ?? '')}
        onChangeText={(t) => onChange({ weight: Number(t) || 0 })}
        placeholder="kg"
      />
      <Pressable onPress={onDelete} style={styles.delete}>
        <Text style={styles.deleteText}>🗑</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 60,
    textAlign: 'center',
  },
  x: { fontSize: 16, color: '#888' },
  delete: { marginLeft: 'auto', padding: 6 },
  deleteText: { fontSize: 16 },
});
```

- [ ] **Step 14.3: Commit**

```powershell
git add src/components/SetRow.js
git commit -m "feat: add SetRow component (reps × weight + delete)"
```

---

## Task 15: Implement `src/components/ExerciseCard.js`

**Files:**
- Create: `src/components/ExerciseCard.js`

- [ ] **Step 15.1: Define the contract**

Renders one exercise (header with name + delete) and its sets, plus an "Add Set" button. Props:
- `exercise: { id, name, sets: [...] }`
- `onSetChange(setId, patch)`
- `onAddSet()`
- `onDeleteSet(setId)`
- `onDeleteExercise()`

- [ ] **Step 15.2: Write the file**

Create `src/components/ExerciseCard.js`:
```js
import { View, Text, Pressable, StyleSheet } from 'react-native';
import SetRow from './SetRow';

export default function ExerciseCard({
  exercise,
  onSetChange,
  onAddSet,
  onDeleteSet,
  onDeleteExercise,
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{exercise.name}</Text>
        <Pressable onPress={onDeleteExercise} style={styles.deleteExercise}>
          <Text>🗑</Text>
        </Pressable>
      </View>

      {exercise.sets.map((s) => (
        <SetRow
          key={s.id}
          set={s}
          onChange={(patch) => onSetChange(s.id, patch)}
          onDelete={() => onDeleteSet(s.id)}
        />
      ))}

      <Pressable onPress={onAddSet} style={styles.addSet}>
        <Text style={styles.addSetText}>+ Add Set</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '600', flex: 1 },
  deleteExercise: { padding: 4 },
  addSet: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  addSetText: { color: '#FF3B30', fontWeight: '600' },
});
```

- [ ] **Step 15.3: Commit**

```powershell
git add src/components/ExerciseCard.js
git commit -m "feat: add ExerciseCard component (header, sets, add-set)"
```

---

## Task 16: Build the real `WorkoutScreen.js`

**Files:**
- Modify: `src/screens/WorkoutScreen.js` (replace the placeholder)

- [ ] **Step 16.1: Plan the behavior**

On mount, load today's workout day from storage. State holds the day object. Every handler updates state immutably and persists the new day. "Add Exercise" prompts via `Alert.prompt` on iOS / a simple inline modal-free input via `prompt()` on web (we'll use a small textinput-and-button at the bottom for cross-platform simplicity).

- [ ] **Step 16.2: Overwrite the file**

Replace the contents of `src/screens/WorkoutScreen.js` with:
```js
import { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import ExerciseCard from '../components/ExerciseCard';
import { loadWorkoutDay, saveWorkoutDay } from '../storage/workoutStorage';
import { todayKey, formatDateHuman } from '../utils/date';
import { newId } from '../utils/id';

export default function WorkoutScreen() {
  const dateKey = todayKey();
  const [day, setDay] = useState(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    let mounted = true;
    loadWorkoutDay(dateKey).then((d) => {
      if (mounted) setDay(d);
    });
    return () => {
      mounted = false;
    };
  }, [dateKey]);

  function persist(next) {
    setDay(next);
    saveWorkoutDay(dateKey, next);
  }

  function addExercise() {
    const name = newName.trim();
    if (!name) return;
    const next = {
      ...day,
      exercises: [
        ...day.exercises,
        { id: newId(), name, sets: [] },
      ],
    };
    persist(next);
    setNewName('');
  }

  function deleteExercise(id) {
    persist({ ...day, exercises: day.exercises.filter((e) => e.id !== id) });
  }

  function addSet(exerciseId) {
    const next = {
      ...day,
      exercises: day.exercises.map((e) => {
        if (e.id !== exerciseId) return e;
        const prev = e.sets[e.sets.length - 1];
        return {
          ...e,
          sets: [
            ...e.sets,
            { id: newId(), reps: prev?.reps ?? 0, weight: prev?.weight ?? 0 },
          ],
        };
      }),
    };
    persist(next);
  }

  function changeSet(exerciseId, setId, patch) {
    const next = {
      ...day,
      exercises: day.exercises.map((e) => {
        if (e.id !== exerciseId) return e;
        return {
          ...e,
          sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
        };
      }),
    };
    persist(next);
  }

  function deleteSet(exerciseId, setId) {
    const next = {
      ...day,
      exercises: day.exercises.map((e) => {
        if (e.id !== exerciseId) return e;
        return { ...e, sets: e.sets.filter((s) => s.id !== setId) };
      }),
    };
    persist(next);
  }

  if (!day) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Today's Workout</Text>
        <Text style={styles.date}>{formatDateHuman(dateKey)}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {day.exercises.map((e) => (
          <ExerciseCard
            key={e.id}
            exercise={e}
            onSetChange={(setId, patch) => changeSet(e.id, setId, patch)}
            onAddSet={() => addSet(e.id)}
            onDeleteSet={(setId) => deleteSet(e.id, setId)}
            onDeleteExercise={() => deleteExercise(e.id)}
          />
        ))}

        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="New exercise name"
            value={newName}
            onChangeText={setNewName}
          />
          <Pressable style={styles.addBtn} onPress={addExercise}>
            <Text style={styles.addBtnText}>+ Add Exercise</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  date: { fontSize: 13, color: '#888', marginTop: 2 },
  list: { padding: 16, paddingBottom: 80 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addBtn: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addBtnText: { color: '#FFF', fontWeight: '700' },
});
```

- [ ] **Step 16.3: Commit**

```powershell
git add src/screens/WorkoutScreen.js
git commit -m "feat: build Workout screen with persisted exercises and sets"
```

---

## Task 17: Manual verification of the Workout screen

**Files:** None (verification only)

- [ ] **Step 17.1: Start the dev server**

Run:
```powershell
npx expo start --web
```

- [ ] **Step 17.2: Verify in the browser**

On the Workout tab:
- Header shows "Today's Workout" with today's date underneath
- Type "Bench Press" in the input, tap "+ Add Exercise" → an Exercise card appears
- On the new card, tap "+ Add Set" → a row with two empty inputs and a trash icon appears
- Type `10` in reps and `60` in weight, then tap "+ Add Set" again → second set pre-fills with `10` and `60`
- Edit the second set to `8` and `65`
- Refresh the browser tab → the same exercise and both sets are still there
- Tap the trash icon on a set → the set disappears
- Tap the trash icon on the exercise header → the entire card disappears
- Add another exercise to confirm the flow still works

- [ ] **Step 17.3: Stop the dev server**

`Ctrl+C`.

If any step failed, do NOT proceed until fixed.

---

## Task 18: Copy `saudiFoods.json` from IronMind

**Files:**
- Create: `src/data/saudiFoods.json` (copied verbatim)

- [ ] **Step 18.1: Copy the file**

Run from `C:\Users\Ehab\Projects\Vigor`:
```powershell
Copy-Item "C:\Users\Ehab\.local\bin\IronMind\src\data\saudiFoods.json" "src\data\saudiFoods.json"
```

- [ ] **Step 18.2: Verify the file**

Run:
```powershell
(Get-Item "src\data\saudiFoods.json").Length
```
Expected: a number around `26000` (≈26 KB). If `0` or missing, re-run the copy.

- [ ] **Step 18.3: Commit**

```powershell
git add src/data/saudiFoods.json
git commit -m "feat: vendor saudiFoods.json from IronMind"
```

---

## Task 19: Implement `src/components/MacroBar.js`

**Files:**
- Create: `src/components/MacroBar.js`

- [ ] **Step 19.1: Define the contract**

Props:
- `label: string` (e.g. "Protein")
- `current: number` (grams)
- `target: number` (grams)
- `color: string` (bar fill color)

Renders a label row showing `"<label>   <current>g / <target>g"` and a horizontal progress bar. Width clamps to 100% even when over target.

- [ ] **Step 19.2: Write the file**

Create `src/components/MacroBar.js`:
```js
import { View, Text, StyleSheet } from 'react-native';

export default function MacroBar({ label, current, target, color }) {
  const ratio = target > 0 ? Math.min(current / target, 1) : 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.values}>
          {Math.round(current)}g / {Math.round(target)}g
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontWeight: '600' },
  values: { color: '#666' },
  track: { height: 8, backgroundColor: '#EEE', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%' },
});
```

- [ ] **Step 19.3: Commit**

```powershell
git add src/components/MacroBar.js
git commit -m "feat: add MacroBar component (label, current/target, fill)"
```

---

## Task 20: Implement `src/components/CustomFoodForm.js`

**Files:**
- Create: `src/components/CustomFoodForm.js`

- [ ] **Step 20.1: Define the contract**

Standalone modal-content component (not a `Modal` itself; the parent owns the `Modal`). Props:
- `onSave({ name, calories, protein, carbs, fat })` — parent handles entry creation
- `onCancel()`

Five inputs: name (text), calories, protein, carbs, fat (numeric). Save button is disabled until name is non-empty.

- [ ] **Step 20.2: Write the file**

Create `src/components/CustomFoodForm.js`:
```js
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

export default function CustomFoodForm({ onSave, onCancel }) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const canSave = name.trim().length > 0;

  function handleSave() {
    onSave({
      name: name.trim(),
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
    });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Add custom food</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Protein shake" />

      <Text style={styles.label}>Calories (kcal)</Text>
      <TextInput style={styles.input} value={calories} onChangeText={setCalories} keyboardType="numeric" />

      <Text style={styles.label}>Protein (g)</Text>
      <TextInput style={styles.input} value={protein} onChangeText={setProtein} keyboardType="numeric" />

      <Text style={styles.label}>Carbs (g)</Text>
      <TextInput style={styles.input} value={carbs} onChangeText={setCarbs} keyboardType="numeric" />

      <Text style={styles.label}>Fat (g)</Text>
      <TextInput style={styles.input} value={fat} onChangeText={setFat} keyboardType="numeric" />

      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.cancel]} onPress={onCancel}>
          <Text>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.save, !canSave && styles.disabled]}
          onPress={canSave ? handleSave : undefined}
        >
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, backgroundColor: '#FFF', borderRadius: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 12, color: '#666', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancel: { backgroundColor: '#EEE' },
  save: { backgroundColor: '#FF3B30' },
  disabled: { opacity: 0.4 },
  saveText: { color: '#FFF', fontWeight: '700' },
});
```

- [ ] **Step 20.3: Commit**

```powershell
git add src/components/CustomFoodForm.js
git commit -m "feat: add CustomFoodForm (manual food entry)"
```

---

## Task 21: Implement `src/components/FoodPickerModal.js`

**Files:**
- Create: `src/components/FoodPickerModal.js`

- [ ] **Step 21.1: Define the contract**

Modal-content component (parent owns `Modal`). Two phases:
1. **List** — search box, category chips, scrollable list of foods. Tapping a food enters the portion phase.
2. **Portion** — shows selected food + a grams input pre-filled with `defaultPortion`, plus Save/Back buttons.

Props:
- `foods` — the array imported from `saudiFoods.json`
- `onSave({ foodId, grams, computed, name, emoji })` — parent receives all info needed to build a nutrition entry
- `onCancel()`

Use the `scaleByPortion` helper from `src/utils/portion.js`.

- [ ] **Step 21.2: Write the file**

Create `src/components/FoodPickerModal.js`:
```js
import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { scaleByPortion } from '../utils/portion';

function uniqueCategories(foods) {
  const set = new Set(foods.map((f) => f.category));
  return Array.from(set);
}

export default function FoodPickerModal({ foods, onSave, onCancel }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [selected, setSelected] = useState(null);
  const [grams, setGrams] = useState('');

  const categories = useMemo(() => uniqueCategories(foods), [foods]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods.filter((f) => {
      if (category && f.category !== category) return false;
      if (!q) return true;
      return f.name.toLowerCase().includes(q);
    });
  }, [foods, query, category]);

  function pickFood(food) {
    setSelected(food);
    setGrams(String(food.defaultPortion));
  }

  function saveEntry() {
    const g = Number(grams) || 0;
    if (g <= 0) return;
    const computed = scaleByPortion(selected.per100g, g);
    onSave({
      foodId: selected.id,
      name: selected.name,
      emoji: selected.emoji,
      grams: g,
      computed,
    });
  }

  if (selected) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>
          {selected.emoji} {selected.name}
        </Text>
        <Text style={styles.sub}>{selected.nameAr}</Text>

        <Text style={styles.label}>Portion (grams)</Text>
        <TextInput
          style={styles.input}
          value={grams}
          onChangeText={setGrams}
          keyboardType="numeric"
        />

        <View style={styles.actions}>
          <Pressable style={[styles.btn, styles.cancel]} onPress={() => setSelected(null)}>
            <Text>Back</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.save]} onPress={saveEntry}>
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Pick a food</Text>

      <TextInput
        style={styles.input}
        placeholder="Search foods…"
        value={query}
        onChangeText={setQuery}
      />

      <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
        <Pressable
          style={[styles.chip, !category && styles.chipActive]}
          onPress={() => setCategory(null)}
        >
          <Text style={!category ? styles.chipTextActive : styles.chipText}>All</Text>
        </Pressable>
        {categories.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, category === c && styles.chipActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={category === c ? styles.chipTextActive : styles.chipText}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.list}>
        {filtered.map((f) => (
          <Pressable key={f.id} style={styles.row} onPress={() => pickFood(f)}>
            <Text style={styles.emoji}>{f.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{f.name}</Text>
              <Text style={styles.nameAr}>{f.nameAr}</Text>
            </View>
            <Text style={styles.kcal}>{f.per100g.calories} kcal/100g</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.cancel]} onPress={onCancel}>
          <Text>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, backgroundColor: '#FFF', borderRadius: 12, flex: 1 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  sub: { color: '#666', marginBottom: 8 },
  label: { fontSize: 12, color: '#666', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  chips: { gap: 6, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#EEE' },
  chipActive: { backgroundColor: '#FF3B30' },
  chipText: { color: '#333' },
  chipTextActive: { color: '#FFF', fontWeight: '600' },
  list: { flex: 1, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 8,
  },
  emoji: { fontSize: 20 },
  name: { fontWeight: '600' },
  nameAr: { color: '#888', fontSize: 12 },
  kcal: { color: '#666', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancel: { backgroundColor: '#EEE' },
  save: { backgroundColor: '#FF3B30' },
  saveText: { color: '#FFF', fontWeight: '700' },
});
```

- [ ] **Step 21.3: Commit**

```powershell
git add src/components/FoodPickerModal.js
git commit -m "feat: add FoodPickerModal with search, category filter, and portion step"
```

---

## Task 22: Implement `src/components/EditGoalsModal.js`

**Files:**
- Create: `src/components/EditGoalsModal.js`

- [ ] **Step 22.1: Define the contract**

Modal-content component. Props:
- `targets: { calories, protein, carbs, fat }`
- `onSave(nextTargets)`
- `onCancel()`

Four numeric inputs pre-filled with current targets. Save button always enabled.

- [ ] **Step 22.2: Write the file**

Create `src/components/EditGoalsModal.js`:
```js
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

export default function EditGoalsModal({ targets, onSave, onCancel }) {
  const [calories, setCalories] = useState(String(targets.calories));
  const [protein, setProtein] = useState(String(targets.protein));
  const [carbs, setCarbs] = useState(String(targets.carbs));
  const [fat, setFat] = useState(String(targets.fat));

  function handleSave() {
    onSave({
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
    });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Edit daily goals</Text>

      <Text style={styles.label}>Calories (kcal)</Text>
      <TextInput style={styles.input} value={calories} onChangeText={setCalories} keyboardType="numeric" />

      <Text style={styles.label}>Protein (g)</Text>
      <TextInput style={styles.input} value={protein} onChangeText={setProtein} keyboardType="numeric" />

      <Text style={styles.label}>Carbs (g)</Text>
      <TextInput style={styles.input} value={carbs} onChangeText={setCarbs} keyboardType="numeric" />

      <Text style={styles.label}>Fat (g)</Text>
      <TextInput style={styles.input} value={fat} onChangeText={setFat} keyboardType="numeric" />

      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.cancel]} onPress={onCancel}>
          <Text>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.save]} onPress={handleSave}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, backgroundColor: '#FFF', borderRadius: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 12, color: '#666', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancel: { backgroundColor: '#EEE' },
  save: { backgroundColor: '#FF3B30' },
  saveText: { color: '#FFF', fontWeight: '700' },
});
```

- [ ] **Step 22.3: Commit**

```powershell
git add src/components/EditGoalsModal.js
git commit -m "feat: add EditGoalsModal for nutrition targets"
```

---

## Task 23: Build the real `NutritionScreen.js`

**Files:**
- Modify: `src/screens/NutritionScreen.js` (replace placeholder)

- [ ] **Step 23.1: Plan behavior**

State holds `day`, `targets`, and three modal flags (`pickerOpen`, `customOpen`, `goalsOpen`). On mount, load both day and targets in parallel. Compute totals from `day.entries[].computed`. Persist on every mutation.

- [ ] **Step 23.2: Overwrite the file**

Replace the contents of `src/screens/NutritionScreen.js` with:
```js
import { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
} from 'react-native';
import MacroBar from '../components/MacroBar';
import FoodPickerModal from '../components/FoodPickerModal';
import CustomFoodForm from '../components/CustomFoodForm';
import EditGoalsModal from '../components/EditGoalsModal';
import {
  loadNutritionDay,
  saveNutritionDay,
  loadTargets,
  saveTargets,
} from '../storage/nutritionStorage';
import { todayKey, formatDateHuman } from '../utils/date';
import { newId } from '../utils/id';
import foods from '../data/saudiFoods.json';

function sumTotals(entries) {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.computed?.calories || 0),
      protein: acc.protein + (e.computed?.protein || 0),
      carbs: acc.carbs + (e.computed?.carbs || 0),
      fat: acc.fat + (e.computed?.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export default function NutritionScreen() {
  const dateKey = todayKey();
  const [day, setDay] = useState(null);
  const [targets, setTargets] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadNutritionDay(dateKey), loadTargets()]).then(([d, t]) => {
      if (!mounted) return;
      setDay(d);
      setTargets(t);
    });
    return () => {
      mounted = false;
    };
  }, [dateKey]);

  function persistDay(next) {
    setDay(next);
    saveNutritionDay(dateKey, next);
  }

  function persistTargets(next) {
    setTargets(next);
    saveTargets(next);
  }

  function addSaudiEntry({ foodId, name, emoji, grams, computed }) {
    const entry = {
      id: newId(),
      source: 'saudi',
      foodId,
      name,
      emoji,
      grams,
      computed,
    };
    persistDay({ ...day, entries: [...day.entries, entry] });
    setPickerOpen(false);
  }

  function addCustomEntry({ name, calories, protein, carbs, fat }) {
    const entry = {
      id: newId(),
      source: 'custom',
      name,
      computed: { calories, protein, carbs, fat },
    };
    persistDay({ ...day, entries: [...day.entries, entry] });
    setCustomOpen(false);
  }

  function deleteEntry(id) {
    persistDay({ ...day, entries: day.entries.filter((e) => e.id !== id) });
  }

  if (!day || !targets) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading…</Text>
      </SafeAreaView>
    );
  }

  const totals = sumTotals(day.entries);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Today</Text>
          <Text style={styles.date}>{formatDateHuman(dateKey)}</Text>
        </View>
        <Pressable onPress={() => setGoalsOpen(true)}>
          <Text style={styles.editGoals}>Edit goals</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.summary}>
          <Text style={styles.calories}>
            {totals.calories} / {targets.calories} kcal
          </Text>
          <MacroBar label="Protein" current={totals.protein} target={targets.protein} color="#FF3B30" />
          <MacroBar label="Carbs"   current={totals.carbs}   target={targets.carbs}   color="#FFB020" />
          <MacroBar label="Fat"     current={totals.fat}     target={targets.fat}     color="#34C759" />
        </View>

        <View style={styles.entriesHeader}>
          <Text style={styles.sectionTitle}>Entries</Text>
        </View>

        {day.entries.length === 0 ? (
          <Text style={styles.empty}>No food logged yet today.</Text>
        ) : (
          day.entries.map((e) => (
            <View key={e.id} style={styles.entryRow}>
              <Text style={styles.entryEmoji}>{e.emoji ?? '🍽'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryName}>{e.name}</Text>
                <Text style={styles.entryMeta}>
                  {e.computed.calories} kcal · P {e.computed.protein}g · C {e.computed.carbs}g · F {e.computed.fat}g
                </Text>
              </View>
              <Pressable onPress={() => deleteEntry(e.id)} style={styles.entryDelete}>
                <Text>🗑</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.footerBtn, styles.pickBtn]} onPress={() => setPickerOpen(true)}>
          <Text style={styles.footerBtnText}>Pick food</Text>
        </Pressable>
        <Pressable style={[styles.footerBtn, styles.customBtn]} onPress={() => setCustomOpen(true)}>
          <Text style={styles.footerBtnText}>Add custom</Text>
        </Pressable>
      </View>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <FoodPickerModal foods={foods} onSave={addSaudiEntry} onCancel={() => setPickerOpen(false)} />
        </SafeAreaView>
      </Modal>

      <Modal visible={customOpen} animationType="slide" transparent onRequestClose={() => setCustomOpen(false)}>
        <View style={styles.modalBackdrop}>
          <CustomFoodForm onSave={addCustomEntry} onCancel={() => setCustomOpen(false)} />
        </View>
      </Modal>

      <Modal visible={goalsOpen} animationType="slide" transparent onRequestClose={() => setGoalsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <EditGoalsModal
            targets={targets}
            onSave={(t) => {
              persistTargets(t);
              setGoalsOpen(false);
            }}
            onCancel={() => setGoalsOpen(false)}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  date: { fontSize: 13, color: '#888', marginTop: 2 },
  editGoals: { color: '#FF3B30', fontWeight: '600' },
  body: { padding: 16, paddingBottom: 120 },
  summary: { marginBottom: 16 },
  calories: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  entriesHeader: { marginTop: 8, marginBottom: 4 },
  sectionTitle: { fontWeight: '700', fontSize: 16 },
  empty: { color: '#888', marginTop: 8 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 8,
  },
  entryEmoji: { fontSize: 20 },
  entryName: { fontWeight: '600' },
  entryMeta: { color: '#666', fontSize: 12, marginTop: 2 },
  entryDelete: { padding: 6 },
  footer: {
    position: 'absolute',
    bottom: 70,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  footerBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  footerBtnText: { color: '#FFF', fontWeight: '700' },
  pickBtn: { backgroundColor: '#FF3B30' },
  customBtn: { backgroundColor: '#333' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 16,
  },
});
```

- [ ] **Step 23.3: Commit**

```powershell
git add src/screens/NutritionScreen.js
git commit -m "feat: build Nutrition screen with picker, custom form, goals, persistence"
```

---

## Task 24: Manual verification of the Nutrition screen

**Files:** None (verification only)

- [ ] **Step 24.1: Start the dev server**

```powershell
npx expo start --web
```

- [ ] **Step 24.2: Verify the picker flow**

On the Nutrition tab:
- Header shows "Today" + today's date and an "Edit goals" link on the right
- The calorie line reads `0 / 2500 kcal`
- All three macro bars are empty
- Tap **Pick food** → modal opens with a search box, "All" chip plus category chips, and a scrollable list
- Tap a category chip (e.g. "traditional") → list filters
- Tap "All" → list resets
- Type `kabsa` in search → list narrows to Kabsa entries
- Tap "Kabsa (Chicken)" → portion screen shows the name + Arabic name + grams input pre-filled with `400`
- Tap **Save** → modal closes, the entry appears in the Entries list with the computed totals, and the calorie line + macro bars reflect the addition

- [ ] **Step 24.3: Verify the custom flow**

- Tap **Add custom** → modal opens
- Enter `Protein shake`, `220`, `40`, `10`, `2`
- Save button enables once name is filled
- Tap **Save** → entry appears with those macros, totals update

- [ ] **Step 24.4: Verify delete + persistence**

- Tap 🗑 on any entry → entry disappears, totals update
- Refresh the browser tab → remaining entries are still there and totals match

- [ ] **Step 24.5: Verify Edit goals**

- Tap **Edit goals** → modal opens with current targets pre-filled
- Change calories to `2200` and protein to `160`, Save
- Modal closes, calorie line and protein bar reflect new targets
- Refresh the page → new targets persist

- [ ] **Step 24.6: Stop the dev server**

`Ctrl+C`.

If any step failed, do NOT proceed until fixed.

---

## Task 25: Final integration check and review checkpoint

**Files:** None

- [ ] **Step 25.1: Verify cross-tab persistence**

- Start the dev server.
- On the Workout tab, add an exercise and a set.
- Switch to the Nutrition tab, add a picked food and a custom food, edit goals.
- Switch back to Workout — the exercise and set are still there.
- Refresh the browser tab — all changes persist across both tabs.

- [ ] **Step 25.2: Inspect storage in the browser**

Open browser devtools → Application → Local Storage → the localhost origin. Confirm three categories of keys exist:
- `workout:YYYY-MM-DD`
- `nutrition:YYYY-MM-DD`
- `nutrition:targets`

Each value should be a JSON string matching the spec's data model.

- [ ] **Step 25.3: Stop the dev server and review commit log**

```powershell
git log --oneline
```
Expected: roughly 17–20 commits in this branch, starting from the Expo scaffold commit and ending with the Nutrition screen.

- [ ] **Step 25.4: Pause for user review**

Surface the following to the user:
- A summary of what works (Workout, Nutrition, persistence, goals)
- A reminder of what is intentionally out of scope (history, charts, AI scanner, schedule, themes, i18n, etc.)
- Ask whether they want to (a) iterate on v1 polish before adding features, or (b) start a Phase 2 plan for the next feature (likely History view, then Progress charts).

Do NOT begin any Phase 2 work without explicit approval.

---

## Spec Coverage Self-Check

| Spec section | Implemented in |
|---|---|
| §1 Location | Task 2 |
| §2 Folder structure | Tasks 4, 5–23 |
| §3 Navigation (bottom tabs) | Tasks 11–12 |
| §4.1 Workout day model | Tasks 8, 16 |
| §4.2 Nutrition day model (saudi + custom) | Tasks 9, 23 |
| §4.3 Targets model + defaults | Task 9 |
| §5 Food picker behavior | Task 21 |
| §6 Workout screen UX | Tasks 14, 15, 16, 17 |
| §7 Nutrition screen UX (incl. Edit goals) | Tasks 22, 23, 24 |
| §8 Persistence pattern | Tasks 16, 23 |
| §9 Build order | Mirrored task ordering |
| §10 Dependencies | Task 3 |
| §11 Out of scope | Honored — none implemented |
| §12 Testing (manual only) | Tasks 13, 17, 24, 25 |
| §13 IronMind relationship | Task 18 (vendoring saudiFoods.json), nothing else touched |

No placeholders. All types/property names align between storage modules and screen handlers (`computed`, `entries`, `exercises`, `sets`, `source`, `grams`, `foodId`).
