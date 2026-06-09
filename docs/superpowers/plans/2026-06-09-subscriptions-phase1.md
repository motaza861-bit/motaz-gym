# Subscriptions Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tier tracking + 7-day trial + feature gating to IronMind. Backend rejects API calls outside the user's effective tier; frontend shows paywalls in place of write actions; existing read-only data stays accessible after trial expiry.

**Architecture:** Four columns on the existing `profiles` Supabase table track tier + status + trial window. A SQL view `effective_subscription` lazily computes a usable tier based on status and clock. Server endpoints wrap their handlers with `withTierGate(allowed, handler)`. The client caches the view into a synced `subscription` storage key and reads it via a `useSubscription` hook; pages render `<Paywall feature="..." />` when the cached effective tier is too low. Subscribe buttons are placeholders until Phase 2 (real Stripe).

**Tech Stack:** Supabase Postgres + RLS, Vercel serverless Node functions, `@supabase/supabase-js`, React 19, Vitest.

**Source spec:** `docs/superpowers/specs/2026-06-09-subscriptions-phase1-design.md`

---

## File map

### Added
- `supabase/migrations/2026-06-09-subscriptions.sql` — schema migration (also appended to `supabase/schema.sql` for fresh-project setup)
- `src/lib/tiers.js` — tier constants, `hasTier`, `FEATURES` map
- `tests/lib/tiers.test.js`
- `api/_subscription.js` — `getEffectiveSubscription`, `requireTier`, `withTierGate`
- `tests/api/_subscription.test.js`
- `src/hooks/useSubscription.js`
- `src/components/Paywall.jsx`, `src/components/Paywall.css`
- `src/components/SubscriptionCard.jsx` (uses Settings.css)
- `src/pages/Pricing.jsx`, `src/pages/Pricing.css`

### Modified
- `supabase/schema.sql` — append the new columns / view / trigger update
- `src/components/AuthGuard.jsx` — add `'subscription'` to `SYNC_KEYS`; add `/pricing` to `PUBLIC_PATHS`
- `src/lib/sync.js` — extend `pullAll` to also fetch `effective_subscription` view
- `src/App.jsx` — register `/pricing` route (mounted outside AuthGuard wrapper so it's reachable when logged out)
- `src/i18n/translations.js` — new `pricing.*`, `paywall.*`, `sub.*` keys
- `src/pages/Coach.jsx` — top-level Paywall gate
- `src/pages/WorkoutLogger.jsx` — write-action gates + paywall modal trigger
- `src/pages/Nutrition.jsx` — write-action gates
- `src/pages/FoodSearchPage.jsx` — search / scan / AI estimate gates
- `src/pages/FoodScannerPage.jsx` — whole page gate
- `src/components/ExerciseEditForm.jsx` — detect-muscles gate
- `src/pages/Settings.jsx` — mount `<SubscriptionCard />` in Account section
- `api/coach-chat.js`, `api/analyze-food.js`, `api/estimate-food.js`, `api/detect-muscles.js`, `api/lookup-barcode.js`, `api/analyze-meal-text.js` — each wrapped in `withTierGate(...)`
- Existing endpoint test files — bypass the gate via a top-level `vi.mock('../../api/_subscription.js', ...)` so the inner handler is tested directly

### Vercel env vars
- Add `SUPABASE_SERVICE_ROLE_KEY` (get it from Supabase Project Settings → API → service_role secret).
- `VITE_SUPABASE_URL` already present (used by both client + server function).

---

## Task 1: Schema migration

**Files:**
- Create: `supabase/migrations/2026-06-09-subscriptions.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Create the migration file**

`supabase/migrations/2026-06-09-subscriptions.sql`:

```sql
-- IronMind subscriptions Phase 1
-- Idempotent migration — safe to re-run.

alter table public.profiles
  add column if not exists subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'expired', 'canceled'));

alter table public.profiles
  add column if not exists trial_started_at timestamptz default now();

alter table public.profiles
  add column if not exists trial_ends_at timestamptz default now() + interval '7 days';

-- Updated trigger: new accounts auto-get a 7-day trialing window.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, tier, subscription_status, trial_started_at, trial_ends_at)
  values (new.id, new.email, 'free', 'trialing', now(), now() + interval '7 days');
  return new;
end;
$$;

-- View: server- and client-readable. Effective tier is what we gate on.
create or replace view public.effective_subscription as
select
  p.id as user_id,
  case
    when p.subscription_status = 'active'   then p.tier
    when p.subscription_status = 'trialing' and p.trial_ends_at > now() then 'tier2'
    else 'none'
  end as effective_tier,
  case
    when p.subscription_status = 'trialing' and p.trial_ends_at > now()
      then ceil(extract(epoch from (p.trial_ends_at - now())) / 86400)::int
    else 0
  end as trial_days_left,
  p.subscription_status as status,
  p.tier as stored_tier,
  p.trial_started_at,
  p.trial_ends_at
from public.profiles p;

alter view public.effective_subscription set (security_invoker = true);
```

- [ ] **Step 2: Append the same statements to `supabase/schema.sql`**

So a fresh Supabase setup has them too. Find the end of the existing schema (after the `delete_my_account` function), and add a `-- 3. subscriptions ---------------` block containing the same SQL as Step 1 (minus the `if not exists` guards since fresh setups don't need them — but keep them; they're harmless).

- [ ] **Step 3: Verify locally**

No automated test for the SQL itself. The user runs this manually in their Supabase SQL Editor. The implementation plan considers Step 1's file written = task done; the user is responsible for the manual apply step.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026-06-09-subscriptions.sql supabase/schema.sql
git commit -m "feat(db): subscriptions schema — columns + view + trigger"
```

> **Manual step (user runs once, no commit):** Copy the contents of `supabase/migrations/2026-06-09-subscriptions.sql` into the Supabase dashboard's SQL editor and Run.

---

## Task 2: `src/lib/tiers.js` + tests

