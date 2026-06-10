import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import '../components/FoodScanner.css'
import './FoodSearchPage.css'
import Paywall from '../components/Paywall'
import { useSubscription } from '../hooks/useSubscription'
import { hasTier, TIER_1 } from '../lib/tiers'

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const max = 800
      const scale = Math.min(max / img.width, max / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1])
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')) }
    img.src = url
  })
}

export default function FoodScannerPage() {
  const navigate = useNavigate()
  const { effectiveTier } = useSubscription()
  const { t } = useLanguage()
  if (!hasTier(effectiveTier, TIER_1)) {
    return (
      <div className="fpage">
        <div className="fpage-header">
          <button className="fpage-back" onClick={() => navigate(-1)}>←</button>
          <span className="fpage-title">{t('fs.title')}</span>
        </div>
        <Paywall feature="ai_photo_scan" />
      </div>
    )
  }
  return <FoodScannerInner />
}

function FoodScannerInner() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [state, setState] = useState('idle')
  const [preview, setPreview] = useState(null)
  const [edits, setEdits] = useState({ food: '', portionGrams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef(null)
  const previewUrlRef = useRef(null)
  const originalRef = useRef(null)

  useEffect(() => {
    return () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current) }
  }, [])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setPreview(url)
    setState('loading')

    try {
      const base64 = await compressImage(file)
      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Could not analyse image')

      const vals = {
        food: data.food,
        portionGrams: data.portionGrams ?? 100,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
      }
      setEdits(vals)
      originalRef.current = { ...vals }
      setState('result')
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong')
      setState('error')
    }
  }

  function handlePortionChange(raw) {
    const grams = parseFloat(raw) || 0
    const orig = originalRef.current
    if (!orig || orig.portionGrams === 0) {
      setEdits(e => ({ ...e, portionGrams: grams }))
      return
    }
    const ratio = grams / orig.portionGrams
    setEdits({
      food: orig.food,
      portionGrams: grams,
      calories: Math.round(orig.calories * ratio),
      protein: Math.round(orig.protein * ratio),
      carbs: Math.round(orig.carbs * ratio),
      fat: Math.round(orig.fat * ratio),
    })
  }

  function handleAdd() {
    navigate('/nutrition', {
      state: {
        quickLog: {
          id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: edits.food || t('fs.scanned_meal'),
          emoji: '📸',
          portionG: edits.portionGrams,
          calories: edits.calories,
          protein: edits.protein,
          carbs: edits.carbs,
          fat: edits.fat,
        },
      },
    })
  }

  function retry() {
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null }
    setPreview(null)
    setEdits({ food: '', portionGrams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 })
    originalRef.current = null
    setErrorMsg('')
    setState('idle')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="fpage">
      <div className="fpage-header">
        <button className="fpage-back" onClick={() => navigate(-1)}>←</button>
        <span className="fpage-title">{t('fs.title')}</span>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="scanner-file-input" onChange={handleFile} />

      {state === 'idle' && (
        <button className="scanner-idle" onClick={() => inputRef.current?.click()}>
          <div className="scanner-camera-icon">📷</div>
          <p className="scanner-hint">{t('fs.tap_photo')}</p>
        </button>
      )}

      {state === 'loading' && (
        <div className="scanner-loading">
          {preview && <img src={preview} className="scanner-preview" alt="food" />}
          <div className="scanner-spinner" />
          <p className="scanner-hint">{t('fs.analysing')}</p>
        </div>
      )}

      {state === 'result' && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {preview && <img src={preview} className="scanner-preview" alt="food" />}

          <input
            className="scanner-food-name-input"
            value={edits.food}
            onChange={e => setEdits(ed => ({ ...ed, food: e.target.value }))}
            placeholder={t('fs.food_name_ph')}
          />

          <div className="scanner-portion-row">
            <span className="scanner-portion-label">{t('fs.portion')}</span>
            <input
              className="scanner-portion-input"
              type="number"
              inputMode="decimal"
              value={edits.portionGrams || ''}
              onChange={e => handlePortionChange(e.target.value)}
            />
            <span className="scanner-portion-unit">g</span>
          </div>

          <div className="scanner-macros">
            {[['kcal', 'calories'], ['protein', 'protein'], ['carbs', 'carbs'], ['fat', 'fat']].map(([label, key]) => (
              <div key={key} className="scanner-macro">
                <input
                  className="scanner-macro-input"
                  type="number"
                  inputMode="decimal"
                  value={edits[key] || ''}
                  onChange={e => setEdits(ed => ({ ...ed, [key]: parseFloat(e.target.value) || 0 }))}
                />
                <span className="scanner-macro-key">{label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button className="scanner-btn-secondary" style={{ flex: 1 }} onClick={retry}>{t('fs.try_again')}</button>
            <button className="scanner-btn-primary" style={{ flex: 2 }} onClick={handleAdd}>{t('fs.add_to_log')}</button>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="scanner-error">
          {preview && <img src={preview} className="scanner-preview" alt="food" />}
          <p className="scanner-error-msg">{errorMsg}</p>
          <button className="scanner-btn-primary" onClick={retry}>{t('fs.try_again')}</button>
        </div>
      )}
    </div>
  )
}
