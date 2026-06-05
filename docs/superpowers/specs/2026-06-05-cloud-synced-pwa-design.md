# IronMind Phase 1 — Cloud-Synced PWA: Design Spec

**Date:** 2026-06-05
**Status:** Draft (awaiting user approval)
**Phase:** 1 of 2 (Phase 2 = App Store / Play Store launch via Capacitor — separate spec)

## Goal

Turn IronMind from a single-device, localStorage-only web app into a real account-based fitness app where:

- Anyone can sign up with email + password
- A user's full data follows them to any phone they log in on
- The app is installable from the browser like a native app (PWA)
- It still works fully offline

## Non-goals (explicit)

These are deliberately deferred to later specs so Phase 1 stays shippable:

- Capacitor / App Store / Google Play distribution (Phase 2)
- Native iOS / Android binaries
- Realtime sync between two devices open simultaneously
- Social login (Google, Apple, Facebook)
- Push notifications
- Paid Pro tier billing and Stripe / App Store IAP
- Coach/client or any multi-user/social features
- Server-side analytics, A/B testing, feature flags

## Audience

Public app — anyone can sign up. Implies email verification, a Privacy Policy, and a Terms of Service.

## Technical decisions

| Decision | Choice | Why |
|---|---|---|
| Backend | Supabase (hosted) | Built-in email/password auth, email verification, password reset, Row Level Security, Postgres database, generous free tier (~50k MAU) |
| Database shape | Single `user_data(user_id, key, value jsonb)` blob table | Drop-in replacement for `localStorage`; ~30-line `useSyncedStorage` hook replaces existing `useStorage`; zero changes to any page or logic |
| Auth model | Email + password with verification + reset | Standard, App Store-friendly, what users expect |
| Sync model | Pull-on-login, write-through with offline queue, last-write-wins | Matches real "one user, one phone at a time" usage; works offline; tiny implementation |
| Distribution | Installable PWA via `vite-plugin-pwa` | Already 80% configured (manifest + meta tags); zero per-platform code; works on iOS + Android browsers today |

## Architecture

```
┌──────────────────────────────────┐
│  IronMind React app              │
│                                  │
│  Existing pages (Dashboard,      │
│  Workout, Nutrition, Progress,   │
│  Schedule, Settings, Classes,    │
│  Onboarding) — UNCHANGED         │
│                                  │
│  NEW:                            │
│  ├ /signup, /login,              │
│  │ /forgot-password,             │
│  │ /reset-password,              │
│  │ /verify-email, /privacy,      │
│  │ /terms screens                │
│  ├ AuthGuard router wrapper      │
│  ├ useSyncedStorage hook         │
│  │ (replaces useStorage)         │
│  ├ src/lib/sync.js (sync engine) │
│  ├ src/lib/supabase.js (client)  │
│  └ Service worker (vite-pwa)     │
└──────────────┬───────────────────┘
               │ Supabase JS SDK
               ▼
┌──────────────────────────────────┐
│  Supabase (hosted)               │
│                                  │
│  Auth service:                   │
│    email/password,               │
│    verification email,           │
│    password reset email          │
│                                  │
│  Postgres:                       │
│    profiles                      │
│    user_data                     │
│    (both RLS-protected)          │
└──────────────────────────────────┘
```

## Data model

### Postgres schema

```sql
-- created automatically by Supabase Auth:
-- auth.users(id uuid, email text, ...)

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  tier         text not null default 'free',  -- reserved for future Pro tier
  created_at   timestamptz not null default now()
);

create table public.user_data (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,         -- e.g. 'workout_logs', 'nutrition_logs'
  value      jsonb not null,        -- same JSON shape as current localStorage
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Auto-create a profile row whenever a new auth user is inserted.
create function public.handle_new_user()
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
```

### Keys stored in `user_data`

Same names as today's `motaz_*` localStorage keys, with the `motaz_` prefix dropped:

- `workout_logs`
- `nutrition_logs`
- `body_weight_logs`
- `meals`
- `targets`
- `profile`
- `exercises`
- `custom_foods`

### Row Level Security

One policy on each table: `user_id = auth.uid()`. Enforced by Postgres at every read and write. No way for User A to ever see User B's data, even via a buggy query — the database refuses.

