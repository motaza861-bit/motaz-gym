# Subscriptions Phase 1: Data Model, Trial, and Gating

**Date:** 2026-06-09
**Status:** Draft (awaiting user approval)
**Phase:** 1 of 3 (Phase 2 = Stripe integration · Phase 3 = onboarding tour. Both separate specs.)

## Goal

Introduce two-tier subscriptions with a 7-day free trial to IronMind. After this phase ships, the app understands who is paid, who is trialing, and who has expired — and enforces feature gating accordingly. **No real payments yet** — Subscribe buttons are placeholders until Phase 2.

## Phase 1 scope

- Add subscription tracking columns to the existing `profiles` table.
- Auto-start a 7-day Tier 2 trial on signup.
- A SQL view computes the user's `effective_tier` lazily (no cron).
- Backend rejects API calls whose required tier exceeds the caller's effective tier (403).
- Frontend gates write actions and the Coach page; read-only stays accessible after trial expiry.
- New `/pricing` page lists the two tiers (placeholder Subscribe buttons).
- New Subscription card in Settings shows status / days left.
- One-trial-per-account: a user whose `subscription_status` ever leaves `trialing` cannot return to `trialing`.

## Non-goals (deferred)

- Stripe Checkout / billing portal / webhook → Phase 2 spec.
- Onboarding tour ("what this app can do") → Phase 3 spec.
- Promo codes, gift subscriptions, family plans, annual prices, refunds.
- Pricing copy: actual numbers and currency are placeholders here.
- Re-trial workflow. Manual admin override via the Supabase dashboard only.
- Email / push reminders ("Your trial expires in 2 days") → Phase 2 candidate.

## Tier definitions

The source of truth is `src/lib/tiers.js`. Effective tier comes from a SQL view, exposed to the client.

| Feature | `none` (free / expired) | `tier1` | `tier2` |
|---|:-:|:-:|:-:|
| Read existing data (Dashboard / Workout / Nutrition / Progress) | ✓ | ✓ | ✓ |
| Settings (Appearance, Profile, Account, About) | ✓ | ✓ | ✓ |
| Log workouts / sets / weights | — | ✓ | ✓ |
| Log nutrition (manual + favourites) | — | ✓ | ✓ |
| Body weight + big-three tracking | — | ✓ | ✓ |
| 1RM estimator | — | ✓ | ✓ |
| Barcode scanner (lookup-barcode API) | — | ✓ | ✓ |
| AI text estimate (estimate-food API) | — | ✓ | ✓ |
| AI photo scanner (analyze-food API) | — | ✓ | ✓ |
| Detect-muscles in ExerciseEditForm | — | ✓ | ✓ |
| Add quick nutrition log from search (analyze-meal-text) | — | ✓ | ✓ |
| **AI Coach (chat + tool calls)** | — | — | ✓ |

Trial gives `tier2` access. After trial: `none`.

## Data model

### Schema additions (append to `supabase/schema.sql`)

```sql
-- Already exists from cloud-sync spec: profiles.tier text default 'free'.
-- Add the rest.

alter table public.profiles add column if not exists subscription_status text not null default 'trialing'
  check (subscription_status in ('trialing', 'active', 'expired', 'canceled'));
alter table public.profiles add column if not exists trial_started_at timestamptz default now();
alter table public.profiles add column if not exists trial_ends_at    timestamptz default now() + interval '7 days';
```

### Updated `handle_new_user` trigger

Replace the existing function:

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, tier, subscription_status, trial_started_at, trial_ends_at)
  values (new.id, new.email, 'free', 'trialing', now(), now() + interval '7 days');
  return new;
end;
$$;
```

### New view

```sql
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

RLS on the view is inherited from `profiles`. Users can only see their own row.

### Migration impact

Existing user accounts (only one or two at this point) have `tier='free'` and no other subscription columns. The `alter table add column` clauses use `default`, so:
- `subscription_status` defaults to `'trialing'`
- `trial_started_at` defaults to `now()` at migration time
- `trial_ends_at` defaults to `now() + 7 days`

This effectively grants existing users a fresh 7-day trial. Acceptable for v1.

## Frontend gating

### Constants — `src/lib/tiers.js`

