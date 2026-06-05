# Cloud-Synced PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn IronMind into an account-based app where email/password users get full data sync across devices via Supabase, shipped as an installable PWA.

**Architecture:** Existing React/Vite app gets a new `useSyncedStorage` hook (drop-in for `useStorage`) that mirrors a generic `user_data(user_id, key, value jsonb)` table on Supabase. Auth screens gate the app via an `AuthGuard`. PWA install plumbing added via `vite-plugin-pwa`.

**Tech Stack:** React 19, Vite 8, react-router-dom 7, `@supabase/supabase-js`, `vite-plugin-pwa`, Vitest + @testing-library/react.

**Source spec:** `docs/superpowers/specs/2026-06-05-cloud-synced-pwa-design.md`

---

## File map

### Created
- `supabase/schema.sql` — DB schema, RLS policies, profile trigger
- `src/lib/supabase.js` — singleton Supabase client
- `src/lib/sync.js` — load/save/queue helpers
- `src/hooks/useSyncedStorage.js` — sync-aware drop-in for `useStorage`
- `src/components/AuthGuard.jsx` + `.css`
- `src/components/InstallPrompt.jsx` + `.css`
- `src/pages/Login.jsx` + `Auth.css` (shared)
- `src/pages/Signup.jsx`
- `src/pages/ForgotPassword.jsx`
- `src/pages/ResetPassword.jsx`
- `src/pages/VerifyEmail.jsx`
- `src/pages/Privacy.jsx`
- `src/pages/Terms.jsx`
- `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-1024.png`
- `tests/hooks/useSyncedStorage.test.js`
- `tests/lib/sync.test.js`
- `tests/lib/migration.test.js`
- `.env.local.example`

### Modified
- `src/App.jsx` — wrap with `AuthGuard`, add auth & legal routes
- `src/pages/Settings.jsx` — Logout + Delete Account buttons
- `src/pages/Settings.css` — Danger zone styles
- All files that import `useStorage` — switch to `useSyncedStorage`
- `index.html` — add icon link tags for raster sizes
- `public/manifest.json` — fuller icons + screenshots + categories
- `vite.config.js` — register `vite-plugin-pwa`
- `package.json` — add `@supabase/supabase-js`, `vite-plugin-pwa`, `workbox-window`

---

## Task 1: Add Supabase schema file

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Create the schema file**

```sql
-- supabase/schema.sql
-- Run this once in the Supabase SQL editor for a fresh project.

-- 1. profiles ---------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  tier         text not null default 'free',
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row on auth user insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. user_data --------------------------------------------------------------
create table public.user_data (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_data enable row level security;

create policy "users read own data"
  on public.user_data for select using (auth.uid() = user_id);

create policy "users insert own data"
  on public.user_data for insert with check (auth.uid() = user_id);

create policy "users update own data"
  on public.user_data for update using (auth.uid() = user_id);

create policy "users delete own data"
  on public.user_data for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): supabase schema with RLS and profile trigger"
```

> **Manual step (do once, no commit):** Create a free Supabase project at https://supabase.com → SQL Editor → paste this file → Run. Copy the project URL and `anon` key for the next task.

---

## Task 2: Add env example and install Supabase SDK

**Files:**
- Create: `.env.local.example`
- Modify: `package.json`

- [ ] **Step 1: Create env example**

```
# .env.local.example
# Copy this file to .env.local and fill in values from your Supabase project.
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
```

- [ ] **Step 2: Install Supabase SDK**

Run:
```bash
npm install @supabase/supabase-js
```
Expected: package added to `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add .env.local.example package.json package-lock.json
git commit -m "chore: add Supabase SDK and env example"
```

> **Manual step:** Create `.env.local` (not committed — `.gitignore` already ignores it) with the real values from your Supabase project.

---

## Task 3: Create Supabase client singleton

**Files:**
- Create: `src/lib/supabase.js`

- [ ] **Step 1: Write the client**

```js
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Supabase env vars missing. Copy .env.local.example to .env.local.')
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase.js
git commit -m "feat(lib): supabase client singleton"
```

---

## Task 4: useSyncedStorage hook with tests

The drop-in replacement for `useStorage`. Reads from `localStorage` (mirror of Supabase), writes go to both.

**Files:**
- Create: `src/hooks/useSyncedStorage.js`
- Create: `tests/hooks/useSyncedStorage.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/hooks/useSyncedStorage.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../src/lib/sync', () => ({
  pushKey: vi.fn().mockResolvedValue(undefined),
  isLoggedIn: vi.fn(() => true),
}))

import { useSyncedStorage } from '../../src/hooks/useSyncedStorage'
import { pushKey } from '../../src/lib/sync'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('useSyncedStorage', () => {
  it('returns default when localStorage is empty', () => {
    const { result } = renderHook(() => useSyncedStorage('foo', { a: 1 }))
    expect(result.current[0]).toEqual({ a: 1 })
  })

  it('reads existing localStorage value', () => {
    localStorage.setItem('foo', JSON.stringify({ a: 2 }))
    const { result } = renderHook(() => useSyncedStorage('foo', { a: 1 }))
    expect(result.current[0]).toEqual({ a: 2 })
  })

  it('writes to localStorage and pushes to sync', () => {
    const { result } = renderHook(() => useSyncedStorage('foo', { a: 1 }))
    act(() => result.current[1]({ a: 3 }))
    expect(JSON.parse(localStorage.getItem('foo'))).toEqual({ a: 3 })
    expect(pushKey).toHaveBeenCalledWith('foo', { a: 3 })
  })

  it('accepts functional updates', () => {
    const { result } = renderHook(() => useSyncedStorage('foo', { n: 1 }))
    act(() => result.current[1](prev => ({ n: prev.n + 1 })))
    expect(result.current[0]).toEqual({ n: 2 })
    expect(pushKey).toHaveBeenCalledWith('foo', { n: 2 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- tests/hooks/useSyncedStorage.test.js`
