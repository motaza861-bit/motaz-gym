import { useSyncedStorage } from './useSyncedStorage'

export const useStorage = useSyncedStorage

const DATA_KEYS = ['workout_logs', 'nutrition_logs', 'body_weight_logs', 'meals', 'targets', 'profile', 'exercises', 'custom_foods']

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
  a.download = `ironmind-backup-${new Date().toISOString().split('T')[0]}.json`
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
          if (DATA_KEYS.includes(key)) {
            localStorage.setItem(key, JSON.stringify(value))
          }
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
