# AI Food Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Camera button in the Nutrition page that photographs food, sends it to Claude vision, and returns a calorie + macro estimate the user can add to their log.

**Architecture:** Vercel serverless function (`api/analyze-food.js`) receives a base64 image, calls Claude Haiku vision, and returns structured JSON. A `FoodScanner` modal in the Nutrition page handles capture, compression, loading, result display, and "Add to log".

**Tech Stack:** React 19, @anthropic-ai/sdk (already installed), Canvas API for compression, Vercel serverless functions.

**Prerequisite:** Task 1 of the onboarding plan must be complete (@anthropic-ai/sdk installed, vercel.json updated).

---

### Task 1: Create api/analyze-food.js serverless function

**Files:**
- Create: `api/analyze-food.js`
- Test: `tests/api/analyze-food.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/api/analyze-food.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ text: '{"food":"Grilled chicken breast","calories":165,"protein":31,"carbs":0,"fat":4}' }]
      })
    }
  }))
}))

const mockRes = () => {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('analyze-food handler', () => {
  let handler

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../../api/analyze-food.js')
    handler = mod.default
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 400 if no image provided', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns food data on success', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: { image: 'base64data', mimeType: 'image/jpeg' } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload).toHaveProperty('food')
    expect(payload).toHaveProperty('calories')
    expect(payload).toHaveProperty('protein')
    expect(payload).toHaveProperty('carbs')
    expect(payload).toHaveProperty('fat')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run tests/api/analyze-food.test.js 2>&1 | tail -10
```

Expected: FAIL — file not found.

- [ ] **Step 3: Create api/analyze-food.js**

Create `api/analyze-food.js` at project root:

```js
import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { image, mimeType = 'image/jpeg' } = req.body

  if (!image) {
    return res.status(400).json({ error: 'No image provided' })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: image },
          },
          {
            type: 'text',
            text: 'Analyse this food photo. Estimate the nutritional content for the portion visible. Return ONLY this JSON (no markdown, no explanation): {"food":"food name","calories":number,"protein":number,"carbs":number,"fat":number}. If you cannot identify any food, return {"error":"Could not identify food"}.',
          },
        ],
      }],
    })

    const raw = message.content[0].text.trim()
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const data = JSON.parse(jsonStr)

    if (data.error) {
      return res.status(422).json(data)
    }

    return res.status(200).json(data)
  } catch (err) {
    console.error('analyze-food error:', err.message)
    return res.status(500).json({ error: 'Failed to analyse image' })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run tests/api/analyze-food.test.js 2>&1 | tail -10
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm test -- --run 2>&1 | tail -8
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add api/analyze-food.js tests/api/analyze-food.test.js
git commit -m "feat: add analyze-food serverless function"
```

---

### Task 2: Create FoodScanner component

**Files:**
- Create: `src/components/FoodScanner.jsx`
- Create: `src/components/FoodScanner.css`

- [ ] **Step 1: Create FoodScanner.jsx**

Create `src/components/FoodScanner.jsx`:

```jsx
import { useRef, useState } from 'react'
import './FoodScanner.css'

function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const max = 800
      const scale = Math.min(max / img.width, max / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1])
    }
    img.src = URL.createObjectURL(file)
  })
}

export default function FoodScanner({ onAdd, onClose }) {
  const [state, setState] = useState('idle') // idle | loading | result | error
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setPreview(URL.createObjectURL(file))
    setState('loading')

    try {
      const base64 = await compressImage(file)
      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: 'image/jpeg' }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Could not analyse image')
      }

      setResult(data)
      setState('result')
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong')
      setState('error')
    }
  }

  function handleAdd() {
    onAdd({
      id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: result.food,
      emoji: '📸',
      time: '',
      description: 'Scanned meal',
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
    })
    onClose()
  }

  function retry() {
    setPreview(null)
    setResult(null)
    setErrorMsg('')
    setState('idle')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="scanner-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="scanner-modal">
        <div className="scanner-header">
          <span className="scanner-title">Scan Food</span>
          <button className="scanner-close" onClick={onClose}>✕</button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="scanner-file-input"
          onChange={handleFile}
        />

        {state === 'idle' && (
          <div className="scanner-idle" onClick={() => inputRef.current?.click()}>
            <div className="scanner-camera-icon">📷</div>
            <p className="scanner-hint">Tap to take a photo of your food</p>
          </div>
        )}

        {state === 'loading' && (
          <div className="scanner-loading">
            {preview && <img src={preview} className="scanner-preview" alt="food" />}
            <div className="scanner-spinner" />
            <p className="scanner-hint">Analysing…</p>
          </div>
        )}

        {state === 'result' && result && (
          <div className="scanner-result">
            {preview && <img src={preview} className="scanner-preview" alt="food" />}
            <div className="scanner-food-name">{result.food}</div>
            <div className="scanner-macros">
              <div className="scanner-macro">
                <span className="scanner-macro-val">{result.calories}</span>
                <span className="scanner-macro-key">kcal</span>
              </div>
              <div className="scanner-macro">
                <span className="scanner-macro-val">{result.protein}g</span>
                <span className="scanner-macro-key">protein</span>
              </div>
              <div className="scanner-macro">
                <span className="scanner-macro-val">{result.carbs}g</span>
                <span className="scanner-macro-key">carbs</span>
              </div>
              <div className="scanner-macro">
                <span className="scanner-macro-val">{result.fat}g</span>
                <span className="scanner-macro-key">fat</span>
              </div>
            </div>
            <div className="scanner-actions">
              <button className="scanner-btn-secondary" onClick={retry}>Try Again</button>
              <button className="scanner-btn-primary" onClick={handleAdd}>Add to Log</button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="scanner-error">
            {preview && <img src={preview} className="scanner-preview" alt="food" />}
            <p className="scanner-error-msg">{errorMsg}</p>
            <button className="scanner-btn-primary" onClick={retry}>Try Again</button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create FoodScanner.css**

Create `src/components/FoodScanner.css`:

```css
.scanner-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.scanner-modal {
  background: var(--bg-card);
  border-radius: var(--radius) var(--radius) 0 0;
  width: 100%;
  max-height: 85dvh;
  overflow-y: auto;
  padding: 0 0 env(safe-area-inset-bottom, 16px);
}

