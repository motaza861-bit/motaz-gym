# Food Search Improvements (Barcode + AI Estimate) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a barcode scanner and an AI-estimate text-search fallback to IronMind's food search, so users can scan supermarket packages and get usable macros for any food a database doesn't have.

**Architecture:** Two new Vercel functions (`/api/lookup-barcode`, `/api/estimate-food`) wrap Open Food Facts and Groq respectively. A new `BarcodeScanner` React component uses the native `BarcodeDetector` API where available with `@zxing/browser` as a lazy-loaded fallback. The existing FoodSearchPage gains two new entry points (📊 button, "✨ Estimate with AI" footer button) and a new badge state on the portion picker for AI estimates.

**Tech Stack:** React 19, Vite 8, Vercel serverless functions (Node), Groq SDK (already installed), Open Food Facts public API, `@zxing/browser` (new), Vitest.

**Source spec:** `docs/superpowers/specs/2026-06-07-food-search-improvements-design.md`

---

## File map

### Added
- `api/lookup-barcode.js` — POST endpoint, wraps OFF barcode API
- `api/estimate-food.js` — POST endpoint, wraps Groq for text-to-macros
- `src/components/BarcodeScanner.jsx` — full-screen camera + barcode detection
- `src/components/BarcodeScanner.css` — scanner styles
- `tests/api/lookup-barcode.test.js`
- `tests/api/estimate-food.test.js`

### Modified
- `package.json` — `@zxing/browser` added
- `src/pages/FoodSearchPage.jsx` — 📊 button, scanner modal wiring, "Estimate with AI" footer, AI estimate flow into portion picker
- `src/pages/FoodSearchPage.css` — styles for the new button + AI badge
- `src/components/FoodSearch.css` — quick-log ✨ prefix for AI entries (or wherever quick-log row renders)
- `src/pages/Nutrition.jsx` and `src/pages/Nutrition.css` — quick-log row ✨ prefix when `_aiEstimate: true`

### Unchanged but referenced
- `api/analyze-food.js` (the photo scanner) — same Groq pattern reused
- `api/search-food.js` (existing OFF text search) — left alone

---

## Task 1: Add `@zxing/browser` dependency

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

Run:
```bash
npm install @zxing/browser
```
Expected: `@zxing/browser` added to `dependencies`. (Bundle impact only when actually imported — Task 5 will use dynamic import.)

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @zxing/browser for barcode fallback"
```

---

## Task 2: `/api/lookup-barcode` endpoint with tests

**Files:**
- Create: `api/lookup-barcode.js`
- Create: `tests/api/lookup-barcode.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/api/lookup-barcode.test.js`:

```js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import handler from '../../api/lookup-barcode.js'

function mockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this },
  }
}

beforeEach(() => { vi.restoreAllMocks() })
afterEach(() => { vi.restoreAllMocks() })