Expected: FAIL with "Cannot find module './useSyncedStorage'".

- [ ] **Step 3: Implement the hook**

```js
// src/hooks/useSyncedStorage.js
import { useState, useCallback } from 'react'
import { pushKey } from '../lib/sync'

export function useSyncedStorage(key, defaultValue) {
  const [value, setValueState] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setValue = useCallback((update) => {
    setValueState(prev => {
      const next = typeof update === 'function' ? update(prev) : update
      try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
      pushKey(key, next)
      return next
    })
  }, [key])

  return [value, setValue]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- tests/hooks/useSyncedStorage.test.js`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSyncedStorage.js tests/hooks/useSyncedStorage.test.js
git commit -m "feat(hooks): useSyncedStorage drop-in for useStorage"
```

---

## Task 5: sync.js — pull-on-login + write-through queue

**Files:**
- Create: `src/lib/sync.js`
- Create: `tests/lib/sync.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/lib/sync.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'

const upsertMock = vi.fn().mockResolvedValue({ error: null })
const fromMock = vi.fn(() => ({
  upsert: upsertMock,
  select: vi.fn().mockResolvedValue({ data: [], error: null }),
}))

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: fromMock,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  },
}))

import { pushKey, flushQueue, queueSize } from '../../src/lib/sync'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('pushKey', () => {
  it('upserts to supabase when successful', async () => {
    await pushKey('workout_logs', [{ a: 1 }])
    expect(fromMock).toHaveBeenCalledWith('user_data')
    expect(upsertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      key: 'workout_logs',
      value: [{ a: 1 }],
    }, { onConflict: 'user_id,key' })
  })

  it('queues mutation when upsert fails', async () => {
    upsertMock.mockResolvedValueOnce({ error: { message: 'offline' } })
    await pushKey('targets', { p: 180 })
    expect(queueSize()).toBe(1)
  })
})

describe('flushQueue', () => {
  it('flushes queued mutations on success', async () => {
    upsertMock.mockResolvedValueOnce({ error: { message: 'offline' } })
    await pushKey('targets', { p: 1 })
    expect(queueSize()).toBe(1)

    upsertMock.mockResolvedValue({ error: null })
    await flushQueue()
    expect(queueSize()).toBe(0)
  })

  it('keeps items in queue when flush fails', async () => {
    upsertMock.mockResolvedValueOnce({ error: { message: 'offline' } })
    await pushKey('targets', { p: 1 })

    upsertMock.mockResolvedValueOnce({ error: { message: 'still offline' } })
    await flushQueue()
    expect(queueSize()).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- tests/lib/sync.test.js`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement sync.js**

```js
// src/lib/sync.js
import { supabase } from './supabase'

const QUEUE_KEY = '__sync_pending'

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) ?? [] }
  catch { return [] }
}

function writeQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function queueSize() {
  return readQueue().length
}

export function isLoggedIn() {
  try {
    const raw = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    return !!raw
  } catch { return false }
}

async function getUserId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id ?? null
}

async function upsertOne(userId, key, value) {
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' })
  return error
}

export async function pushKey(key, value) {
  const userId = await getUserId()
  if (!userId) return
  const error = await upsertOne(userId, key, value)
  if (error) {
    const q = readQueue()
    q.push({ key, value })
    writeQueue(q)
  }
}

export async function flushQueue() {
  const userId = await getUserId()
  if (!userId) return
  const q = readQueue()
  const remaining = []
  for (const m of q) {
    const err = await upsertOne(userId, m.key, m.value)
    if (err) remaining.push(m)
  }
  writeQueue(remaining)
}

export async function pullAll(keys) {
  const userId = await getUserId()
  if (!userId) return
  const { data, error } = await supabase
    .from('user_data')
    .select('key, value')
  if (error || !data) return
  for (const row of data) {
    if (keys.includes(row.key)) {
      localStorage.setItem(row.key, JSON.stringify(row.value))
    }
  }
}

// Browser hooks — flush on online + focus.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue() })
  window.addEventListener('focus',  () => { flushQueue() })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- tests/lib/sync.test.js`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync.js tests/lib/sync.test.js
git commit -m "feat(lib): sync queue and pull-on-login helpers"
```

---

## Task 6: First-login migration helper with tests

Moves any pre-existing `motaz_*` localStorage data into the user's Supabase account, then renames the keys.