```sql
alter table public.profiles  enable row level security;
alter table public.user_data enable row level security;

create policy "users read own profile"   on profiles  for select using (auth.uid() = id);
create policy "users update own profile" on profiles  for update using (auth.uid() = id);

create policy "users read own data"   on user_data for select using (auth.uid() = user_id);
create policy "users insert own data" on user_data for insert with check (auth.uid() = user_id);
create policy "users update own data" on user_data for update using (auth.uid() = user_id);
create policy "users delete own data" on user_data for delete using (auth.uid() = user_id);
```

## Auth flow

### Signup
1. User opens `/signup` — form: email, password (min 8 chars), confirm password, agreement checkbox linking to `/privacy` and `/terms`
2. On submit, call `supabase.auth.signUp({ email, password })`. Supabase creates the auth.user, sends verification email, and inserts a row into `profiles` via a trigger (defined in schema setup).
3. App routes to `/verify-email` screen: "Check your inbox at <email> to verify your account. Resend email?"
4. User clicks email link → returns to app at `/verify-email?token=…` → app calls `supabase.auth.verifyOtp` (or SDK auto-handles).
5. Verified user routes to existing onboarding flow if `profile` row is empty, else to `/dashboard`.

### Login
1. User opens `/login` — form: email, password
2. `supabase.auth.signInWithPassword({ email, password })`
3. On success, Supabase SDK stores session in localStorage; app routes to `/dashboard`.
4. On failure, show inline error: "Invalid email or password" or "Please verify your email first."

### Forgot password
1. `/forgot-password` — form: email
2. `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<app-url>/reset-password' })`
3. User clicks email link → opens `/reset-password` → form: new password, confirm
4. `supabase.auth.updateUser({ password })`

### Logout
- Button in Settings → `supabase.auth.signOut()` → wipe sync state from localStorage → route to `/login`.

### Auth guard
A top-level router wrapper:
- No session → `/login` (with public routes for `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`)
- Session but unverified email → `/verify-email`
- Verified session → existing app routes

## First-login data migration

Existing users (anyone who used IronMind today without an account) have data in `localStorage` under `motaz_*` keys.

**On first successful login**, the sync engine checks:
1. Are there `motaz_*` keys in localStorage?
2. Does the new account have empty `user_data` rows?

If both yes, show a one-time modal:

> **We found existing workout and nutrition data on this device.**
> **Move it to your new account, or start fresh?**
> [Move it] [Start fresh]

- **Move it** → For each `motaz_*` key, upsert into `user_data(user_id, key=stripPrefix(k), value=parse(localStorage[k]))`. After success, delete the `motaz_*` keys.
- **Start fresh** → Delete all `motaz_*` keys without copying.

After this modal, the prompt never appears again for this account on this device.

## Sync model

### Read path
- On login: `select key, value from user_data where user_id = auth.uid()` → for each row, write `localStorage[key] = JSON.stringify(value)`.
- Pages keep reading from localStorage exactly as today via `useSyncedStorage` (drop-in for `useStorage`).
- App is instantly responsive and works offline.

### Write path
- `useSyncedStorage`'s setter:
  1. Update React state
  2. Write to localStorage (same as today)
  3. Fire-and-forget `upsert user_data values (auth.uid(), key, value)`
- If the upsert fails (offline, 5xx), the mutation is appended to a `__sync_pending` array in localStorage.
- On every page focus and `online` event, flush `__sync_pending` in order. On success, remove from queue.

### Conflict policy
**Last write wins.** If two devices write the same key, the later upsert's `value` overwrites. Documented as a v1 limitation. Realistic for solo users editing one phone at a time. Revisit if real users report data loss.

### Pull-to-refresh
Dashboard supports pull-to-refresh → re-runs the read path. Escape hatch for users who feel their devices are out of sync.

## PWA / installability

### Add `vite-plugin-pwa`
- Auto-generates service worker at build time
- Service worker caches app shell (HTML, JS, CSS, fonts) using a `CacheFirst` strategy
- Caches `/api/...` and Supabase calls with `NetworkFirst` (so data is fresh when online, falls back when offline)

### Improve `manifest.json`
- Add proper raster icons: `icon-192.png`, `icon-512.png`, `icon-maskable-1024.png`
- Add `screenshots[]` entries (used by Android install dialog)
- Add `categories: ["fitness", "health"]`
- Keep existing `display: fullscreen`, `theme_color`, `start_url`