describe('lookup-barcode', () => {
  it('rejects non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', body: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects missing barcode', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: {} }, res)
    expect(res.statusCode).toBe(400)
  })

  it('rejects malformed barcode', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: { barcode: 'abc' } }, res)
    expect(res.statusCode).toBe(400)
  })

  it('returns { found: true, food } when OFF has the product', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          product_name: 'Coca-Cola Classic',
          brands: 'Coca-Cola',
          nutriments: {
            'energy-kcal_100g': 42,
            proteins_100g: 0,
            carbohydrates_100g: 11,
            fat_100g: 0,
          },
        },
      }),
    }))
    const res = mockRes()
    await handler({ method: 'POST', body: { barcode: '5449000000996' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.found).toBe(true)
    expect(res.payload.food.name).toBe('Coca-Cola Classic')
    expect(res.payload.food.brand).toBe('Coca-Cola')
    expect(res.payload.food.per100g).toEqual({ calories: 42, protein: 0, carbs: 11, fat: 0 })
  })

  it('returns { found: false } when OFF returns status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 0 }),
    }))
    const res = mockRes()
    await handler({ method: 'POST', body: { barcode: '1234567890123' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ found: false })
  })

  it('returns { found: false } when OFF fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const res = mockRes()
    await handler({ method: 'POST', body: { barcode: '1234567890123' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ found: false })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm run test:run -- tests/api/lookup-barcode.test.js`
Expected: FAIL — "Cannot find module".

- [ ] **Step 3: Create `api/lookup-barcode.js`**

```js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { barcode } = req.body ?? {}
  if (!barcode || typeof barcode !== 'string') {
    return res.status(400).json({ error: 'Missing barcode' })
  }
  if (!/^\d{8,14}$/.test(barcode)) {
    return res.status(400).json({ error: 'Malformed barcode' })
  }

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'IronMindApp/1.0 (fitness tracker)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) return res.status(200).json({ found: false })

    const data = await response.json()
    if (data.status !== 1 || !data.product) return res.status(200).json({ found: false })

    const p = data.product
    const n = p.nutriments ?? {}
    const kcalRaw = n['energy-kcal_100g']
    const kcal = kcalRaw != null
      ? Math.round(kcalRaw)
      : n['energy_100g'] != null
        ? Math.round(n['energy_100g'] / 4.184)
        : null
    if (!p.product_name || kcal == null) return res.status(200).json({ found: false })

    return res.status(200).json({
      found: true,
      food: {
        id: `off_barcode_${barcode}`,
        name: p.product_name,
        brand: p.brands || null,
        emoji: '🛒',
        per100g: {
          calories: kcal,
          protein: Math.round(n.proteins_100g ?? 0),
          carbs:   Math.round(n.carbohydrates_100g ?? 0),
          fat:     Math.round(n.fat_100g ?? 0),
        },
        defaultPortion: 100,
        _source: 'barcode',
        barcode,
      },
    })
  } catch {
    return res.status(200).json({ found: false })
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm run test:run -- tests/api/lookup-barcode.test.js`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/lookup-barcode.js tests/api/lookup-barcode.test.js
git commit -m "feat(api): lookup-barcode endpoint via Open Food Facts"
```

---

## Task 3: `/api/estimate-food` endpoint with tests

**Files:**
- Create: `api/estimate-food.js`
- Create: `tests/api/estimate-food.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/api/estimate-food.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const createMock = vi.fn()
  return { createMock }
})

vi.mock('groq-sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mocks.createMock } },
  })),
}))

import handler from '../../api/estimate-food.js'

function mockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this },
  }
}

beforeEach(() => {
  mocks.createMock.mockReset()
})

describe('estimate-food', () => {
  it('rejects non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', body: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects empty query', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: { query: '   ' } }, res)
    expect(res.statusCode).toBe(400)
  })

  it('returns parsed estimate on success', async () => {
    mocks.createMock.mockResolvedValueOnce({
      choices: [{
        message: {
          content: '{"name":"Almarai Labneh Full Fat","emoji":"🥛","per100g":{"calories":95,"protein":5,"carbs":4,"fat":7},"defaultPortion":100}',
        },
      }],
    })
    const res = mockRes()
    await handler({ method: 'POST', body: { query: 'Almarai labneh full fat' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.name).toBe('Almarai Labneh Full Fat')
    expect(res.payload.per100g.calories).toBe(95)
    expect(res.payload._source).toBe('ai')
    expect(res.payload._aiEstimate).toBe(true)
  })

  it('strips ```json fences before parsing', async () => {
    mocks.createMock.mockResolvedValueOnce({
      choices: [{
        message: {
          content: '```json\n{"name":"Egg","emoji":"🥚","per100g":{"calories":143,"protein":13,"carbs":1,"fat":10},"defaultPortion":50}\n```',
        },
      }],
    })
    const res = mockRes()
    await handler({ method: 'POST', body: { query: 'egg' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.name).toBe('Egg')
  })

  it('returns 422 when JSON parse fails', async () => {
    mocks.createMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'not json at all' } }],
    })
    const res = mockRes()
    await handler({ method: 'POST', body: { query: 'qwerty' } }, res)
    expect(res.statusCode).toBe(422)
  })

  it('returns 422 when the AI itself reports an error', async () => {
    mocks.createMock.mockResolvedValueOnce({
      choices: [{ message: { content: '{"error":"Could not estimate"}' } }],
    })
    const res = mockRes()
    await handler({ method: 'POST', body: { query: 'xyzunknown' } }, res)
    expect(res.statusCode).toBe(422)
  })

  it('returns 500 when Groq throws', async () => {
    mocks.createMock.mockRejectedValueOnce(new Error('boom'))
    const res = mockRes()
    await handler({ method: 'POST', body: { query: 'rice' } }, res)
    expect(res.statusCode).toBe(500)
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `npm run test:run -- tests/api/estimate-food.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `api/estimate-food.js`**

```js
import Groq from 'groq-sdk'

const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

const PROMPT = `You are a nutrition expert. The user typed a food name. Estimate macros per 100g for that food.
Return ONLY this JSON (no markdown, no explanation):
{"name":"<canonical name>","emoji":"<single emoji>","per100g":{"calories":<int>,"protein":<int>,"carbs":<int>,"fat":<int>},"defaultPortion":<int grams>}
Use your best judgement for region-specific or branded products.
If the query is too vague or you can't make a sensible estimate, return: {"error":"Could not estimate"}`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query } = req.body ?? {}
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Missing query' })
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 256,
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: query.trim() },
      ],
    })
    const raw = completion.choices[0].message.content.trim()
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')

    let data
    try { data = JSON.parse(jsonStr) }
    catch { return res.status(422).json({ error: 'Could not parse estimate' }) }

    if (data.error) return res.status(422).json(data)

    const { name, emoji, per100g, defaultPortion } = data
    if (
      typeof name !== 'string' ||
      !per100g ||
      typeof per100g.calories !== 'number' ||
      typeof per100g.protein !== 'number' ||
      typeof per100g.carbs !== 'number' ||
      typeof per100g.fat !== 'number'
    ) {
      return res.status(422).json({ error: 'Invalid estimate shape' })
    }

    return res.status(200).json({
      id: `ai_${Date.now()}`,
      name,
      emoji: emoji || '✨',
      per100g: {
        calories: Math.round(per100g.calories),
        protein:  Math.round(per100g.protein),
        carbs:    Math.round(per100g.carbs),
        fat:      Math.round(per100g.fat),
      },
      defaultPortion: typeof defaultPortion === 'number' ? Math.round(defaultPortion) : 100,
      _source: 'ai',
      _aiEstimate: true,
    })
  } catch {
    return res.status(500).json({ error: 'Failed to estimate' })
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:run -- tests/api/estimate-food.test.js`
Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/estimate-food.js tests/api/estimate-food.test.js
git commit -m "feat(api): estimate-food endpoint via Groq for AI fallback"
```

---

## Task 4: BarcodeScanner component

**Files:**
- Create: `src/components/BarcodeScanner.jsx`
- Create: `src/components/BarcodeScanner.css`

No automated tests — the component depends on `getUserMedia`, the BarcodeDetector global, and live camera frames, which jsdom can't simulate cleanly. Manual verification covers it in Task 8.

- [ ] **Step 1: Create `src/components/BarcodeScanner.css`**

```css
.barcode-scanner {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 200;
  display: flex;
  flex-direction: column;
}

.bs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  color: white;
  background: rgba(0,0,0,0.5);
  z-index: 1;
}

.bs-close, .bs-switch {
  background: rgba(255,255,255,0.1);
  color: white;
  border: 0;
  border-radius: 8px;
  font-size: 18px;
  width: 38px;
  height: 38px;
  cursor: pointer;
}

.bs-video-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bs-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bs-crosshair {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.bs-crosshair-box {
  width: 70%;
  max-width: 320px;
  aspect-ratio: 2 / 1;
  border: 2px solid rgba(94, 226, 196, 0.9);
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(0,0,0,0.4);
}

.bs-hint {
  position: absolute;
  bottom: 32px;
  left: 0;
  right: 0;
  text-align: center;
  color: white;
  font-size: 14px;
  opacity: 0.8;
  pointer-events: none;
}

.bs-error {
  color: #ff8b8b;
  background: rgba(255, 80, 80, 0.1);
  border: 1px solid rgba(255, 80, 80, 0.3);
  padding: 12px;
  border-radius: 10px;
  margin: 16px;
  font-size: 14px;
}
```

- [ ] **Step 2: Create `src/components/BarcodeScanner.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react'
import './BarcodeScanner.css'

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

function hasNativeDetector() {
  return typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function'
}

export default function BarcodeScanner({ onDetect, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const zxingControlsRef = useRef(null)
  const rafRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        if (hasNativeDetector()) {
          detectorRef.current = new window.BarcodeDetector({ formats: BARCODE_FORMATS })
          loopNative()
        } else {
          startZxing()
        }
      } catch (e) {
        setError('Camera access denied or unavailable.')
      }
    }

    function loopNative() {
      if (cancelled) return
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loopNative)
        return
      }
      detectorRef.current.detect(video).then(codes => {
        if (cancelled) return
        if (codes && codes.length > 0) {
          handleDetected(codes[0].rawValue)
          return
        }
        rafRef.current = requestAnimationFrame(loopNative)
      }).catch(() => {
        rafRef.current = requestAnimationFrame(loopNative)
      })
    }

    async function startZxing() {
      try {
        const mod = await import('@zxing/browser')
        const reader = new mod.BrowserMultiFormatReader()
        zxingControlsRef.current = await reader.decodeFromVideoElement(videoRef.current, (result) => {
          if (cancelled) return
          if (result) handleDetected(result.getText())
        })
      } catch (e) {
        setError('Barcode scanner failed to load.')
      }
    }

    function handleDetected(value) {
      if (cancelled) return
      cancelled = true
      try { navigator.vibrate?.(50) } catch {}
      stop()
      onDetect(value)
    }

    function stop() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (zxingControlsRef.current) {
        try { zxingControlsRef.current.stop() } catch {}
        zxingControlsRef.current = null
      }
      const stream = streamRef.current
      if (stream) stream.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    start()
    return () => { cancelled = true; stop() }
  }, [onDetect])

  return (
    <div className="barcode-scanner">
      <div className="bs-header">
        <button className="bs-close" aria-label="Close" onClick={onClose}>✕</button>
        <span style={{ color: 'white', fontSize: 14 }}>Scan barcode</span>
        <span style={{ width: 38 }} />
      </div>
      <div className="bs-video-wrap">
        <video ref={videoRef} className="bs-video" playsInline muted />
        <div className="bs-crosshair">
          <div className="bs-crosshair-box" />
        </div>
        <div className="bs-hint">Hold over the barcode</div>
        {error && <div className="bs-error">{error}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify it builds**

Run:
```bash
npm run build
```
Expected: build succeeds. `@zxing/browser` shows up as a separate dynamic chunk.

- [ ] **Step 4: Commit**

```bash
git add src/components/BarcodeScanner.jsx src/components/BarcodeScanner.css
git commit -m "feat(scanner): BarcodeScanner component with native + zxing fallback"
```

---

## Task 5: Wire 📊 button + scanner modal in FoodSearchPage

**Files:**
- Modify: `src/pages/FoodSearchPage.jsx`
- Modify: `src/pages/FoodSearchPage.css`

- [ ] **Step 1: Add imports + state to `src/pages/FoodSearchPage.jsx`**

At the top of the file, alongside the existing imports, add:
```jsx
import BarcodeScanner from '../components/BarcodeScanner'
```

Inside the `FoodSearchPage` component, near the other `useState` calls, add:
```jsx
const [scannerOpen, setScannerOpen] = useState(false)
const [scanError, setScanError] = useState('')
```

- [ ] **Step 2: Add the scanner handler**

In the helpers section (alongside `quickAdd`, `handleAdd`, etc.), add:

```jsx
async function onBarcodeDetect(code) {
  setScannerOpen(false)
  setScanError('')
  try {
    const res = await fetch('/api/lookup-barcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: code }),
    })
    const data = await res.json()
    if (data.found && data.food) {
      selectFood(data.food)
      return
    }
    setScanError(`Barcode ${code} not found. Try the "Add custom food" button to add it manually.`)
  } catch {
    setScanError('Could not reach the server. Try again.')
  }
}
```

(`openForm` already exists in this file; it pre-populates the create form when given a food.)

- [ ] **Step 3: Add the 📊 button to the header**

Find the existing header buttons. The page renders a header with the back arrow and title; the entry buttons live elsewhere (the search page itself does NOT yet have a barcode button — Nutrition page does for photo/search). Add the barcode button INSIDE the search page's top area, just above the `.fsearch-input-row`, so users see it as an alternative to typing:

```jsx
<button
  className="fpage-barcode-btn"
  onClick={() => { setScanError(''); setScannerOpen(true) }}