**Files:**
- Modify: `src/lib/sync.js`
- Create: `tests/lib/migration.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/lib/migration.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'

const upsertMock = vi.fn().mockResolvedValue({ error: null })
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({ upsert: upsertMock, select: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  },
}))

import { findLocalLegacyKeys, migrateLegacyToCloud, discardLegacy } from '../../src/lib/sync'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('findLocalLegacyKeys', () => {
  it('returns motaz_-prefixed keys present in localStorage', () => {
    localStorage.setItem('motaz_workout_logs', '[]')
    localStorage.setItem('motaz_profile', '{}')
    localStorage.setItem('other', 'x')
    expect(findLocalLegacyKeys().sort()).toEqual(['motaz_profile', 'motaz_workout_logs'])
  })

  it('returns [] when no legacy keys', () => {
    expect(findLocalLegacyKeys()).toEqual([])
  })
})

describe('migrateLegacyToCloud', () => {
  it('upserts each legacy key without the prefix and deletes the legacy key', async () => {
    localStorage.setItem('motaz_workout_logs', JSON.stringify([{ x: 1 }]))
    localStorage.setItem('motaz_targets', JSON.stringify({ p: 180 }))

    await migrateLegacyToCloud()

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'workout_logs', value: [{ x: 1 }] }),
      expect.any(Object)
    )
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'targets', value: { p: 180 } }),
      expect.any(Object)
    )
    expect(localStorage.getItem('motaz_workout_logs')).toBeNull()
    expect(localStorage.getItem('motaz_targets')).toBeNull()
    // The non-prefixed keys are populated for the synced hook to read
    expect(JSON.parse(localStorage.getItem('workout_logs'))).toEqual([{ x: 1 }])
  })
})

describe('discardLegacy', () => {
  it('removes motaz_ keys without uploading', () => {
    localStorage.setItem('motaz_workout_logs', '[]')
    discardLegacy()
    expect(localStorage.getItem('motaz_workout_logs')).toBeNull()
    expect(upsertMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- tests/lib/migration.test.js`
Expected: FAIL with "not a function" or undefined export.

- [ ] **Step 3: Append migration helpers to `src/lib/sync.js`**

Add to the bottom of `src/lib/sync.js`:

```js
// --- First-login migration ---

const LEGACY_PREFIX = 'motaz_'

export function findLocalLegacyKeys() {
  const out = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(LEGACY_PREFIX)) out.push(k)
  }
  return out
}

export async function migrateLegacyToCloud() {
  const userId = await getUserId()
  if (!userId) return
  const legacy = findLocalLegacyKeys()
  for (const legacyKey of legacy) {
    const newKey = legacyKey.slice(LEGACY_PREFIX.length)
    let value
    try { value = JSON.parse(localStorage.getItem(legacyKey)) } catch { continue }
    const err = await upsertOne(userId, newKey, value)
    if (!err) {
      localStorage.setItem(newKey, JSON.stringify(value))
      localStorage.removeItem(legacyKey)
    }
  }
}

export function discardLegacy() {
  for (const k of findLocalLegacyKeys()) localStorage.removeItem(k)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- tests/lib/migration.test.js`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync.js tests/lib/migration.test.js
git commit -m "feat(lib): first-login motaz_ → cloud migration helpers"
```

---

## Task 7: Shared Auth.css

**Files:**
- Create: `src/pages/Auth.css`

- [ ] **Step 1: Write the shared auth styles**

```css
/* src/pages/Auth.css */
.auth-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24px;
  max-width: 420px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.auth-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
}

.auth-sub {
  font-size: 14px;
  opacity: 0.7;
  margin: 0 0 24px;
}

.auth-form { display: flex; flex-direction: column; gap: 14px; }