```js
export const TIER_NONE  = 'none'
export const TIER_1     = 'tier1'
export const TIER_2     = 'tier2'

const TIER_RANK = { none: 0, tier1: 1, tier2: 2 }

export function hasTier(effective, required) {
  return TIER_RANK[effective] >= TIER_RANK[required]
}

// Feature → required tier. Used by Paywall to know what's needed.
export const FEATURES = {
  log_workout:     TIER_1,
  log_nutrition:   TIER_1,
  body_weight:     TIER_1,
  big_three:       TIER_1,
  one_rm:          TIER_1,
  barcode_scan:    TIER_1,
  ai_estimate:     TIER_1,
  ai_photo_scan:   TIER_1,
  detect_muscles:  TIER_1,
  meal_text:       TIER_1,
  coach:           TIER_2,
}
```

### Hook — `src/hooks/useSubscription.js`

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
  return {
    effectiveTier: sub.effective_tier ?? 'none',
    status: sub.status ?? 'expired',
    daysLeft: sub.trial_days_left ?? 0,
    storedTier: sub.stored_tier ?? 'free',
    trialEndsAt: sub.trial_ends_at,
    isExpired: (sub.effective_tier ?? 'none') === 'none',
  }
}
```

`subscription` is added to `SYNC_KEYS` in `AuthGuard.jsx`. On every login, `AuthGuard.pullAll()` selects `effective_subscription` for the current user and writes it into the `subscription` storage key. That cached snapshot is what `useSubscription()` reads.

### Component — `src/components/Paywall.jsx`

```jsx
<Paywall feature="coach" />
```

Looks up the required tier from `FEATURES[feature]`, renders a card with:
- Lock icon
- Plain-language explanation ("AI Coach is a Tier 2 feature.")
- Subscribe button → `navigate('/pricing')`
- Trial countdown if user is still trialing on a lower tier (shouldn't happen — trial = tier2 — but defensive)

### Where it gets used

- **Coach page** (`src/pages/Coach.jsx`): top-level — if `!hasTier(effectiveTier, TIER_2)`, render `<Paywall feature="coach" />` instead of the chat UI.
- **WorkoutLogger**: existing write actions (logging sets, marking complete, editing exercises) check `hasTier(effectiveTier, TIER_1)` first. If not, show a modal Paywall.
- **Nutrition**: same — adding meals / marking eaten / opening photo / barcode flow all gated.
- **FoodSearchPage**: the 📊 Scan barcode button, the search input, the AI estimate button all gated. Read-only viewing of custom foods stays accessible.
- **FoodScannerPage**: gated entire page.
- **ExerciseEditForm**: the "Detect muscles" call gated; manual editing stays.

Read-only flow stays unchanged for `none` tier — they can navigate everywhere and see their existing data; they just can't write new entries or trigger AI calls.

## Backend gating

### Helper — `api/_subscription.js`

```js
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const TIER_RANK = { none: 0, tier1: 1, tier2: 2 }

async function getUserIdFromRequest(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await adminClient.auth.getUser(token)
  return data?.user?.id ?? null
}