>
  📊 Scan barcode
</button>
```

- [ ] **Step 4: Render the scanner conditionally**

At the bottom of the page JSX (outside the main `.fpage` wrapper but inside the component's return), or just before the closing tag, add:

```jsx
{scannerOpen && (
  <BarcodeScanner
    onDetect={onBarcodeDetect}
    onClose={() => setScannerOpen(false)}
  />
)}
{scanError && <div className="fpage-scan-error">{scanError}</div>}
```

The scanner component uses `position: fixed` so it overlays the page.

- [ ] **Step 5: Add styles in `src/pages/FoodSearchPage.css`**

Append at the bottom:

```css
.fpage-barcode-btn {
  width: 100%;
  padding: 12px;
  margin: 8px 0 6px;
  border-radius: 10px;
  border: 1px dashed rgba(94, 226, 196, 0.4);
  background: rgba(94, 226, 196, 0.04);
  color: var(--accent, #5ee2c4);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.fpage-barcode-btn:hover { background: rgba(94, 226, 196, 0.1); }

.fpage-scan-error {
  margin: 8px 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 80, 80, 0.1);
  border: 1px solid rgba(255, 80, 80, 0.3);
  color: #ff8b8b;
  font-size: 13px;
}
```

- [ ] **Step 6: Run tests + build**

Run:
```bash
npm run test:run
npm run build
```
Expected: tests pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/pages/FoodSearchPage.jsx src/pages/FoodSearchPage.css
git commit -m "feat(food-search): barcode scan button and lookup wiring"
```

---

## Task 6: "Estimate with AI" footer button + portion-picker AI badge

**Files:**
- Modify: `src/pages/FoodSearchPage.jsx`
- Modify: `src/pages/FoodSearchPage.css`

- [ ] **Step 1: Add AI estimate state and handler**

Inside `FoodSearchPage`, near the other `useState` calls, add:
```jsx
const [aiLoading, setAiLoading] = useState(false)
const [aiError, setAiError] = useState('')
```

In the helpers section, add:

```jsx
async function estimateWithAI() {
  const q = query.trim()
  if (!q) return
  setAiLoading(true)
  setAiError('')
  try {
    const res = await fetch('/api/estimate-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    })
    const data = await res.json()
    if (res.ok && !data.error) {
      selectFood(data)
      return
    }
    setAiError(data.error || 'Could not estimate. Try a different name.')
  } catch {
    setAiError('Could not reach the server.')
  } finally {
    setAiLoading(false)
  }
}
```

- [ ] **Step 2: Render the footer button**

After the `.fsearch-results` block (still inside the conditional that renders when no food is selected), add:

```jsx
<button
  className="fpage-ai-btn"
  onClick={estimateWithAI}
  disabled={!query.trim() || aiLoading}
>
  {aiLoading ? 'Estimating…' : '✨ Can\'t find it? Estimate with AI'}
</button>
{aiError && <div className="fpage-scan-error">{aiError}</div>}
```

- [ ] **Step 3: Add the AI badge to the portion picker view**

Find the block that begins `<div className="fsearch-portion-scroll">` (the portion picker). Just below the existing `.fsearch-portion-food` block (which shows emoji + name), add:

```jsx
{selected?._aiEstimate && (
  <div className="fpage-ai-badge">
    ✨ AI estimate — verify before saving. All fields are editable.
  </div>
)}
```

- [ ] **Step 4: Styles**

Append to `src/pages/FoodSearchPage.css`:

```css
.fpage-ai-btn {
  display: block;
  width: calc(100% - 24px);
  margin: 16px 12px;
  padding: 12px;
  border-radius: 10px;
  border: 0;
  background: var(--accent, #5ee2c4);
  color: #0a0a0a;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.fpage-ai-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.fpage-ai-badge {
  background: rgba(255, 204, 0, 0.1);
  border: 1px solid rgba(255, 204, 0, 0.4);
  color: #ffd34a;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  margin: 12px 0;
}
```

- [ ] **Step 5: Verify**

Run:
```bash
npm run test:run
npm run build
```
Expected: pass / succeed.

- [ ] **Step 6: Commit**

```bash
git add src/pages/FoodSearchPage.jsx src/pages/FoodSearchPage.css
git commit -m "feat(food-search): AI estimate fallback button + portion-picker badge"
```

---

## Task 7: Quick-log ✨ prefix for AI entries

**Files:**
- Modify: `src/pages/Nutrition.jsx`
- Modify: `src/pages/Nutrition.css`

- [ ] **Step 1: Find the quick-log row markup**

Run: `grep -n "quick-log-name\|quick-log-emoji" src/pages/Nutrition.jsx`

Expected: a small block near the middle of the file rendering the `quickLogs.map(...)`.

- [ ] **Step 2: Add the ✨ prefix conditionally**

Find the line that renders the quick-log row's name span:
```jsx
<span className="quick-log-name">{log.name}</span>
```

Replace it with:
```jsx
<span className="quick-log-name">
  {log._aiEstimate && <span className="quick-log-ai" title="AI estimate">✨ </span>}
  {log.name}
</span>
```

- [ ] **Step 3: Add a small style**

Append to `src/pages/Nutrition.css`:

```css
.quick-log-ai { color: #ffd34a; }
```

- [ ] **Step 4: Verify**

Run: `npm run test:run`
Expected: 79 tests pass (66 prior + 13 new from Tasks 2 and 3).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Nutrition.jsx src/pages/Nutrition.css
git commit -m "feat(nutrition): mark AI-estimated quick-logs with sparkle prefix"
```

---

## Task 8: Final manual verification

**Files:** none.

- [ ] **Step 1: Lint, tests, build**

```bash
npm run lint
npm run test:run
npm run build
```
Expected: zero errors; all tests pass; build succeeds; PWA service worker still generated.

- [ ] **Step 2: Dev server**

```bash
npm run dev
```

- [ ] **Step 3: Walk the success criteria** (in the browser, ideally on a real phone via the local network)

- [ ] Open /food-search. Tap **📊 Scan barcode** — camera opens (browser may prompt for permission). Hold over a real product barcode (e.g. a soda can). Within ~2 seconds the scanner closes and the portion picker opens with the correct product name and macros from OFF.
- [ ] Scan a product that is not in OFF (e.g. an obscure local snack). Expect "Barcode … not found." inline; user can tap the existing "Add custom food" button to enter it.
- [ ] Type a food name that obviously won't be in OFF or Saudi local (e.g. "almarai labneh full fat"). Tap **✨ Can't find it? Estimate with AI**. Within ~2–3 seconds the portion picker opens with the AI-estimated macros and a yellow badge "AI estimate — verify before saving". All inputs are editable.
- [ ] Edit one of the macros, change the portion, tap "Add to today". Return to /nutrition — the quick-log row shows with a ✨ before its name.
- [ ] Refresh the page. The quick-log is still there. Log into the same account in an incognito window — the quick-log appears (Supabase sync includes the new `_aiEstimate` field as part of the value blob).
- [ ] On a desktop browser without `BarcodeDetector` (e.g. Safari): tap **📊 Scan barcode** — `@zxing/browser` lazy-loads and the scanner still works. Bundle size warning may appear in DevTools network — the chunk is ~150 KB and only fetched on demand.

- [ ] **Step 4: Stop the dev server**

Ctrl+C.

> No commit for this task — verification only.

---

## Self-review notes

**Spec coverage:**
- Feature 1: Barcode scanner — Tasks 1, 4, 5
- Feature 2: Lookup endpoint — Task 2
- Feature 3: AI estimate endpoint — Task 3
- Feature 4: "Estimate with AI" button + badge — Task 6
- Feature 5: Quick-log ✨ — Task 7
- Final verification — Task 8

**Names consistent across tasks:**
- `_source: 'barcode' | 'ai'`, `_aiEstimate: true` used identically in Tasks 2, 3, 6, 7.
- Endpoint URLs `/api/lookup-barcode`, `/api/estimate-food` consistent.
- `BarcodeScanner` component name + import path same in Tasks 4 and 5.
- The spec's "auto-populate the custom-food form with the barcode" idea was dropped from the plan as YAGNI for v1. The custom-food form already exists; after a barcode miss the user reaches it the same way they always have (the existing "Add custom food" button). Persisting the barcode on the custom food would only matter if the search pipeline also did a barcode-first lookup against custom foods — that's a separate feature.

**Trade-offs flagged:**
- `@zxing/browser` adds ~150 KB to the bundle but is dynamically imported, so users with native `BarcodeDetector` (most Android Chrome) never download it.
- AI estimate accuracy depends on Groq's training; the "verify before saving" badge owns that risk explicitly.
- No automated tests for `BarcodeScanner` (camera + browser APIs not testable in jsdom); Task 8 manual verification covers it.
- The custom-food form's `barcode` field is set but not displayed in the form UI; this is intentional v1 minimalism. A later spec can add a visible barcode chip and barcode-first lookup in the existing search pipeline.