### Install prompt
- Small one-time banner on mobile browsers: "Install IronMind on your phone for the full experience"
- Uses `beforeinstallprompt` browser event on Android/Chrome
- On iOS, the banner shows instructions: "Share → Add to Home Screen" (iOS doesn't expose a programmatic install)
- Dismissible; tracked in localStorage so it doesn't nag

## Error handling

| Failure | UX |
|---|---|
| Network error during a write | Silent — queued in `__sync_pending`, retried automatically |
| Network error on login | Inline error: "Couldn't reach the server. Check your connection." |
| Wrong email/password | Inline: "Invalid email or password." |
| Unverified email tries to log in | Inline: "Please verify your email first. Resend link?" |
| Supabase outage | App stays usable offline (reads from localStorage); writes queue until reachable |
| Unexpected JS crash | Top-level ErrorBoundary → "Something went wrong. Reload the app?" button |

## Privacy + legal

### `/privacy` page
Static content covering:
- What we collect (email address, fitness and nutrition data entered by the user)
- Where it lives (Supabase, region disclosed)
- How long it's kept (until account deletion)
- That we do not sell or share data
- Contact email for data requests

### `/terms` page
Standard short ToS template:
- Use at your own risk
- No medical advice, consult a doctor before training
- We can suspend abusive accounts
- Liability limited

### Signup gate
Signup form has a required checkbox: "I have read and agree to the Privacy Policy and Terms of Service." with links opening `/privacy` and `/terms`. Submit disabled until checked.

### Account deletion
Settings → Danger Zone → "Delete my account" — confirms with email re-entry, then calls a server function that deletes the auth user (cascades to `profiles` and `user_data`).

### Existing local export
Keep the existing `exportAllData` / `importAllData` JSON download — supplements the cloud sync with a self-serve "give me my data" path.

## Files added / changed

### Added
- `src/lib/supabase.js` — Supabase client singleton
- `src/lib/sync.js` — load on login, queue flusher, migration helper
- `src/hooks/useSyncedStorage.js` — drop-in replacement for `useStorage`
- `src/pages/Login.jsx`, `Login.css`
- `src/pages/Signup.jsx`, `Signup.css`
- `src/pages/ForgotPassword.jsx`
- `src/pages/ResetPassword.jsx`
- `src/pages/VerifyEmail.jsx`
- `src/pages/Privacy.jsx`
- `src/pages/Terms.jsx`
- `src/components/AuthGuard.jsx`
- `src/components/InstallPrompt.jsx`
- `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-1024.png`
- `supabase/schema.sql` — schema + RLS policies (kept in repo for reference)

### Changed
- `src/App.jsx` — wrap with `AuthGuard`, add new public routes
- `src/hooks/useStorage.js` — re-export `useSyncedStorage` as `useStorage` so no other file changes (or update individual imports — TBD in plan)
- `src/pages/Settings.jsx` — add Logout and Delete Account buttons
- `index.html` — add additional icon links for raster sizes
- `public/manifest.json` — fuller icons, screenshots, categories
- `vite.config.js` — register `vite-plugin-pwa`
- `package.json` — add `@supabase/supabase-js`, `vite-plugin-pwa`, `workbox-window`

### Environment variables (Vercel)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — public anon key (safe to expose to client because RLS guards data)

## Open questions for the implementation plan

These are intentionally left for the writing-plans step, not the design:

- Exact rollout sequence: do we ship the auth screens first behind a feature flag, or as a single PR?
- Whether `useStorage.js` re-exports `useSyncedStorage` (zero import churn) or every file updates its import (cleaner long-term)
- Service worker cache invalidation strategy on new deploys
- Supabase project region selection (closest to expected user base)
- Visual design for the auth screens (matches existing IronMind dark theme — frontend-design skill may be invoked during planning)

## Success criteria

Phase 1 is "done" when:

1. A new user can sign up, verify their email, and reach the existing onboarding screen
2. A logged-in user using the existing pages produces data that round-trips to Supabase
3. The same account on a second device shows the same data after login
4. The PWA is installable on iOS Safari and Android Chrome
5. The app continues to work fully when the device is offline
6. A user can delete their account and all their data is gone from Supabase
7. Privacy Policy and Terms pages are live and linked from signup