export async function getEffectiveSubscription(userId) {
  const { data } = await adminClient
    .from('effective_subscription')
    .select('*')
    .eq('user_id', userId)
    .single()
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

// Wrapper for endpoints — converts thrown {status, body} into a real HTTP response.
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

### New env vars (Vercel)

- `SUPABASE_SERVICE_ROLE_KEY` — already needed by `delete_my_account` flow if we keep it server-side, but currently the RPC handles it. Add it now for the subscription helper.

### Endpoint updates

Each protected endpoint wraps its handler:

```js
// api/coach-chat.js
import { withTierGate } from './_subscription.js'
export default withTierGate(['tier2'], async function handler(req, res) {
  // existing body unchanged
})

// api/analyze-food.js, api/estimate-food.js, api/detect-muscles.js,
// api/lookup-barcode.js, api/analyze-meal-text.js
export default withTierGate(['tier1', 'tier2'], async function handler(req, res) { … })
```

Endpoints that don't need gating: `api/search-food.js` (text search via OFF is free), and any future read-only endpoints.

## Pricing page

Route: `/pricing` (added to AuthGuard's `PUBLIC_PATHS` so it's accessible logged out too).

### Layout

```
┌──────────────────────────────────────────────────┐
│  Choose your plan                                │
│                                                   │
│  ┌─────────────────┐    ┌─────────────────┐     │
│  │  Tier 1         │    │  Tier 2         │     │
│  │  $XX/mo         │    │  $XX/mo         │     │
│  │                 │    │  Most popular   │     │
│  │  ✓ Track every  │    │                 │     │
│  │    workout      │    │  Everything in  │     │
│  │  ✓ Photo scan   │    │  Tier 1 plus:   │     │
│  │  ✓ Barcode      │    │  ✓ AI Coach     │     │
│  │  ✓ AI macros    │    │                 │     │
│  │  ✗ No AI Coach  │    │                 │     │
│  │                 │    │                 │     │
│  │ [ Subscribe ]   │    │ [ Subscribe ]   │     │
│  └─────────────────┘    └─────────────────┘     │
│                                                   │
│  💡 7-day free trial included                    │
│  (Tier 2 access, auto-started at signup)         │
└──────────────────────────────────────────────────┘
```

### Subscribe buttons — Phase 1 behavior

- The button visibly renders as a real Subscribe button.
- On click: shows an inline message: "Coming soon. Email **adelmotaz861@gmail.com** to subscribe manually."
- The button is NOT disabled (so it visually feels like a real plan).

This placeholder gets replaced in Phase 2 with a real Stripe Checkout call.

## Settings: Subscription card

Inserted at the top of the Account section, above Change Password.

### Normal trialing (`daysLeft > 2`)

```
┌────────────────────────────────────────┐
│  🎟️  Subscription                       │
├────────────────────────────────────────┤
│  Status:  Trialing                      │
│  Tier:    Trial (Tier 2 access)         │
│  Days left in trial: 4                  │
│                                          │
│  [ Choose a plan ]                      │
│  See what's in each plan ›              │  ← Compare plans link → /pricing
└────────────────────────────────────────┘
```

### Trial ending soon (`daysLeft <= 2`) — yellow warning state

```
┌────────────────────────────────────────┐
│  ⚠️  Your trial ends in 1 day            │  ← yellow background + accent border
├────────────────────────────────────────┤
│  Choose a plan now to keep tracking,    │
│  logging meals, and using AI Coach.     │
│                                          │
│  [ Choose a plan ]                      │
│  See what's in each plan ›              │
└────────────────────────────────────────┘
```

### Expired

```
┌────────────────────────────────────────┐
│  🔒  Subscription expired                │
├────────────────────────────────────────┤
│  Trial ended on 2026-06-16              │
│  Subscribe to keep using IronMind.      │
│                                          │
│  [ Subscribe ]                          │
│  See plans ›                            │
└────────────────────────────────────────┘
```

### Active (`status === 'active'`)

```
┌────────────────────────────────────────┐
│  🎟️  Subscription                       │
├────────────────────────────────────────┤
│  Status:  Active                        │
│  Tier:    Tier 2 (full access)          │
│                                          │
│  [ Manage plan ]   ← /pricing in Phase 1│
│  Compare plans ›                        │
└────────────────────────────────────────┘
```

### Behaviour rules

- The card chooses the variant based on `useSubscription()`'s result:
  - `status === 'active'` → Active variant
  - `status === 'trialing' && daysLeft > 2` → Normal trialing variant
  - `status === 'trialing' && daysLeft <= 2` → Warning variant (yellow)
  - everything else (`expired`, `canceled`, `none` effective tier) → Expired variant
- The **Compare plans link** is identical across variants and just routes to `/pricing`.
- The **Warning variant** uses the existing `--warning` / yellow design tokens already used by the spec's AI estimate badge (`rgba(255, 204, 0, 0.1)` background, `#ffd34a` text), so we don't introduce new CSS variables.

## Auth flow integration

- `AuthGuard` already pulls user data on login. Add `subscription` to `SYNC_KEYS` and have `pullAll` fetch from the `effective_subscription` view.
- On every page focus (existing `sync.js` flush trigger), re-fetch `effective_subscription` so the trial countdown stays fresh.
- On the moment the trial visibly expires (`days_left` transitions to 0), no special UX event needed — the next render shows the paywall.

## Error handling

- Backend 403 from a gated endpoint surfaces to the client. The client shouldn't normally hit a 403 because the UI is already paywalled, but a stale cached subscription state could allow it. On 403, force-refresh subscription state and re-render the paywall.
- A user whose token is invalid (401) gets routed to `/login` (existing AuthGuard behaviour).
- DB view returning no row (e.g. profile not yet created): treat as `effective_tier='none'`.

## Files added / modified

### Added
- `supabase/migrations/2026-06-09-subscriptions.sql` (or appended block to `supabase/schema.sql` — implementation detail)
- `src/lib/tiers.js`
- `src/hooks/useSubscription.js`
- `src/components/Paywall.jsx`, `src/components/Paywall.css`
- `src/components/SubscriptionCard.jsx`
- `src/pages/Pricing.jsx`, `src/pages/Pricing.css`
- `api/_subscription.js`
- `tests/lib/tiers.test.js`
- `tests/api/_subscription.test.js` (mocked Supabase)

### Modified
- `supabase/schema.sql` — columns, trigger update, view
- `src/App.jsx` — `/pricing` route added (public, before AuthGuard)
- `src/components/AuthGuard.jsx` — `'subscription'` added to `SYNC_KEYS`; `PUBLIC_PATHS` includes `/pricing`
- `src/lib/sync.js` — `pullAll` reads `effective_subscription` view in addition to existing keys (small generalization)
- `src/pages/Coach.jsx` — top-level paywall guard
- `src/pages/WorkoutLogger.jsx` — write actions gated
- `src/pages/Nutrition.jsx` — write actions gated
- `src/pages/FoodSearchPage.jsx` — search + scan + estimate gated
- `src/pages/FoodScannerPage.jsx` — page gated
- `src/components/ExerciseEditForm.jsx` — detect-muscles call gated
- `src/pages/Settings.jsx` — mounts `<SubscriptionCard />` in Account section
- `api/coach-chat.js`, `api/analyze-food.js`, `api/estimate-food.js`, `api/detect-muscles.js`, `api/lookup-barcode.js`, `api/analyze-meal-text.js` — each wrapped in `withTierGate(...)`
- `src/i18n/translations.js` — new keys: `pricing.*`, `paywall.*`, `sub.*`
- Vercel env vars: `SUPABASE_SERVICE_ROLE_KEY`

### Unchanged
- Cloud-sync data shapes
- Existing tests (gate addition shouldn't break mocked endpoint tests; new tests cover the gate)

## Success criteria

1. SQL schema migration applies cleanly on a fresh Supabase project.
2. A brand-new account: signup → land on Dashboard → Coach works → all features accessible. Settings → Subscription shows "Trialing · 7 days left".
3. Manually setting `trial_ends_at` to a past date in Supabase: refresh app → Coach page now shows Paywall; WorkoutLogger refuses to save a new set (shows Paywall modal); read-only views (Dashboard, Progress) still render existing data.
4. Manually setting `subscription_status = 'active'` and `tier = 'tier1'`: Coach paywalled; all other write actions allowed.
5. Manually setting `subscription_status = 'active'` and `tier = 'tier2'`: full access.
6. `/pricing` route loads logged-in AND logged-out.
7. Hitting `/api/coach-chat` from DevTools with a non-tier2 session returns 403 (frontend gating bypass test).
8. Hitting `/api/analyze-food` similarly returns 403 for `none` tier.
9. Existing 103 tests still pass.
10. New tests cover: `tiers.js` `hasTier` boundary cases, `_subscription.js` happy/sad paths (mocked).
11. Subscription card switches to the yellow warning variant when `daysLeft <= 2` (manual test: set `trial_ends_at` to `now() + 1.5 days` and reload).
12. The "Compare plans" link appears in every Subscription card variant and navigates to `/pricing`.

## Open questions for the plan

- Whether `pullAll` is the right place to fetch the subscription view, or whether a dedicated `loadSubscription()` helper called by AuthGuard is cleaner. Implementation detail; the plan can decide.
- Exact wording for paywall and pricing strings: placeholder copy in spec, finalised in plan.
- The Pricing page's Subscribe-button "Coming soon" copy — defer to plan; should be a single source of truth so Phase 2 can replace it.
- Whether to display `trial_days_left` as a banner on the Dashboard during the trial (decided here as "not in Phase 1" — only Settings shows it; banner could be Phase 3).
