import { useEffect, useRef, useState } from 'react'
import './FoodScanner.css'

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
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load image'))
    }
    img.src = url
  })
}

export default function FoodScanner({ onAdd, onClose }) {
  const [state, setState] = useState('idle') // idle | loading | result | error
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef(null)
  const previewUrlRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
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
    if (!result) return
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
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
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
          <button className="scanner-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="scanner-file-input"
          onChange={handleFile}
        />

        {state === 'idle' && (
          <button className="scanner-idle" onClick={() => inputRef.current?.click()}>
            <div className="scanner-camera-icon">📷</div>
            <p className="scanner-hint">Tap to take a photo of your food</p>
          </button>
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