**Files:**
- Create: `src/lib/tiers.js`
- Create: `tests/lib/tiers.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/lib/tiers.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { hasTier, FEATURES, TIER_NONE, TIER_1, TIER_2 } from '../../src/lib/tiers.js'

describe('hasTier', () => {
  it('grants when effective tier is the same as required', () => {
    expect(hasTier(TIER_1, TIER_1)).toBe(true)
    expect(hasTier(TIER_2, TIER_2)).toBe(true)
    expect(hasTier(TIER_NONE, TIER_NONE)).toBe(true)
  })

  it('grants when effective tier is higher than required', () => {
    expect(hasTier(TIER_2, TIER_1)).toBe(true)
    expect(hasTier(TIER_1, TIER_NONE)).toBe(true)
    expect(hasTier(TIER_2, TIER_NONE)).toBe(true)
  })

  it('denies when effective tier is lower than required', () => {
    expect(hasTier(TIER_NONE, TIER_1)).toBe(false)
    expect(hasTier(TIER_NONE, TIER_2)).toBe(false)
    expect(hasTier(TIER_1, TIER_2)).toBe(false)
  })

  it('treats unknown effective tier as none', () => {
    expect(hasTier('garbage', TIER_1)).toBe(false)
  })
})

describe('FEATURES map', () => {
  it('puts the AI Coach behind Tier 2', () => {
    expect(FEATURES.coach).toBe(TIER_2)
  })

  it('puts most write features behind Tier 1', () => {
    expect(FEATURES.log_workout).toBe(TIER_1)
    expect(FEATURES.log_nutrition).toBe(TIER_1)
    expect(FEATURES.barcode_scan).toBe(TIER_1)
    expect(FEATURES.ai_estimate).toBe(TIER_1)
    expect(FEATURES.ai_photo_scan).toBe(TIER_1)
  })
})
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm run test:run -- tests/lib/tiers.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/tiers.js`**

```js
export const TIER_NONE = 'none'
export const TIER_1    = 'tier1'
export const TIER_2    = 'tier2'

const RANK = { none: 0, tier1: 1, tier2: 2 }

export function hasTier(effective, required) {
  const e = RANK[effective] ?? 0
  const r = RANK[required] ?? 0
  return e >= r
}

export const FEATURES = {
  log_workout:    TIER_1,
  log_nutrition:  TIER_1,
  body_weight:    TIER_1,
  big_three:      TIER_1,
  one_rm:         TIER_1,
  barcode_scan:   TIER_1,
  ai_estimate:    TIER_1,
  ai_photo_scan:  TIER_1,
  detect_muscles: TIER_1,
  meal_text:      TIER_1,
  coach:          TIER_2,
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npm run test:run -- tests/lib/tiers.test.js
```
Expected: 6 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npm run test:run
```
Expected: 109 tests pass (103 prior + 6 new).

- [ ] **Step 6: Commit**

```bash
git add src/lib/tiers.js tests/lib/tiers.test.js
git commit -m "feat(tiers): tier ranks, hasTier, FEATURES map"
```

---

## Task 3: `api/_subscription.js` + tests

**Files:**
- Create: `api/_subscription.js`
- Create: `tests/api/_subscription.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/api/_subscription.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const single = vi.fn()
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  const getUser = vi.fn()
  return { single, eq, select, from, getUser }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mocks.from,
    auth: { getUser: mocks.getUser },
  }),
}))

import { getEffectiveSubscription, requireTier, withTierGate } from '../../api/_subscription.js'

function mockRes() {
  return {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this },
    json(p) { this.payload = p; return this },
  }
}

beforeEach(() => {
  mocks.single.mockReset()
  mocks.getUser.mockReset()
})

describe('getEffectiveSubscription', () => {
  it('returns the row for the user', async () => {
    mocks.single.mockResolvedValueOnce({ data: { user_id: 'u1', effective_tier: 'tier2', trial_days_left: 4, status: 'trialing' }, error: null })
    const sub = await getEffectiveSubscription('u1')
    expect(sub.effective_tier).toBe('tier2')
    expect(mocks.from).toHaveBeenCalledWith('effective_subscription')
  })

  it('returns null when no row exists', async () => {
    mocks.single.mockResolvedValueOnce({ data: null, error: { message: 'No rows' } })
    const sub = await getEffectiveSubscription('u-missing')
    expect(sub).toBeNull()
  })
})

describe('requireTier', () => {
  it('throws 401 when no Authorization header', async () => {
    await expect(requireTier({ headers: {} }, ['tier1', 'tier2'])).rejects.toMatchObject({ status: 401 })
  })

  it('throws 401 when token is invalid', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } })
    await expect(requireTier({ headers: { authorization: 'Bearer bad' } }, ['tier1'])).rejects.toMatchObject({ status: 401 })
  })

  it('throws 403 when effective tier is not in allowed', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mocks.single.mockResolvedValueOnce({ data: { user_id: 'u1', effective_tier: 'tier1' }, error: null })
    await expect(requireTier({ headers: { authorization: 'Bearer ok' } }, ['tier2'])).rejects.toMatchObject({ status: 403 })
  })

  it('returns the subscription when allowed', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mocks.single.mockResolvedValueOnce({ data: { user_id: 'u1', effective_tier: 'tier2', trial_days_left: 4, status: 'trialing' }, error: null })
    const sub = await requireTier({ headers: { authorization: 'Bearer ok' } }, ['tier2'])
    expect(sub.effective_tier).toBe('tier2')
    expect(sub.userId).toBe('u1')
  })
})

describe('withTierGate', () => {
  it('calls the inner handler when allowed', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mocks.single.mockResolvedValueOnce({ data: { user_id: 'u1', effective_tier: 'tier1' }, error: null })
    const inner = vi.fn((_req, res) => res.status(200).json({ ok: true }))
    const handler = withTierGate(['tier1', 'tier2'], inner)
    const res = mockRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer ok' } }, res)
    expect(inner).toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
  })

  it('responds 403 when blocked', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mocks.single.mockResolvedValueOnce({ data: { user_id: 'u1', effective_tier: 'none' }, error: null })
    const inner = vi.fn()
    const handler = withTierGate(['tier1'], inner)
    const res = mockRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer ok' } }, res)
    expect(inner).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
  })
})
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm run test:run -- tests/api/_subscription.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `api/_subscription.js`**

