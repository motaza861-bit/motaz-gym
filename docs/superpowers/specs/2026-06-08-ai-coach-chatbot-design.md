# AI Coach Chatbot + Gemini Migration Design Spec

**Date:** 2026-06-08
**Status:** Draft (awaiting user approval)

## Goal

Three coordinated changes to IronMind:

1. **Remove** the "Tweak my program" panel from the Workout page, the "Regenerate Program" button from Settings, and the AI workout-generation step from Onboarding (Onboarding becomes profile + macro targets only).
2. **Migrate** the remaining Groq-backed Vercel functions to Google Gemini (`gemini-2.0-flash`).
3. **Add** an "AI Coach" chatbot accessible from a new bottom-nav tab (replacing Schedule). The chatbot uses Gemini's function-calling to propose two kinds of changes — modify the workout program template, log food to today — which the user confirms inline before they apply.

## Non-goals

- Voice input.
- Coach-initiated push notifications.
- Multi-week macro / mesocycle planning.
- Image attachments in chat.
- Editing past days' nutrition logs via chat (today only).
- Editing individual workout logs via chat (template only).
- Server-side application of mutations — the chat backend never writes to Supabase directly; it only proposes changes.

## Audience scope

Existing IronMind users. New accounts will land in a thinner Onboarding (no AI program), then can open the AI Coach to build their first program through conversation.

## Removals (Part A)

### Removed UI
- `src/pages/WorkoutLogger.jsx`: the entire "AI Tweak Panel" block and its state (`tweakOpen`, `tweakText`, `tweakStatus`), the `applyTweak` function, the related CSS classes (`.tweak-*`).
- `src/pages/Settings.jsx`: the "Regenerate Program" card (the part with `{t('st.regen_desc')}` and `{t('st.regen_btn')}`).
- `src/pages/Onboarding.jsx`: the AI workout generation step. The new onboarding ends after macro targets are saved — workout `exercises` storage starts empty.

### Removed endpoints (deleted entirely)
- `api/edit-workout.js`
- `api/generate-workout.js`

### Removed translations
- `wl.tweak_title`, `wl.tweak_placeholder`, `wl.tweak_success`, `wl.tweak_error`, and any `wl.tweak_*` siblings
- `st.regen_desc`, `st.regen_btn`
- All `on.*` keys exclusively used by the deleted onboarding generation step (audit during implementation)

### Side effects
- The default `exercises` value (`DEFAULT_PROGRAM`) stays — onboarding just doesn't override it via AI. New users see the existing default program in WorkoutLogger; they can edit or replace via the chatbot.
- The "Regenerate Program" button used to clear `motaz_onboarded` and reload — that flow is gone; users edit the program via chat or manually.

## Migration (Part B): Groq → Gemini

### Endpoints to migrate (same external contract, internal SDK swap)
- `api/analyze-food.js` (vision — Gemini Flash 2.0 supports image input)
- `api/analyze-meal-text.js`
- `api/estimate-food.js`
- `api/detect-muscles.js`

