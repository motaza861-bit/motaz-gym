// src/hooks/useStorage.js
import { useState, useCallback } from 'react'

export function useStorage(key, defaultValue) {
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
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* storage full */ }
      return next
    })
  }, [key])

  return [value, setValue]
}

const DATA_KEYS = ['motaz_workout_logs', 'motaz_nutrition_logs', 'motaz_body_weight_logs']

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
  a.download = `motaz-gym-backup-${new Date().toISOString().split('T')[0]}.json`
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
          localStorage.setItem(key, JSON.stringify(value))
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