.scanner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
}

.scanner-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.scanner-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
}

.scanner-file-input {
  display: none;
}

.scanner-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  cursor: pointer;
  gap: 12px;
}

.scanner-camera-icon {
  font-size: 56px;
}

.scanner-hint {
  font-size: 14px;
  color: var(--text-muted);
  text-align: center;
  margin: 0;
}

.scanner-loading,
.scanner-result,
.scanner-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px 24px 24px;
}

.scanner-preview {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: var(--radius);
}

.scanner-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-light);
  border-top-color: var(--red);
  border-radius: 50%;
  animation: scan-spin 0.8s linear infinite;
}

@keyframes scan-spin {
  to { transform: rotate(360deg); }
}

.scanner-food-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
  text-align: center;
}

.scanner-macros {
  display: flex;
  gap: 10px;
  width: 100%;
}

.scanner-macro {
  flex: 1;
  background: var(--bg);
  border-radius: var(--radius);
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.scanner-macro-val {
  font-size: 16px;
  font-weight: 700;
  color: var(--red);
}

.scanner-macro-key {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.scanner-actions {
  display: flex;
  gap: 10px;
  width: 100%;
}

.scanner-btn-primary {
  flex: 2;
  padding: 14px;
  background: var(--red);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.scanner-btn-secondary {
  flex: 1;
  padding: 14px;
  background: var(--bg);
  color: var(--text-muted);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

.scanner-error-msg {
  font-size: 14px;
  color: var(--red);
  text-align: center;
  margin: 0;
}
```

- [ ] **Step 3: Build to verify**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — no import errors.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add src/components/FoodScanner.jsx src/components/FoodScanner.css
git commit -m "feat: FoodScanner component with camera capture and Claude vision"
```

---

### Task 3: Integrate FoodScanner into Nutrition page

**Files:**
- Modify: `src/pages/Nutrition.jsx`
- Modify: `src/pages/Nutrition.css`

- [ ] **Step 1: Read the current Nutrition.jsx header section**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && head -30 src/pages/Nutrition.jsx
```

Note the import block and the JSX header (the `<div className="page-header">` or similar).

- [ ] **Step 2: Add FoodScanner import and scannerOpen state**

At the top of `src/pages/Nutrition.jsx`, add to the import block:
```jsx
import FoodScanner from '../components/FoodScanner'
```

Inside the `Nutrition` component function, add this state alongside the other useState calls:
```jsx
const [scannerOpen, setScannerOpen] = useState(false)
```

- [ ] **Step 3: Add camera button to the page header**

In the Nutrition JSX, find the page header. It typically looks like:
```jsx
<div className="page-header">
  <h1 className="page-title">Nutrition</h1>
  ...
</div>
```

Add a camera button inside the header:
```jsx
<div className="page-header">
  <h1 className="page-title">Nutrition</h1>
  <button className="nutrition-scan-btn" onClick={() => setScannerOpen(true)} aria-label="Scan food">📷</button>
</div>
```

- [ ] **Step 4: Add FoodScanner modal and handleScanAdd function**

Before the closing `</div>` of the Nutrition page's root element, add:
```jsx
{scannerOpen && (
  <FoodScanner
    onAdd={meal => setMeals(prev => [...prev, meal])}
    onClose={() => setScannerOpen(false)}
  />
)}
```

- [ ] **Step 5: Add camera button styles to Nutrition.css**

Append to `src/pages/Nutrition.css`:
```css
.nutrition-scan-btn {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  font-size: 20px;
  padding: 6px 10px;
  cursor: pointer;
  line-height: 1;
}
```

- [ ] **Step 6: Build and test**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym" && npm run build 2>&1 | tail -5 && npm test -- --run 2>&1 | tail -8
```

Expected: Build success, all tests pass.

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/Ehab/.local/bin/motaz-gym"
git add src/pages/Nutrition.jsx src/pages/Nutrition.css
git commit -m "feat: add food scanner button and modal to Nutrition page"
```