```js
import { createClient } from '@supabase/supabase-js'

let adminClient = null
function getAdmin() {
  if (!adminClient) {
    adminClient = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  return adminClient
}

async function getUserIdFromRequest(req) {
  const authHeader = req.headers?.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await getAdmin().auth.getUser(token)
  return data?.user?.id ?? null
}

export async function getEffectiveSubscription(userId) {
  const { data, error } = await getAdmin()
    .from('effective_subscription')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data
}

export async function requireTier(req, allowed) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) throw { status: 401, body: { error: 'Not signed in' } }
  const sub = await getEffectiveSubscription(userId)
  if (!sub || !allowed.includes(sub.effective_tier)) {
    throw { status: 403, body: { error: 'Subscription required', required: allowed } }
  }
  return { userId, ...sub }
}

export function withTierGate(allowed, handler) {
  return async (req, res) => {
    try {
      const sub = await requireTier(req, allowed)
      req.subscription = sub
      return handler(req, res)
    } catch (err) {
      if (err && err.status) return res.status(err.status).json(err.body)
      throw err
    }
  }
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm run test:run -- tests/api/_subscription.test.js
```
Expected: 8 tests PASS.

```bash
npm run test:run
```
Expected: 117 tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/_subscription.js tests/api/_subscription.test.js
git commit -m "feat(api): _subscription helper with requireTier and withTierGate"
```

---

## Task 4: Wrap `coach-chat` with tier gate

**Files:**
- Modify: `api/coach-chat.js`
- Modify: `tests/api/coach-chat.test.js`

- [ ] **Step 1: Update `api/coach-chat.js`**

Find the current export, which looks like:
```js
export default async function handler(req, res) {
  // …
}
```

Replace with:
```js
import { withTierGate } from './_subscription.js'

async function handler(req, res) {
  // …existing body unchanged…
}