### Shared helper
A new module `api/_gemini.js` exports a configured `GoogleGenerativeAI` client and small utility wrappers so each endpoint stays focused on its prompt + response shape. Pattern mirrors what `api/_supabase.js` would look like (it doesn't exist; this is the equivalent for AI).

```js
// api/_gemini.js (illustration)
import { GoogleGenerativeAI } from '@google/generative-ai'

export function getGemini() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
}

export async function generateJSON(modelName, contents, schema) { /* … */ }
export async function generateText(modelName, contents) { /* … */ }
```

### Package changes
- Remove `groq-sdk` from `package.json`.
- Add `@google/generative-ai` to `dependencies`.
- New env var `GEMINI_API_KEY` in Vercel (Production + Preview + Development).
- Remove `GROQ_API_KEY` from Vercel after all endpoints migrate and the merge ships.

### Behavioral notes
- Gemini `gemini-2.0-flash` is roughly comparable to Groq Llama-4-Scout on speed; JSON-mode is built in via `responseMimeType: 'application/json'`.
- The fence-stripping regex in `estimate-food.js` becomes unnecessary because Gemini's JSON mode returns clean JSON — but we keep the regex defensively.
- Free tier: 15 RPM, plenty for personal app scale. Migration plan can stay on the free tier until traffic justifies upgrading.

## Addition (Part C): AI Coach Chatbot

### Routing + nav
- New route: `GET /coach` → `<Coach />` page.
- Bottom-nav 📅 Schedule tab is **replaced** by 🤖 Coach.
- Schedule view remains reachable via a small "Schedule" link in the workout page header (so existing data isn't orphaned).

### New files
- `src/pages/Coach.jsx`
- `src/pages/Coach.css`
- `src/components/ChatBubble.jsx` (renders text / proposal / applied entries)
- `src/components/ProposalCard.jsx` (the Apply/Cancel card)
- `api/coach-chat.js` (POST endpoint)
- `api/_gemini.js` (shared helper from migration)
- `src/lib/coachTools.js` (client-side appliers for `modifyWorkout` and `logFood`)
- `tests/api/coach-chat.test.js`
- `tests/lib/coachTools.test.js`

### Existing files touched
- `src/components/BottomNav.jsx` — Schedule tab replaced by Coach tab
- `src/App.jsx` — register `/coach` route
- `src/i18n/translations.js` — new `nav.coach`, `coach.*` strings
- `src/pages/WorkoutLogger.jsx` — small Schedule link added to header

### Data flow

```
        ┌──────────────────────────────────┐
        │ Coach.jsx                        │
        │ - reads chat_history from store  │
        │ - WhatsApp-style bubble list     │
        │ - input + send button            │
        └────────────┬─────────────────────┘
                     │ POST /api/coach-chat
                     │ {
                     │   history: [...last 30 msgs],
                     │   message: "I want to add bench…",
                     │   context: { program, targets, profile }
                     │ }
                     ▼
        ┌──────────────────────────────────┐
        │ api/coach-chat.js                │
        │ - calls Gemini with tools        │
        │ - either: returns text reply, OR │
        │ - returns { proposal: {...} }    │
        └────────────┬─────────────────────┘
                     ▼
        Client appends proposal as a new
        message of type 'tool_proposal'.
        User taps Apply → coachTools.applyProposal()
        mutates localStorage + Supabase via the
        existing useSyncedStorage path.
        The proposal becomes type 'tool_applied'.
```

### Tool 1: `modifyWorkout`

```jsonc
{
  "name": "modifyWorkout",
  "description": "Modify the user's workout program template. Use when the user asks to add/remove/change exercises, sessions, or which weekday runs which session.",
  "parameters": {
    "operation": "add_exercise | remove_exercise | update_exercise | add_session | rename_session | change_day_session",
    // Per-operation fields:
    "sessionKey": "string (A, B, …; required for exercise ops + rename + change_day_session)",
    "exerciseName": "string (required for add/remove/update_exercise)",
    "sets": "number (optional for add/update)",
    "reps": "string (e.g. '8-10'; optional for add/update)",
    "newName": "string (required for rename_session)",
    "weekday": "number 0..6, Sunday=0 (required for change_day_session)",
    "newSessionKey": "string|'rest' (required for change_day_session)",
    "summary": "human-readable summary of the change"
  }
}
```

The model is instructed to return a single `modifyWorkout` call per turn. Multi-operation requests (e.g., "swap Monday and Tuesday") are split into sequential turns or returned as `{ operations: [...] }` — the v1 endpoint accepts both shapes. The Apply card renders all operations at once.

### Tool 2: `logFood`

```jsonc
{
  "name": "logFood",
  "description": "Log a food entry into today's nutrition quick log. Use when the user says they ate or drank something.",
  "parameters": {
    "items": [
      {
        "name": "string (canonical name)",
        "emoji": "string (single emoji)",
        "grams": "number (estimated grams of the eaten portion)",
        "per100g": { "calories": "number", "protein": "number", "carbs": "number", "fat": "number" }
      }
    ],
    "summary": "human-readable summary like 'Logging chicken breast 150g + rice 200g'"
  }
}
```

The model is prompted to estimate `per100g` and `grams` directly — no extra endpoint round-trip. On Apply, the client multiplies and appends each item as a `quickLog` entry with `_source: 'ai-chat'`.

### Storage shape: `chat_history`

```js
[
  {
    id: 'msg_1717689600000_a4f',
    role: 'user' | 'assistant',
    type: 'text' | 'tool_proposal' | 'tool_applied' | 'tool_cancelled',
    content: 'string',                        // text-type messages
    proposal: {                               // tool_proposal
      tool: 'modifyWorkout' | 'logFood',
      params: { … },
      summary: 'plain-language summary'
    },
    appliedAt: '2026-06-08T20:30:00Z',         // tool_applied
    timestamp: '2026-06-08T20:29:45Z'
  }
]
```

- Synced via `useSyncedStorage('chat_history', [])`.
- Added to `SYNC_KEYS`, `MIGRATABLE_KEYS`, `DATA_KEYS`.
- Capped to the last **200 messages**; older messages are dropped when adding new ones.

### `api/coach-chat.js` interface

```
POST /api/coach-chat
Body: {
  history: ChatMessage[],       // last 30 messages, oldest first
  message: string,              // user's new turn
  context: {
    program: { /* exercises blob */ },
    targets: { /* macro targets */ },
    profile: { /* user profile */ }
  }
}

Response:
{
  reply: {
    role: 'assistant',
    type: 'text' | 'tool_proposal',
    content?: 'text reply',
    proposal?: { tool, params, summary }
  }
}
```

Server-side responsibilities:
- Render the chat history into Gemini's contents format (`{role, parts}` per the SDK).
- Inject a system prompt with the user's current program + targets + profile so the AI can reason about deltas.
- Register both tools with the model.
- On model response:
  - If pure text: return as `{ type: 'text', content }`.
  - If tool call: validate the call shape against a strict schema, return `{ type: 'tool_proposal', proposal: {tool, params, summary} }`.
  - On invalid tool call: return `{ type: 'text', content: 'I had trouble understanding — try rephrasing.' }`.

### `src/lib/coachTools.js` — the appliers

```js
// Pure functions: take current state + params, return new state.
export function applyModifyWorkout(program, params) { /* returns new program */ }
export function applyLogFood(nutritionLogs, dateStr, params) { /* returns new logs */ }

// Top-level helpers used by Coach.jsx:
export function applyProposal(proposal, ctx) {
  // ctx.setProgram, ctx.setNutritionLogs, ctx.dateStr
  // dispatches based on proposal.tool
}
```

Tested with Vitest — the pure-function pieces (`applyModifyWorkout`, `applyLogFood`) have clear input/output contracts.

### UI: WhatsApp-style

Same visual language as the wireframe shown during brainstorming:
- Header: `← AI Coach` left, `⋯` menu right (menu has only "Clear chat" for v1)
- Bubble layout: AI on the left (accent green, 80% max width), user on the right (dark gray, 80% max width)
- Proposal cards inline: header ("📋 Change to your program" or "🍽️ Log this food"), plain-language summary, structured details list, `[Cancel] [Apply]` row at the bottom
- Applied cards: same content but `[Cancel/Apply]` row replaced with a small "✓ Applied 2 min ago" footer
- Input row pinned to the bottom with `env(safe-area-inset-bottom)` padding
- Typing indicator while awaiting `/api/coach-chat`: three pulsing dots in an empty AI bubble
- New-message auto-scroll
- Empty state: AI's greeting message "Hi! I'm your fitness coach. Want to build a program together, or log what you've eaten today?"

### Errors and safety

- Network errors on send: inline "Couldn't reach your coach. Try again." below the input; the user's message stays in the chat as "failed" (small red dot + retry on tap).
- Gemini errors / quota: same generic message; logged server-side.
- Invalid tool params: backend rejects and the user sees the "try rephrasing" message.
- Confirmation gate: NO data mutation happens without the user tapping Apply on a proposal card.
- The chat backend never writes to Supabase. Only the client (after Apply) mutates via `useSyncedStorage`. This means the AI cannot silently change data even if compromised.

## Files added / modified (full list)

### Added
- `api/_gemini.js`
- `api/coach-chat.js`
- `src/pages/Coach.jsx`, `src/pages/Coach.css`
- `src/components/ChatBubble.jsx`, `src/components/ChatBubble.css`
- `src/components/ProposalCard.jsx` (shares CSS with ChatBubble)
- `src/lib/coachTools.js`
- `tests/api/coach-chat.test.js`
- `tests/lib/coachTools.test.js`

### Modified
- `package.json` — drop `groq-sdk`, add `@google/generative-ai`
- `api/analyze-food.js`, `api/analyze-meal-text.js`, `api/estimate-food.js`, `api/detect-muscles.js` — switched to Gemini via `_gemini.js`
- Test files for those endpoints — updated mocks
- `src/App.jsx` — register `/coach` route
- `src/components/BottomNav.jsx` — Schedule → Coach
- `src/components/AuthGuard.jsx` — add `'chat_history'` to `SYNC_KEYS`
- `src/lib/sync.js` — add `'chat_history'` to `MIGRATABLE_KEYS`
- `src/hooks/useStorage.js` — add `'chat_history'` to `DATA_KEYS`
- `src/pages/WorkoutLogger.jsx` — remove tweak panel; add a small Schedule link in header
- `src/pages/WorkoutLogger.css` — remove `.tweak-*` rules
- `src/pages/Settings.jsx` — remove "Regenerate Program" card
- `src/pages/Settings.css` — remove related styles if isolated to that card
- `src/pages/Onboarding.jsx` — strip the AI-generation step (keep profile + macros)
- `src/i18n/translations.js` — drop `wl.tweak_*`, `st.regen_*`, deleted onboarding keys; add `nav.coach`, `coach.*`

### Deleted
- `api/edit-workout.js`
- `api/generate-workout.js`

### Environment
- Add `GEMINI_API_KEY` in Vercel (Prod / Preview / Dev).
- Remove `GROQ_API_KEY` after merge ships.

## Success criteria

- All previously-working AI features (photo scan, AI text estimate, AI meal-text analyze, muscle detection) still work on the deployed app after migration — same shape of result, similar latency.
- The Workout page no longer shows the tweak panel; Settings has no "Regenerate Program" button.
- New accounts complete Onboarding without any AI workout generation step.
- A user can open the Coach tab, type "add 3 sets of bench press to session A", see a Proposal card, tap Apply, and immediately see Bench Press in session A on the Workout page (and on a second device after sync).
- A user can type "I just ate a chicken breast and 200g of rice", see a Proposal card with estimated macros, tap Apply, and see two quick-log entries appear on the Nutrition page for today.
- Chat history persists across reloads and across devices for the same account.
- The "Clear chat" menu wipes only `chat_history`, never the workout or nutrition data.
- 79 prior tests still pass + ~10 new tests for coach-chat parsing and coachTools appliers.

## Open questions for the implementation plan

- Whether to bundle the Gemini migration into the same plan or split into two plans. Recommendation: one plan, ordered as Migration → Removals → Chatbot, so each task can ship independently and the chatbot has a clean foundation.
- Whether the proposal-card UI should support multi-tool calls in a single turn (e.g., AI says "I'll set up your full week"). For v1 the plan should constrain to one tool call per turn — the AI can ask follow-ups for multi-step plans.
- Whether to add a per-message "retry" affordance on user messages that failed to reach the backend. Recommended yes for v1; it's cheap.
