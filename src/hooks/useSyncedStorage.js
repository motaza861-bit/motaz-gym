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