.auth-form label {
  font-size: 13px;
  opacity: 0.8;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-form input[type="email"],
.auth-form input[type="password"] {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 16px;
  color: inherit;
}

.auth-form input:focus {
  outline: none;
  border-color: var(--accent, #5ee2c4);
}

.auth-btn {
  background: var(--accent, #5ee2c4);
  color: #0a0a0a;
  border: 0;
  border-radius: 10px;
  padding: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.auth-error {
  background: rgba(255, 80, 80, 0.12);
  border: 1px solid rgba(255, 80, 80, 0.3);
  color: #ff8b8b;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
}

.auth-foot { margin-top: 20px; font-size: 14px; opacity: 0.8; text-align: center; }
.auth-foot a { color: var(--accent, #5ee2c4); text-decoration: none; }

.auth-check { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; }
.auth-check input { margin-top: 3px; }
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Auth.css
git commit -m "style(auth): shared auth screen styles"
```

---

## Task 8: Login page

**Files:**
- Create: `src/pages/Login.jsx`

- [ ] **Step 1: Write the page**

```jsx
// src/pages/Login.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setError('Please verify your email first. Check your inbox.')
      } else {
        setError('Invalid email or password.')
      }
      return
    }
    navigate('/dashboard')
  }

  return (
    <div className="auth-page">
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-sub">Log in to sync your training across devices.</p>
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <label>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Log in'}</button>
      </form>
      <p className="auth-foot"><Link to="/forgot-password">Forgot password?</Link></p>
      <p className="auth-foot">No account? <Link to="/signup">Sign up</Link></p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Login.jsx
git commit -m "feat(auth): login page"
```

---

## Task 9: Signup page

**Files:**
- Create: `src/pages/Signup.jsx`

- [ ] **Step 1: Write the page**

```jsx
// src/pages/Signup.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Auth.css'

export default function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (!agreed) { setError('Please agree to the Privacy Policy and Terms.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/verify-email')
  }

  return (
    <div className="auth-page">
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-sub">Your training history will follow you to any phone.</p>
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <label>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" required autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <label>
          Confirm password
          <input type="password" required autoComplete="new-password" minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} />
        </label>
        <label className="auth-check">
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
          <span>I agree to the <Link to="/privacy" target="_blank">Privacy Policy</Link> and <Link to="/terms" target="_blank">Terms of Service</Link>.</span>
        </label>
        <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="auth-foot">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Signup.jsx
git commit -m "feat(auth): signup page with ToS gate"
```

---

## Task 10: Forgot password page

**Files:**
- Create: `src/pages/ForgotPassword.jsx`

- [ ] **Step 1: Write the page**

```jsx
// src/pages/ForgotPassword.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Auth.css'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="auth-page">
        <h1 className="auth-title">Check your inbox</h1>
        <p className="auth-sub">We sent a reset link to {email}. Click it to set a new password.</p>
        <p className="auth-foot"><Link to="/login">Back to log in</Link></p>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <h1 className="auth-title">Reset your password</h1>
      <p className="auth-sub">Enter your email and we'll send you a reset link.</p>
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <label>
          Email
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
      </form>
      <p className="auth-foot"><Link to="/login">Back to log in</Link></p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ForgotPassword.jsx
git commit -m "feat(auth): forgot password page"
```

---

## Task 11: Reset password page

**Files:**
- Create: `src/pages/ResetPassword.jsx`

- [ ] **Step 1: Write the page**

```jsx
// src/pages/ResetPassword.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Auth.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    navigate('/dashboard')
  }

  return (
    <div className="auth-page">
      <h1 className="auth-title">Set a new password</h1>
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <label>
          New password
          <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <label>
          Confirm new password
          <input type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} />
        </label>
        <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save password'}</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ResetPassword.jsx
git commit -m "feat(auth): reset password page"
```

---

## Task 12: Verify email screen

**Files:**
- Create: `src/pages/VerifyEmail.jsx`

- [ ] **Step 1: Write the page**

```jsx
// src/pages/VerifyEmail.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Auth.css'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [resent, setResent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      const user = data?.user
      if (!user) { navigate('/login'); return }
      if (user.email_confirmed_at) { navigate('/dashboard'); return }
      setEmail(user.email ?? '')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user?.email_confirmed_at) navigate('/dashboard')
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [navigate])

  async function resend() {
    setError('')
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) { setError(error.message); return }
    setResent(true)
  }

  return (
    <div className="auth-page">
      <h1 className="auth-title">Verify your email</h1>
      <p className="auth-sub">We sent a verification link to {email || 'your inbox'}. Click it to activate your account.</p>
      {error && <div className="auth-error">{error}</div>}
      {resent ? <p className="auth-sub">Sent! Check your inbox.</p> : (
        <button className="auth-btn" onClick={resend}>Resend verification email</button>
      )}
      <p className="auth-foot">Wrong email? <button onClick={() => supabase.auth.signOut().then(() => navigate('/signup'))} style={{ background: 'none', border: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>Sign out and try again</button></p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/VerifyEmail.jsx
git commit -m "feat(auth): verify email waiting screen"
```

---

## Task 13: Privacy and Terms pages

**Files:**
- Create: `src/pages/Privacy.jsx`
- Create: `src/pages/Terms.jsx`

- [ ] **Step 1: Write Privacy page**

```jsx
// src/pages/Privacy.jsx
import { Link } from 'react-router-dom'
import './Auth.css'

export default function Privacy() {
  return (
    <div className="auth-page" style={{ maxWidth: 640 }}>
      <h1 className="auth-title">Privacy Policy</h1>
      <p>Last updated: 2026-06-05</p>
      <h3>What we collect</h3>
      <p>Your email address (for sign-in and password reset) and the fitness, nutrition, and program data you enter in the app.</p>
      <h3>Where it lives</h3>
      <p>On Supabase (a hosted Postgres database). Data is encrypted in transit and at rest.</p>
      <h3>How long we keep it</h3>
      <p>Until you delete your account. You can delete your account at any time from Settings — this removes all your data from our servers.</p>
      <h3>We do not</h3>
      <p>Sell your data. Share it with third parties for advertising. Send marketing emails.</p>
      <h3>Contact</h3>
      <p>Questions? Reach the developer at adelmotaz861@gmail.com.</p>
      <p className="auth-foot"><Link to="/signup">Back</Link></p>
    </div>
  )
}
```

- [ ] **Step 2: Write Terms page**

```jsx
// src/pages/Terms.jsx
import { Link } from 'react-router-dom'
import './Auth.css'

export default function Terms() {
  return (
    <div className="auth-page" style={{ maxWidth: 640 }}>
      <h1 className="auth-title">Terms of Service</h1>
      <p>Last updated: 2026-06-05</p>
      <h3>Use at your own risk</h3>
      <p>IronMind is a tracking tool, not medical advice. Consult a qualified professional before starting any training or nutrition program.</p>
      <h3>Your account</h3>
      <p>You're responsible for keeping your password safe. We can suspend accounts that abuse the service or violate the law.</p>
      <h3>Service availability</h3>
      <p>We aim for high availability but cannot guarantee uninterrupted service.</p>
      <h3>Liability</h3>
      <p>To the maximum extent permitted by law, IronMind and its developer are not liable for indirect or consequential damages from your use of the app.</p>
      <h3>Changes</h3>
      <p>We may update these terms; continued use means you accept the new terms.</p>
      <p className="auth-foot"><Link to="/signup">Back</Link></p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Privacy.jsx src/pages/Terms.jsx
git commit -m "feat(legal): privacy policy and terms of service pages"
```

---

## Task 14: AuthGuard component

Routes based on session and email-verified state. Also runs the first-login migration prompt.

**Files:**
- Create: `src/components/AuthGuard.jsx`
- Create: `src/components/AuthGuard.css`

- [ ] **Step 1: Write the styles**

```css
/* src/components/AuthGuard.css */
.auth-loading {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  font-size: 14px;
  opacity: 0.7;
}

.migration-modal-bg {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: grid;
  place-items: center;
  z-index: 100;
  padding: 20px;
}

.migration-modal {
  background: #121821;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 24px;
  max-width: 420px;
  width: 100%;
}

.migration-modal h2 { margin: 0 0 8px; font-size: 20px; }
.migration-modal p { opacity: 0.85; margin: 0 0 18px; font-size: 14px; line-height: 1.5; }
.migration-actions { display: flex; gap: 10px; }
.migration-actions button {
  flex: 1; padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
  background: transparent; color: inherit; cursor: pointer; font-size: 14px; font-weight: 600;
}
.migration-actions .primary { background: var(--accent, #5ee2c4); color: #0a0a0a; border-color: transparent; }
```

- [ ] **Step 2: Write the guard**

```jsx
// src/components/AuthGuard.jsx
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { pullAll, findLocalLegacyKeys, migrateLegacyToCloud, discardLegacy } from '../lib/sync'
import './AuthGuard.css'

const SYNC_KEYS = [
  'workout_logs', 'nutrition_logs', 'body_weight_logs',
  'meals', 'targets', 'profile', 'exercises', 'custom_foods',
]

const PUBLIC_PATHS = new Set([
  '/login', '/signup', '/forgot-password', '/reset-password', '/privacy', '/terms',
])

export default function AuthGuard({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState('loading') // 'loading' | 'public' | 'verify' | 'app'
  const [showMigration, setShowMigration] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function evaluate(session) {
      if (cancelled) return
      const user = session?.user ?? null

      if (PUBLIC_PATHS.has(location.pathname)) {
        setStatus('public')
        return
      }

      if (!user) {
        setStatus('public')
        navigate('/login', { replace: true })
        return
      }

      if (!user.email_confirmed_at) {
        setStatus('verify')
        navigate('/verify-email', { replace: true })
        return
      }

      // Verified user: pull data + check migration prompt
      await pullAll(SYNC_KEYS)
      const legacy = findLocalLegacyKeys()
      const promptShownKey = `__migration_prompted_${user.id}`
      const alreadyPrompted = localStorage.getItem(promptShownKey) === '1'
      if (legacy.length > 0 && !alreadyPrompted) {
        setShowMigration(true)
      }
      setStatus('app')
    }

    supabase.auth.getSession().then(({ data }) => evaluate(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => evaluate(session))
    return () => { cancelled = true; sub.subscription.unsubscribe() }
    // location.pathname triggers re-eval when route changes
  }, [navigate, location.pathname])

  async function onMigrate() {
    await migrateLegacyToCloud()
    const { data } = await supabase.auth.getUser()
    if (data?.user) localStorage.setItem(`__migration_prompted_${data.user.id}`, '1')
    // Force a reload so all useSyncedStorage hooks re-read freshly migrated localStorage.
    window.location.reload()
  }

  async function onDiscard() {
    discardLegacy()
    const { data } = await supabase.auth.getUser()
    if (data?.user) localStorage.setItem(`__migration_prompted_${data.user.id}`, '1')
    setShowMigration(false)
  }

  if (status === 'loading') return <div className="auth-loading">Loading…</div>

  return (
    <>
      {children}
      {showMigration && (
        <div className="migration-modal-bg">
          <div className="migration-modal">
            <h2>Move your existing data?</h2>
            <p>We found workout and nutrition data on this device from before you signed up. Move it into your new account, or start fresh.</p>
            <div className="migration-actions">
              <button onClick={onDiscard}>Start fresh</button>
              <button className="primary" onClick={onMigrate}>Move it</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AuthGuard.jsx src/components/AuthGuard.css
git commit -m "feat(auth): AuthGuard with route gating and migration modal"
```

---

## Task 15: Wire auth into App.jsx router

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace App.jsx contents**

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTheme } from './hooks/useTheme'
import AuthGuard from './components/AuthGuard'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import WorkoutLogger from './pages/WorkoutLogger'
import Nutrition from './pages/Nutrition'
import Progress from './pages/Progress'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'
import Onboarding from './pages/Onboarding'
import FoodSearchPage from './pages/FoodSearchPage'
import FoodScannerPage from './pages/FoodScannerPage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

export default function App() {
  useTheme()
  return (
    <BrowserRouter>
      <div className="bg-orb bg-orb-tr" />
      <div className="bg-orb bg-orb-bl" />
      <AuthGuard>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* App routes (AuthGuard ensures the user is verified before reaching these) */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<><Dashboard /><BottomNav /></>} />
          <Route path="/workout" element={<><WorkoutLogger /><BottomNav /></>} />
          <Route path="/nutrition" element={<><Nutrition /><BottomNav /></>} />
          <Route path="/progress" element={<><Progress /><BottomNav /></>} />
          <Route path="/classes" element={<Navigate to="/workout" replace />} />
          <Route path="/food-search" element={<><FoodSearchPage /><BottomNav /></>} />
          <Route path="/food-scan" element={<><FoodScannerPage /><BottomNav /></>} />
          <Route path="/schedule" element={<><Schedule /><BottomNav /></>} />
          <Route path="/settings" element={<><Settings /><BottomNav /></>} />
          <Route path="/onboarding" element={<Onboarding onComplete={() => window.location.assign('/dashboard')} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthGuard>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "feat(app): wire AuthGuard and auth routes into router"
```

> **Note:** Old `motaz_onboarded` localStorage gating is replaced. Onboarding will be reached after migration if the user has no `profile` row. (Refining onboarding gating to be cloud-aware is left to a future spec.)

---

## Task 16: Replace useStorage with useSyncedStorage across the app

This is mechanical: every file that imports `useStorage` from `'./useStorage'` switches to `useSyncedStorage`.

**Files:**
- Modify: `src/hooks/useStorage.js`

The simplest, lowest-risk approach: have the existing `useStorage` export delegate to `useSyncedStorage` so downstream imports don't change. Keep the `exportAllData`/`importAllData` functions untouched.

- [ ] **Step 1: Update useStorage.js to delegate**

```js
// src/hooks/useStorage.js
import { useSyncedStorage } from './useSyncedStorage'

export const useStorage = useSyncedStorage

// Existing data-export helpers — unchanged. Now operating on the un-prefixed keys.
const DATA_KEYS = ['workout_logs', 'nutrition_logs', 'body_weight_logs', 'meals', 'targets', 'profile', 'exercises', 'custom_foods']

export function exportAllData() {
  const snapshot = {}
  for (const key of DATA_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) snapshot[key] = JSON.parse(raw)
    } catch {}
  }
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ironmind-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function importAllData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        for (const [key, value] of Object.entries(data)) {
          if (DATA_KEYS.includes(key)) {
            localStorage.setItem(key, JSON.stringify(value))
          }
        }
        resolve(true)
      } catch {
        reject(new Error('Invalid backup file'))
      }
    }
    reader.onerror = () => reject(new Error('File read failed'))
    reader.readAsText(file)
  })
}
```

- [ ] **Step 2: Update every `useStorage` call site that passed a `motaz_`-prefixed key**

Strip the `motaz_` prefix at each call site so keys match Supabase column values.

Files to update (each is a one-line key change):
- `src/hooks/useExercises.js` — `useStorage('motaz_exercises', …)` → `useStorage('exercises', …)`
- `src/hooks/useMeals.js` — `useStorage('motaz_meals', …)` → `useStorage('meals', …)`
- `src/hooks/useTargets.js` — `useStorage('motaz_targets', …)` → `useStorage('targets', …)`
- `src/pages/Dashboard.jsx` — `useStorage('motaz_workout_logs', …)` → `useStorage('workout_logs', …)`, same for `motaz_nutrition_logs`, `motaz_profile`
- `src/pages/Nutrition.jsx`, `src/pages/Progress.jsx`, `src/pages/Settings.jsx`, `src/pages/WorkoutLogger.jsx`, `src/pages/Onboarding.jsx`, `src/pages/Schedule.jsx` — same pattern, search and replace `'motaz_` → `'`.

Run a search to find every remaining usage:
```bash
grep -rn "motaz_" src/
```
Expected: zero results after edits.

Update the existing test file too:
- `tests/hooks/useExercises.test.js` — change `localStorage.getItem('motaz_exercises')` → `localStorage.getItem('exercises')`. The hook should still default to `DEFAULT_PROGRAM` and persist. Mock sync the same way Task 4 does.

```js
// tests/hooks/useExercises.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../src/lib/sync', () => ({
  pushKey: vi.fn().mockResolvedValue(undefined),
  isLoggedIn: vi.fn(() => false),
}))

import { useExercises } from '../../src/hooks/useExercises'
import { DEFAULT_PROGRAM } from '../../src/data/workoutProgram'

beforeEach(() => localStorage.clear())

describe('useExercises', () => {
  it('returns DEFAULT_PROGRAM when nothing in storage', () => {
    const { result } = renderHook(() => useExercises())
    expect(result.current[0]).toEqual(DEFAULT_PROGRAM)
  })

  it('persists a custom program to localStorage', () => {
    const { result } = renderHook(() => useExercises())
    const custom = { sessions: { A: { name: 'Test', focus: 'Test', muscles: 'All', exercises: [] } }, daySession: { 0: 'rest', 1: 'A', 2: 'rest', 3: 'rest', 4: 'rest', 5: 'rest', 6: 'rest' } }
    act(() => result.current[1](custom))
    expect(JSON.parse(localStorage.getItem('exercises'))).toEqual(custom)
  })
})
```

- [ ] **Step 3: Run full test suite**

Run: `npm run test:run`
Expected: all tests PASS.

- [ ] **Step 4: Run dev server and click through manually**

Run: `npm run dev`
Expected: app loads (will redirect to /login since AuthGuard is active). Manually sign up a new test account, verify the email, and confirm Dashboard loads with default data. Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "refactor: rename storage keys (strip motaz_ prefix) and route via useSyncedStorage"
```

---

## Task 17: Logout button in Settings

**Files:**
- Modify: `src/pages/Settings.jsx`

- [ ] **Step 1: Read the current Settings page to locate the place to add buttons**

Run: `head -80 src/pages/Settings.jsx`
Find the closing `</div>` of the main page wrapper; add the logout + delete account section just before it.

- [ ] **Step 2: Add the imports and JSX**

At the top of `src/pages/Settings.jsx`, add:

```jsx
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
```

Inside the component, add this hook near the top of the function:
```jsx
const navigate = useNavigate()
```

Add this JSX block as the last block inside the page wrapper (just before the closing `</div>` of the page root):

```jsx
<div className="settings-section danger-zone">
  <h3>Account</h3>
  <button
    className="settings-btn"
    onClick={async () => {
      await supabase.auth.signOut()
      localStorage.clear()
      navigate('/login', { replace: true })
    }}
  >
    Log out
  </button>
  <button
    className="settings-btn danger"
    onClick={async () => {
      const confirm1 = window.prompt('Type your email to permanently delete your account and all data:')
      const { data } = await supabase.auth.getUser()
      if (!confirm1 || confirm1.trim().toLowerCase() !== (data?.user?.email ?? '').toLowerCase()) {
        alert('Email did not match. Cancelled.')
        return
      }
      const { error } = await supabase.rpc('delete_my_account')
      if (error) { alert('Failed: ' + error.message); return }
      await supabase.auth.signOut()
      localStorage.clear()
      navigate('/signup', { replace: true })
    }}
  >
    Delete my account
  </button>
</div>
```

- [ ] **Step 3: Add danger styles**

Append to `src/pages/Settings.css`:

```css
.danger-zone { margin-top: 32px; }
.settings-btn { display: block; width: 100%; padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: inherit; cursor: pointer; font-size: 14px; margin-top: 8px; }
.settings-btn.danger { color: #ff8b8b; border-color: rgba(255, 80, 80, 0.3); }
```

- [ ] **Step 4: Add the `delete_my_account` RPC to the schema**

Append to `supabase/schema.sql`:

```sql
-- Server-side account deletion: deletes from auth.users, cascade removes profiles + user_data.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account from public;
grant execute on function public.delete_my_account to authenticated;
```

> **Manual step:** Re-run the added portion in the Supabase SQL Editor so the RPC exists.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.jsx src/pages/Settings.css supabase/schema.sql
git commit -m "feat(settings): logout and delete-account buttons + RPC"
```

---

## Task 18: Install vite-plugin-pwa

**Files:**
- Modify: `package.json`, `vite.config.js`

- [ ] **Step 1: Install plugins**

Run:
```bash
npm install -D vite-plugin-pwa workbox-window
```
Expected: packages added to `devDependencies`.

- [ ] **Step 2: Update `vite.config.js`**

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'icon-192.png', 'icon-512.png'],
      manifest: false,  // we ship our own public/manifest.json
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js',
  },
})
```

- [ ] **Step 3: Build to verify the plugin runs**

Run: `npm run build`
Expected: build succeeds, `dist/` contains `sw.js`, `workbox-*.js`, `manifest.webmanifest` (or our own `manifest.json` referenced).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vite.config.js
git commit -m "feat(pwa): register service worker via vite-plugin-pwa"
```

---

## Task 19: Manifest update and raster icons

**Files:**
- Modify: `public/manifest.json`, `index.html`
- Create: `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-1024.png`

- [ ] **Step 1: Generate raster icons from the existing SVG**

> **Manual step:** Export PNGs at three sizes from `public/favicon.svg` (any vector tool: Figma, Affinity, Inkscape, or an online SVG-to-PNG converter). Save:
> - `public/icon-192.png` — 192×192
> - `public/icon-512.png` — 512×512
> - `public/icon-maskable-1024.png` — 1024×1024 with the logo centered inside a 80%-of-canvas safe zone (for Android maskable icons)

- [ ] **Step 2: Update manifest.json**

```json
{
  "name": "IronMind",
  "short_name": "IronMind",
  "description": "Your personal fitness tracker",
  "start_url": "/",
  "display": "fullscreen",
  "orientation": "portrait",
  "background_color": "#060A12",
  "theme_color": "#060A12",
  "categories": ["fitness", "health"],
  "icons": [
    { "src": "/favicon.svg",              "sizes": "any",       "type": "image/svg+xml" },
    { "src": "/icon-192.png",             "sizes": "192x192",   "type": "image/png" },
    { "src": "/icon-512.png",             "sizes": "512x512",   "type": "image/png" },
    { "src": "/icon-maskable-1024.png",   "sizes": "1024x1024", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Add iOS apple-touch-icon to index.html**

In `index.html`, replace the line `<link rel="apple-touch-icon" href="/favicon.svg" />` with:
```html
<link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
<link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
```

- [ ] **Step 4: Commit**

```bash
git add public/manifest.json public/icon-192.png public/icon-512.png public/icon-maskable-1024.png index.html
git commit -m "feat(pwa): raster icons and richer manifest"
```

---

## Task 20: Install prompt banner

**Files:**
- Create: `src/components/InstallPrompt.jsx`, `src/components/InstallPrompt.css`
- Modify: `src/App.jsx`

- [ ] **Step 1: Write the styles**

```css
/* src/components/InstallPrompt.css */
.install-banner {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(76px + env(safe-area-inset-bottom, 0));
  background: #121821;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  padding: 12px 14px;
  display: flex;
  gap: 12px;
  align-items: center;
  z-index: 90;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.install-banner-text { flex: 1; font-size: 13px; line-height: 1.4; }
.install-banner-actions { display: flex; gap: 8px; }
.install-banner button {
  border: 1px solid rgba(255,255,255,0.15);
  background: transparent; color: inherit;
  padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.install-banner button.primary { background: var(--accent, #5ee2c4); color: #0a0a0a; border-color: transparent; font-weight: 600; }
```

- [ ] **Step 2: Write the component**

```jsx
// src/components/InstallPrompt.jsx
import { useEffect, useState } from 'react'
import './InstallPrompt.css'

const DISMISSED_KEY = '__install_dismissed'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(window.navigator.userAgent)
}

export default function InstallPrompt() {
  const [evt, setEvt] = useState(null)
  const [iosHint, setIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1')

  useEffect(() => {
    if (dismissed || isStandalone()) return
    function onPrompt(e) { e.preventDefault(); setEvt(e) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    if (isIOS()) setIosHint(true)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [dismissed])

  if (dismissed || isStandalone()) return null
  if (!evt && !iosHint) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  async function install() {
    if (!evt) return
    evt.prompt()
    await evt.userChoice
    dismiss()
  }

  return (
    <div className="install-banner">
      <div className="install-banner-text">
        {evt
          ? 'Install IronMind on your phone for the full app experience.'
          : 'Install IronMind: tap the Share icon, then Add to Home Screen.'}
      </div>
      <div className="install-banner-actions">
        <button onClick={dismiss}>Later</button>
        {evt && <button className="primary" onClick={install}>Install</button>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Mount the prompt in App.jsx**

In `src/App.jsx`, add the import:
```jsx
import InstallPrompt from './components/InstallPrompt'
```

Inside the `<AuthGuard>` block, after the `<Routes>` element, add:
```jsx
<InstallPrompt />
```

So the relevant section becomes:
```jsx
<AuthGuard>
  <Routes>
    {/* ...routes... */}
  </Routes>
  <InstallPrompt />
</AuthGuard>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/InstallPrompt.jsx src/components/InstallPrompt.css src/App.jsx
git commit -m "feat(pwa): install prompt banner"
```

---

## Task 21: Final manual verification

**Files:** none

This task is human-only. The dev server and a real phone (or Chrome DevTools device-emulation mode) verify the success criteria from the spec.

- [ ] **Step 1: Run linter and tests**

```bash
npm run lint
npm run test:run
```
Expected: zero errors, all tests PASS.

- [ ] **Step 2: Build for production**

```bash
npm run build
```
Expected: build succeeds. Check `dist/sw.js` exists.

- [ ] **Step 3: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 4: Verify each spec success criterion manually**

Tick each off:
- [ ] Sign up a new user → land on `/verify-email`
- [ ] Verify the email (click the link in your inbox) → land on `/dashboard`
- [ ] On Dashboard, edit something (add a workout log, change a target) → check the Supabase dashboard's `user_data` table: a row exists for `auth.uid()` with that key
- [ ] Open the app in a private/incognito window → log in with the same account → the data appears
- [ ] Toggle offline (DevTools → Network → Offline) → app still works, writes still happen → toggle online → check Supabase to confirm queued writes flushed
- [ ] In Settings, click "Log out" → redirected to `/login`, `user_data` rows still in Supabase
- [ ] In Settings, click "Delete my account", type your email → all `user_data` rows and the auth user are gone in Supabase
- [ ] Open Privacy and Terms pages from the signup form — both render
- [ ] On a phone (or Chrome DevTools mobile mode), install the PWA via the install prompt or browser menu — app opens in fullscreen with the new icon
- [ ] Pre-existing-data check: in a fresh incognito window, manually inject `localStorage.setItem('motaz_workout_logs', '[{"test":true}]')` before signing up → sign up → on first verified login, see the migration modal → click "Move it" → the data appears in Supabase

- [ ] **Step 5: Stop the dev server**

In the terminal where dev is running: Ctrl+C.

> No commit for this task — it's verification only.

---

## Self-review notes

**Spec coverage:** Each spec section has at least one task. Auth flow → tasks 8-12. Sync model → tasks 4-6. Migration → task 6 + task 14 modal. Data model + RLS → task 1. Account deletion + privacy → tasks 13, 17. PWA → tasks 18-20. Success criteria → task 21.

**Known small simplifications vs spec:**
- The PWA install banner does not nag — shows once, dismiss persists. Spec said "once on mobile browsers" — this matches.
- ErrorBoundary mentioned in spec error-handling section is deferred: React 19 still doesn't have a function-component primitive for it, and the existing app has no boundary today either. If needed, can be added as a small follow-up. (Flagged here so it's not forgotten.)
- The `Onboarding` route is reachable but its triggering logic (decide-when-to-show) becomes less clean now that there's no `motaz_onboarded` flag. A future spec should make onboarding gated on the cloud `profile` row being empty.

**Type/name consistency check:** `pushKey`, `flushQueue`, `pullAll`, `findLocalLegacyKeys`, `migrateLegacyToCloud`, `discardLegacy` — all defined in `src/lib/sync.js` (tasks 5 and 6), imported with the same names in `AuthGuard.jsx` (task 14) and `useSyncedStorage.js` (task 4). Consistent.