export default withTierGate(['tier2'], handler)
```

Move the existing handler body into the new `async function handler` declaration; don't change its contents.

- [ ] **Step 2: Update `tests/api/coach-chat.test.js`**

At the top of the file (before any other `vi.mock` calls), add:

```js
vi.mock('../../api/_subscription.js', () => ({
  withTierGate: (_allowed, fn) => fn,
  requireTier: vi.fn(),
  getEffectiveSubscription: vi.fn(),
}))
```

This bypasses the gate so the existing 7 tests still test the inner handler directly.

- [ ] **Step 3: Run, confirm pass**

```bash
npm run test:run -- tests/api/coach-chat.test.js
```
Expected: 7 tests PASS.

```bash
npm run test:run
```
Expected: 117 tests pass.

- [ ] **Step 4: Commit**

```bash
git add api/coach-chat.js tests/api/coach-chat.test.js
git commit -m "feat(api): gate coach-chat behind tier2"
```

---

## Task 5: Wrap the 5 AI endpoints with `tier1|tier2` gate

**Files:**
- Modify: `api/analyze-food.js`, `api/analyze-meal-text.js`, `api/detect-muscles.js`, `api/estimate-food.js`, `api/lookup-barcode.js`
- Modify: existing test files for each

For each of the 5 endpoints, apply the same two changes you did for coach-chat in Task 4, but with `withTierGate(['tier1', 'tier2'], handler)` instead.

- [ ] **Step 1: Update `api/analyze-food.js`**

Find the line `export default async function handler(req, res) {`. Convert to:
```js
import { withTierGate } from './_subscription.js'

async function handler(req, res) {
  // existing body unchanged
}

export default withTierGate(['tier1', 'tier2'], handler)
```

- [ ] **Step 2: Update `api/analyze-meal-text.js`** — same pattern as Step 1.

- [ ] **Step 3: Update `api/detect-muscles.js`** — same pattern.

- [ ] **Step 4: Update `api/estimate-food.js`** — same pattern.

- [ ] **Step 5: Update `api/lookup-barcode.js`** — same pattern.

- [ ] **Step 6: Add the subscription mock at the top of each existing test file**

In each of these test files, add the same mock block as the top, before any other `vi.mock` calls:

```js
vi.mock('../../api/_subscription.js', () => ({
  withTierGate: (_allowed, fn) => fn,
  requireTier: vi.fn(),
  getEffectiveSubscription: vi.fn(),
}))
```

Files to update:
- `tests/api/analyze-food.test.js`
- `tests/api/estimate-food.test.js`
- `tests/api/lookup-barcode.test.js`

(If `analyze-meal-text` or `detect-muscles` don't have test files, skip them.)

- [ ] **Step 7: Run, confirm**

```bash
npm run test:run
```
Expected: 117 tests pass.

- [ ] **Step 8: Commit**

```bash
git add api/analyze-food.js api/analyze-meal-text.js api/detect-muscles.js api/estimate-food.js api/lookup-barcode.js tests/api/analyze-food.test.js tests/api/estimate-food.test.js tests/api/lookup-barcode.test.js
git commit -m "feat(api): gate AI + scan endpoints behind tier1|tier2"
```

---

## Task 6: `useSubscription` hook

**Files:**
- Create: `src/hooks/useSubscription.js`

- [ ] **Step 1: Create the hook**

```js
import { useStorage } from './useStorage'

const DEFAULT_SUB = {
  effective_tier: 'none',
  status: 'expired',
  trial_days_left: 0,
  stored_tier: 'free',
  trial_started_at: null,
  trial_ends_at: null,
}

export function useSubscription() {
  const [sub] = useStorage('subscription', DEFAULT_SUB)
  const effectiveTier = sub?.effective_tier ?? 'none'
  return {
    effectiveTier,
    status: sub?.status ?? 'expired',
    daysLeft: sub?.trial_days_left ?? 0,
    storedTier: sub?.stored_tier ?? 'free',
    trialEndsAt: sub?.trial_ends_at ?? null,
    isExpired: effectiveTier === 'none',
  }
}
```

- [ ] **Step 2: Verify**

```bash
npm run test:run
```
Expected: 117 tests pass (hook is one-liner around tested `useStorage`).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSubscription.js
git commit -m "feat(hooks): useSubscription hook over the cached subscription blob"
```

---

## Task 7: Sync `effective_subscription` view on login + register storage key

**Files:**
- Modify: `src/lib/sync.js`
- Modify: `src/components/AuthGuard.jsx`
- Modify: `src/hooks/useStorage.js`

- [ ] **Step 1: Extend `pullAll` in `src/lib/sync.js`**

Locate the existing `pullAll(keys)` function. Replace it with this version, which additionally fetches the `effective_subscription` view:

```js
export async function pullAll(keys) {
  const userId = await getUserId()
  if (!userId) return
  const { data, error } = await supabase
    .from('user_data')
    .select('key, value')
  if (!error && data) {
    for (const row of data) {
      if (keys.includes(row.key)) {
        localStorage.setItem(row.key, JSON.stringify(row.value))
      }
    }
  }
  // Subscription view: pull and cache as a single blob the hook reads.
  if (keys.includes('subscription')) {
    const { data: sub } = await supabase
      .from('effective_subscription')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (sub) localStorage.setItem('subscription', JSON.stringify(sub))
  }
}
```

- [ ] **Step 2: Add `'subscription'` to `SYNC_KEYS` in `src/components/AuthGuard.jsx`**

Find the existing `SYNC_KEYS` constant. Append `'subscription'`:

```jsx
const SYNC_KEYS = [
  'workout_logs', 'nutrition_logs', 'body_weight_logs',
  'meals', 'targets', 'profile', 'exercises', 'custom_foods',
  'big_three_logs',
  'chat_history',
  'subscription',
]
```

- [ ] **Step 3: Add `'subscription'` to `DATA_KEYS` in `src/hooks/useStorage.js`**

This way export-to-file (still kept as dead code) includes the subscription blob. Find:
```js
const DATA_KEYS = ['workout_logs', 'nutrition_logs', 'body_weight_logs', 'meals', 'targets', 'profile', 'exercises', 'custom_foods', 'big_three_logs', 'chat_history']
```
Replace with:
```js
const DATA_KEYS = ['workout_logs', 'nutrition_logs', 'body_weight_logs', 'meals', 'targets', 'profile', 'exercises', 'custom_foods', 'big_three_logs', 'chat_history', 'subscription']
```

Do NOT add to `MIGRATABLE_KEYS` (migration is for `motaz_*` legacy keys — the subscription isn't one).

- [ ] **Step 4: Verify**

```bash
npm run test:run
```
Expected: 117 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync.js src/components/AuthGuard.jsx src/hooks/useStorage.js
git commit -m "feat(sync): pull effective_subscription view into a cached subscription blob"
```

---

## Task 8: `Paywall` component

**Files:**
- Create: `src/components/Paywall.jsx`
- Create: `src/components/Paywall.css`

- [ ] **Step 1: Write `src/components/Paywall.css`**

```css
.paywall-card {
  background: rgba(94, 226, 196, 0.06);
  border: 1px dashed rgba(94, 226, 196, 0.35);
  border-radius: 12px;
  padding: 20px;
  margin: 12px;
  text-align: center;
}

.paywall-icon { font-size: 28px; margin-bottom: 6px; }
.paywall-title { font-size: 16px; font-weight: 700; margin: 4px 0 6px; }
.paywall-body  { font-size: 14px; opacity: 0.85; margin-bottom: 14px; line-height: 1.45; }
.paywall-btn {
  background: var(--accent, #5ee2c4);
  color: #0a0a0a;
  border: 0;
  border-radius: 10px;
  padding: 12px 22px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.paywall-link {
  display: inline-block;
  margin-top: 10px;
  color: var(--accent, #5ee2c4);
  font-size: 13px;
  text-decoration: none;
}
```

- [ ] **Step 2: Write `src/components/Paywall.jsx`**

```jsx
import { useNavigate } from 'react-router-dom'
import { FEATURES } from '../lib/tiers'
import './Paywall.css'

const FEATURE_COPY = {
  coach:          { icon: '🤖', title: 'AI Coach is a Tier 2 feature',     line: 'Subscribe to chat with your coach and let it adjust your program or log meals automatically.' },
  log_workout:    { icon: '🏋️', title: 'Tracking workouts needs a plan',   line: 'Subscribe to log sets, reps, and weights — and watch your strength climb over time.' },
  log_nutrition:  { icon: '🥗', title: 'Logging food needs a plan',        line: 'Subscribe to log meals, hit macro targets, and track nutrition history.' },
  body_weight:    { icon: '⚖️', title: 'Tracking body weight needs a plan',line: 'Subscribe to log daily body-weight and see trends over time.' },
  big_three:      { icon: '🏋️', title: 'Big-three tracking needs a plan', line: 'Subscribe to track your squat, bench, and deadlift progress.' },
  one_rm:         { icon: '📐', title: '1RM estimator needs a plan',       line: 'Subscribe to estimate one-rep maxes from your lift history.' },
  barcode_scan:   { icon: '📊', title: 'Barcode scanning needs a plan',    line: 'Subscribe to scan supermarket products and log their macros instantly.' },
  ai_estimate:    { icon: '✨', title: 'AI macro estimates need a plan',   line: 'Subscribe to estimate macros for foods that aren’t in our database.' },
  ai_photo_scan:  { icon: '📷', title: 'Photo scanning needs a plan',      line: 'Subscribe to snap your meals and get instant macro estimates.' },
  detect_muscles: { icon: '💪', title: 'Auto-detect muscles needs a plan', line: 'Subscribe to auto-detect which muscles an exercise trains.' },
  meal_text:      { icon: '✏️', title: 'AI meal analysis needs a plan',    line: 'Subscribe to estimate macros from a typed meal description.' },
}

export default function Paywall({ feature }) {
  const navigate = useNavigate()
  const copy = FEATURE_COPY[feature] ?? {
    icon: '🔒',
    title: 'Subscription required',
    line: 'Subscribe to keep using this feature.',
  }
  return (
    <div className="paywall-card">
      <div className="paywall-icon">{copy.icon}</div>
      <div className="paywall-title">{copy.title}</div>
      <div className="paywall-body">{copy.line}</div>
      <button className="paywall-btn" onClick={() => navigate('/pricing')}>Choose a plan</button>
      <div><a href="/pricing" className="paywall-link" onClick={(e) => { e.preventDefault(); navigate('/pricing') }}>See what's in each plan ›</a></div>
    </div>
  )
}
```

(`FEATURES` is imported but not used directly here; the `feature` prop maps into the `FEATURE_COPY` table. Keeping the import makes the file self-document the contract.)

- [ ] **Step 3: Verify**

```bash
npm run test:run
npm run build
```
Expected: 117 tests pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/Paywall.jsx src/components/Paywall.css
git commit -m "feat(paywall): reusable Paywall component with per-feature copy"
```

---

## Task 9: `Pricing` page + route + AuthGuard public path

**Files:**
- Create: `src/pages/Pricing.jsx`, `src/pages/Pricing.css`
- Modify: `src/components/AuthGuard.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Write `src/pages/Pricing.css`**

```css
.pricing-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 80px;
}

.pricing-title { font-size: 22px; font-weight: 900; text-align: center; margin: 12px 0 24px; }

.pricing-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
@media (min-width: 560px) {
  .pricing-grid { grid-template-columns: 1fr 1fr; }
}

.pricing-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pricing-card-popular {
  border-color: rgba(94, 226, 196, 0.6);
  box-shadow: 0 0 0 1px rgba(94, 226, 196, 0.3);
}

.pricing-tier { font-size: 14px; opacity: 0.7; letter-spacing: 0.04em; text-transform: uppercase; }
.pricing-price { font-size: 28px; font-weight: 800; }
.pricing-price-suffix { font-size: 14px; opacity: 0.6; font-weight: 500; }

.pricing-popular-pill {
  display: inline-block;
  background: rgba(94, 226, 196, 0.15);
  color: var(--accent, #5ee2c4);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  width: max-content;
}

.pricing-features { list-style: none; padding: 0; margin: 8px 0; font-size: 14px; line-height: 1.7; }
.pricing-features li::before { content: '\2713 '; color: var(--accent, #5ee2c4); margin-right: 4px; }
.pricing-features li.disabled { opacity: 0.45; }
.pricing-features li.disabled::before { content: '\2717 '; color: #ff8b8b; }

.pricing-subscribe {
  background: var(--accent, #5ee2c4);
  color: #0a0a0a;
  border: 0;
  border-radius: 10px;
  padding: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.pricing-soon { background: rgba(255, 204, 0, 0.1); border: 1px solid rgba(255, 204, 0, 0.4); color: #ffd34a; padding: 10px; border-radius: 10px; font-size: 13px; margin-top: 12px; text-align: center; }
.pricing-trial { font-size: 13px; opacity: 0.7; text-align: center; margin-top: 24px; }
```

- [ ] **Step 2: Write `src/pages/Pricing.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Pricing.css'

export default function Pricing() {
  const navigate = useNavigate()
  const [contactMessage, setContactMessage] = useState('')

  function handleSubscribe(tier) {
    setContactMessage(
      `Coming soon. Email adelmotaz861@gmail.com with "Subscribe to ${tier}" and we'll set you up manually until automated billing ships.`
    )
  }

  return (
    <div className="pricing-page">
      <h1 className="pricing-title">Choose your plan</h1>

      <div className="pricing-grid">
        <div className="pricing-card">
          <span className="pricing-tier">Tier 1</span>
          <div className="pricing-price">$XX<span className="pricing-price-suffix">/mo</span></div>
          <ul className="pricing-features">
            <li>Track every workout</li>
            <li>Log meals + body weight</li>
            <li>Big-three + 1RM tracking</li>
            <li>Barcode scanner</li>
            <li>AI macro estimates</li>
            <li>Photo food scanner</li>
            <li className="disabled">AI Coach</li>
          </ul>
          <button className="pricing-subscribe" onClick={() => handleSubscribe('Tier 1')}>Subscribe</button>
        </div>

        <div className="pricing-card pricing-card-popular">
          <span className="pricing-popular-pill">Most popular</span>
          <span className="pricing-tier">Tier 2</span>
          <div className="pricing-price">$XX<span className="pricing-price-suffix">/mo</span></div>
          <ul className="pricing-features">
            <li>Everything in Tier 1</li>
            <li><strong>AI Coach</strong> — chat to adjust your program, log food automatically</li>
          </ul>
          <button className="pricing-subscribe" onClick={() => handleSubscribe('Tier 2')}>Subscribe</button>
        </div>
      </div>

      {contactMessage && <div className="pricing-soon">{contactMessage}</div>}

      <p className="pricing-trial">💡 7-day free trial included — Tier 2 access, auto-started at signup.</p>

      <p className="pricing-trial">
        <a href="/dashboard" onClick={(e) => { e.preventDefault(); navigate('/dashboard') }}>← Back</a>
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Add `/pricing` to AuthGuard `PUBLIC_PATHS`**

In `src/components/AuthGuard.jsx`, find the `PUBLIC_PATHS` set and add `/pricing`:
```jsx
const PUBLIC_PATHS = new Set([
  '/login', '/signup', '/forgot-password', '/reset-password',
  '/verify-email', '/privacy', '/terms',
  '/pricing',
])
```

- [ ] **Step 4: Register the `/pricing` route in `src/App.jsx`**

Inside the `<Routes>` block, alongside the other public routes:
```jsx
import Pricing from './pages/Pricing'

// in <Routes>:
<Route path="/pricing" element={<Pricing />} />
```

- [ ] **Step 5: Verify**

```bash
npm run test:run
npm run build
```
Expected: 117 tests pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Pricing.jsx src/pages/Pricing.css src/components/AuthGuard.jsx src/App.jsx
git commit -m "feat(pricing): public pricing page with placeholder Subscribe buttons"
```

---

## Task 10: `SubscriptionCard` component (4 variants)

**Files:**
- Create: `src/components/SubscriptionCard.jsx`
- Modify: `src/pages/Settings.css`

- [ ] **Step 1: Append styles to `src/pages/Settings.css`**

```css
.sub-card { padding: 16px; }
.sub-card-warning { background: rgba(255, 204, 0, 0.1); border-color: rgba(255, 204, 0, 0.5); }
.sub-card-expired { background: rgba(255, 80, 80, 0.07); border-color: rgba(255, 80, 80, 0.4); }

.sub-card-title { font-weight: 700; font-size: 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.sub-card-row { display: flex; justify-content: space-between; font-size: 14px; opacity: 0.85; padding: 4px 0; }
.sub-card-row-label { opacity: 0.6; }

.sub-card-cta { width: 100%; padding: 12px; border-radius: 10px; border: 0; background: var(--accent, #5ee2c4); color: #0a0a0a; font-size: 14px; font-weight: 700; cursor: pointer; margin-top: 10px; }
.sub-card-link { display: inline-block; margin-top: 8px; font-size: 13px; color: var(--accent, #5ee2c4); cursor: pointer; background: transparent; border: 0; padding: 0; }
.sub-card-body { font-size: 14px; opacity: 0.85; margin: 4px 0 8px; line-height: 1.5; }
```

- [ ] **Step 2: Create `src/components/SubscriptionCard.jsx`**

```jsx
import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'

function format(date) {
  if (!date) return ''
  return new Date(date).toISOString().slice(0, 10)
}

function variantOf({ status, daysLeft, effectiveTier }) {
  if (status === 'active') return 'active'
  if (status === 'trialing' && daysLeft > 2) return 'trialing'
  if (status === 'trialing' && daysLeft <= 2) return 'warning'
  return 'expired'
}

export default function SubscriptionCard() {
  const navigate = useNavigate()
  const sub = useSubscription()
  const v = variantOf(sub)

  if (v === 'active') {
    return (
      <div className="card settings-card sub-card">
        <div className="sub-card-title">🎟️ Subscription</div>
        <div className="sub-card-row"><span className="sub-card-row-label">Status</span><span>Active</span></div>
        <div className="sub-card-row"><span className="sub-card-row-label">Tier</span><span>{sub.storedTier === 'tier2' ? 'Tier 2 (full access)' : 'Tier 1'}</span></div>
        <button className="sub-card-cta" onClick={() => navigate('/pricing')}>Manage plan</button>
        <button className="sub-card-link" onClick={() => navigate('/pricing')}>Compare plans ›</button>
      </div>
    )
  }

  if (v === 'trialing') {
    return (
      <div className="card settings-card sub-card">
        <div className="sub-card-title">🎟️ Subscription</div>
        <div className="sub-card-row"><span className="sub-card-row-label">Status</span><span>Trialing</span></div>
        <div className="sub-card-row"><span className="sub-card-row-label">Tier</span><span>Trial (Tier 2 access)</span></div>
        <div className="sub-card-row"><span className="sub-card-row-label">Days left in trial</span><span>{sub.daysLeft}</span></div>
        <button className="sub-card-cta" onClick={() => navigate('/pricing')}>Choose a plan</button>
        <button className="sub-card-link" onClick={() => navigate('/pricing')}>See what's in each plan ›</button>
      </div>
    )
  }

  if (v === 'warning') {
    return (
      <div className="card settings-card sub-card sub-card-warning">
        <div className="sub-card-title">⚠️ Your trial ends in {sub.daysLeft} {sub.daysLeft === 1 ? 'day' : 'days'}</div>
        <div className="sub-card-body">
          Choose a plan now to keep tracking, logging meals, and using AI Coach.
        </div>
        <button className="sub-card-cta" onClick={() => navigate('/pricing')}>Choose a plan</button>
        <button className="sub-card-link" onClick={() => navigate('/pricing')}>See what's in each plan ›</button>
      </div>
    )
  }

  // expired (default)
  return (
    <div className="card settings-card sub-card sub-card-expired">
      <div className="sub-card-title">🔒 Subscription expired</div>
      <div className="sub-card-body">
        Trial ended on {format(sub.trialEndsAt)}. Subscribe to keep using IronMind.
      </div>
      <button className="sub-card-cta" onClick={() => navigate('/pricing')}>Subscribe</button>
      <button className="sub-card-link" onClick={() => navigate('/pricing')}>See plans ›</button>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npm run test:run
npm run build
```
Expected: 117 tests pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/SubscriptionCard.jsx src/pages/Settings.css
git commit -m "feat(settings): SubscriptionCard with active/trialing/warning/expired variants"
```

---

## Task 11: Mount `SubscriptionCard` in Settings → Account

**Files:**
- Modify: `src/pages/Settings.jsx`

- [ ] **Step 1: Add the import**

At the top of `src/pages/Settings.jsx`:
```jsx
import SubscriptionCard from '../components/SubscriptionCard'
```

- [ ] **Step 2: Mount inside the Account section**

Find the `<div className="settings-section danger-zone">` (or whatever wraps Logout / Change password / Delete account). At the TOP of that block — before the Logout button — insert:

```jsx
<SubscriptionCard />
```

So the Account section reads: Subscription card → Logout button → Change password (+form/flash) → Delete account.

- [ ] **Step 3: Verify**

```bash
npm run test:run
npm run build
```
Expected: 117 tests pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Settings.jsx
git commit -m "feat(settings): mount SubscriptionCard at the top of Account section"
```

---

## Task 12: Gate the Coach page entirely

**Files:**
- Modify: `src/pages/Coach.jsx`

- [ ] **Step 1: Add imports**

At the top of `src/pages/Coach.jsx`, alongside existing imports:
```jsx
import { useSubscription } from '../hooks/useSubscription'
import { hasTier, TIER_2 } from '../lib/tiers'
import Paywall from '../components/Paywall'
```

- [ ] **Step 2: Add the gate at the top of the component's return**

Inside the `Coach` function, just before the existing `return (...)`, add:

```jsx
const { effectiveTier } = useSubscription()
if (!hasTier(effectiveTier, TIER_2)) {
  return (
    <div className="coach-page">
      <div className="coach-header">
        <span className="coach-title">🤖 AI Coach</span>
      </div>
      <Paywall feature="coach" />
    </div>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npm run test:run
npm run build
```
Expected: 117 tests pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Coach.jsx
git commit -m "feat(coach): top-level paywall for non-tier2 users"
```

---

## Task 13: Gate writes in `WorkoutLogger.jsx`

**Files:**
- Modify: `src/pages/WorkoutLogger.jsx`

- [ ] **Step 1: Add imports**

```jsx
import { useSubscription } from '../hooks/useSubscription'
import { hasTier, TIER_1 } from '../lib/tiers'
import Paywall from '../components/Paywall'
```

- [ ] **Step 2: Add the hook + a tiny modal state**

Inside the `WorkoutLogger` function, near the other `useState` calls:
```jsx
const { effectiveTier } = useSubscription()
const canWrite = hasTier(effectiveTier, TIER_1)
const [paywallOpen, setPaywallOpen] = useState(false)
```

- [ ] **Step 3: Guard write actions**

For every handler that mutates `workoutLogs` or `classes` (e.g. `toggleSetCompleted`, `addSet`, `markComplete`, `editProgram`, etc. — look for `setWorkoutLogs`, `setProgram`, `setClasses` calls), wrap the body at the top:

```jsx
if (!canWrite) { setPaywallOpen(true); return }
```

Apply this guard ONLY to functions that write. Read-only computations stay free.

- [ ] **Step 4: Render the modal**

At the bottom of the page's JSX (still inside the outermost wrapper), add:

```jsx
{paywallOpen && (
  <div className="paywall-modal-bg" onClick={() => setPaywallOpen(false)}>
    <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
      <Paywall feature="log_workout" />
    </div>
  </div>
)}
```

- [ ] **Step 5: Add modal styles**

Append to `src/pages/WorkoutLogger.css`:

```css
.paywall-modal-bg {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: grid;
  place-items: center;
  z-index: 100;
  padding: 20px;
}
.paywall-modal {
  max-width: 400px;
  width: 100%;
  background: #121821;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.08);
  overflow: hidden;
}
```

- [ ] **Step 6: Verify**

```bash
npm run test:run
npm run build
```
Expected: 117 tests pass; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/pages/WorkoutLogger.jsx src/pages/WorkoutLogger.css
git commit -m "feat(workout): gate write actions behind tier1 with paywall modal"
```

---

## Task 14: Gate writes in `Nutrition.jsx`

**Files:**
- Modify: `src/pages/Nutrition.jsx`

- [ ] **Step 1: Add imports** (same as Task 13):

```jsx
import { useSubscription } from '../hooks/useSubscription'
import { hasTier, TIER_1 } from '../lib/tiers'
import Paywall from '../components/Paywall'
```

- [ ] **Step 2: Add hook + state**

```jsx
const { effectiveTier } = useSubscription()
const canWrite = hasTier(effectiveTier, TIER_1)
const [paywallOpen, setPaywallOpen] = useState(false)
```

- [ ] **Step 3: Guard the writes**

The page already has a useEffect that consumes `location.state.quickLog` (from Task 6 / earlier work). Guard it too — if `!canWrite`, do not process the quickLog. The other writes you must guard:

- `toggleMeal(mealId)` — wrap body
- `adjustCalories(delta)` — wrap body
- `saveMeal(updatedMeal)` — wrap body
- `deleteMeal(mealId)` — wrap body
- `toggleFavorite(mealId)` — wrap body
- `addQuickLog(entry)` — wrap body
- `deleteQuickLog(id)` — wrap body
- The quickLog-from-location-state useEffect — replace `if (!entry) return` with `if (!entry || !canWrite) return`. (If `!canWrite`, also call `setPaywallOpen(true)` so the user gets feedback.)

Pattern for handler bodies:
```jsx
function toggleMeal(mealId) {
  if (!canWrite) { setPaywallOpen(true); return }
  // existing body
}
```

- [ ] **Step 4: Also gate the **Search** / **Scan** entry buttons in the header**

The `<button>` that navigates to `/food-search` and the one to `/food-scan`: wrap the onClick:

```jsx
<button className="nutrition-scan-btn" onClick={() => canWrite ? navigate('/food-search') : setPaywallOpen(true)}>🔍</button>
<button className="nutrition-scan-btn" onClick={() => canWrite ? navigate('/food-scan') : setPaywallOpen(true)}>📷</button>
```

- [ ] **Step 5: Render the modal**

At the bottom of the page's JSX:
```jsx
{paywallOpen && (
  <div className="paywall-modal-bg" onClick={() => setPaywallOpen(false)}>
    <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
      <Paywall feature="log_nutrition" />
    </div>
  </div>
)}
```

(The CSS classes `paywall-modal-bg` / `paywall-modal` were defined in Task 13's CSS. Either import that CSS here or duplicate the rules in `src/pages/Nutrition.css` — pick whichever your existing structure already does. Recommend: import `'../pages/WorkoutLogger.css'` is too coupled. Instead, **append the same 2 CSS blocks to `src/pages/Nutrition.css`**.)

- [ ] **Step 6: Verify**

```bash
npm run test:run
npm run build
```
Expected: 117 tests pass; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Nutrition.jsx src/pages/Nutrition.css
git commit -m "feat(nutrition): gate write actions and search/scan entry behind tier1"
```

---

## Task 15: Gate `FoodSearchPage.jsx` + `FoodScannerPage.jsx`

**Files:**
- Modify: `src/pages/FoodSearchPage.jsx`
- Modify: `src/pages/FoodScannerPage.jsx`
- Modify: `src/components/ExerciseEditForm.jsx`

- [ ] **Step 1: Gate `FoodSearchPage.jsx`**

If a user lands on this page with `effectiveTier === 'none'` (e.g. via direct URL), render only the Paywall. Add at the top of the component (before the existing render):

```jsx
const { effectiveTier } = useSubscription()
if (!hasTier(effectiveTier, TIER_1)) {
  return (
    <div className="fpage">
      <div className="fpage-header">
        <button className="fpage-back" onClick={() => navigate(-1)}>←</button>
        <span className="fpage-title">Search food</span>
      </div>
      <Paywall feature="log_nutrition" />
    </div>
  )
}
```

Imports:
```jsx
import { useSubscription } from '../hooks/useSubscription'
import { hasTier, TIER_1 } from '../lib/tiers'
import Paywall from '../components/Paywall'
```

- [ ] **Step 2: Gate `FoodScannerPage.jsx`** — same pattern:

```jsx
const { effectiveTier } = useSubscription()
if (!hasTier(effectiveTier, TIER_1)) {
  return <Paywall feature="ai_photo_scan" />
}
```
(Imports same as Step 1; pick a sensible header / wrapper based on what `FoodScannerPage.jsx` already uses.)

- [ ] **Step 3: Gate the detect-muscles call in `ExerciseEditForm.jsx`**

Find the function (likely `detectMuscles` or similar) that does `fetch('/api/detect-muscles', …)`. At its top, add:

```jsx
const { effectiveTier } = useSubscription()
const canCallDetect = hasTier(effectiveTier, TIER_1)
```

Then wrap the call:
```jsx
async function detectMuscles() {
  if (!canCallDetect) return  // no-op — the backend would 403 anyway
  // existing body
}
```

Imports inside `ExerciseEditForm.jsx`:
```jsx
import { useSubscription } from '../hooks/useSubscription'
import { hasTier, TIER_1 } from '../lib/tiers'
```

- [ ] **Step 4: Verify**

```bash
npm run test:run
npm run build
```
Expected: 117 tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/FoodSearchPage.jsx src/pages/FoodScannerPage.jsx src/components/ExerciseEditForm.jsx
git commit -m "feat(food): gate search/scan pages and detect-muscles behind tier1"
```

---

## Task 16: Final manual verification

**Files:** none

- [ ] **Step 1: Lint, tests, build**

```bash
npm run lint
npm run test:run
npm run build
```
Expected: tests pass (117), build succeeds.

- [ ] **Step 2: Apply the SQL migration manually**

In the Supabase SQL Editor, run the contents of `supabase/migrations/2026-06-09-subscriptions.sql`. Expected: success, three new columns visible on `profiles`, view exists, trigger updated.

- [ ] **Step 3: Add `SUPABASE_SERVICE_ROLE_KEY` to local `.env.local`**

Get it from Supabase Project Settings → API → service_role secret. Add as a new line to `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=...
```

- [ ] **Step 4: Run dev server**

```bash
npm run dev
```

- [ ] **Step 5: Walk the success criteria**

- [ ] Sign up a fresh test account. Settings → Account → Subscription card shows "Trialing · 7 days left". Coach + write actions all work.
- [ ] In Supabase dashboard, set this user's `trial_ends_at` to `now() + 1.5 days`. Reload — Subscription card flips to the yellow warning variant. Coach still works.
- [ ] Set `trial_ends_at` to `now() - 1 day`. Reload — Subscription card shows expired. Coach renders the Paywall. Workout/Nutrition write actions open the paywall modal. Dashboard / Progress show existing data read-only.
- [ ] Manually set `subscription_status = 'active'` and `tier = 'tier1'`. Reload. Coach still paywalled. Workout/Nutrition work. AI estimate works. Barcode works.
- [ ] Set `tier = 'tier2'`. Reload. Coach works again.
- [ ] Open the network tab; while expired, manually POST to `/api/coach-chat` with a logged-in token. Expected: 403.
- [ ] While `tier1`, POST to `/api/coach-chat`. Expected: 403. POST to `/api/analyze-food` with a real image. Expected: 200.
- [ ] Visit `/pricing` while logged out. The page renders. Subscribe button shows the "Coming soon" message on click.

- [ ] **Step 6: Stop the dev server**

Ctrl+C.

> No commit for this task — verification only.

---

## Self-review notes

**Spec coverage:**
- Schema additions, trigger, view → Task 1
- Tier constants + hasTier + FEATURES → Task 2
- Backend helper + tests → Task 3
- Coach endpoint gate → Task 4
- AI/scan endpoint gates → Task 5
- `useSubscription` hook → Task 6
- Pull view on login + register sync key → Task 7
- Paywall component → Task 8
- Pricing page + route + public path → Task 9
- SubscriptionCard variants → Task 10
- Mount in Settings → Task 11
- Coach page top-level gate → Task 12
- WorkoutLogger gate → Task 13
- Nutrition gate → Task 14
- FoodSearch / FoodScanner / ExerciseEditForm gates → Task 15
- Final verification → Task 16

**Names consistent across tasks:**
- `effective_tier` (DB), `effectiveTier` (JS) — matches the spec's view column / hook return field
- `subscription_status` / `status`, `trial_days_left` / `daysLeft`, `trial_ends_at` / `trialEndsAt` — paired DB→JS
- `hasTier`, `FEATURES`, `TIER_NONE`, `TIER_1`, `TIER_2` — used identically in tiers.js, Paywall, every gated page
- `withTierGate(allowed, handler)` — every endpoint wraps with the same signature

**Trade-offs flagged:**
- The Vite test environment doesn't reach Supabase; tests rely on `vi.mock` patterns that match the existing codebase (`vi.hoisted`, factory mocks).
- The detect-muscles client-side gate uses `return` (silently no-op) because the only call site is auto-triggered on input blur. A more visible UX (small "Subscribe to auto-detect" hint) is deferred for now — the backend 403 ensures correctness.
- Subscription pulled on every login + page focus event via the existing sync.js triggers; no extra polling. The trial countdown could go stale until the next sync, but for a 7-day clock that's invisible.
- The trial-ending warning state uses inline yellow tokens rather than new CSS variables, matching the existing AI-estimate badge style — consistent without scope creep.
- The Subscription card is mounted at the top of Account (above Logout) so the most actionable item is the most visible.
