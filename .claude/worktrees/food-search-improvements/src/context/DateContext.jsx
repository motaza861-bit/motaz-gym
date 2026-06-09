import { createContext, useContext, useEffect, useState } from 'react'

const DateContext = createContext(null)

export function DateProvider({ children }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  useEffect(() => {
    const resetIfNewDay = () => {
      if (document.visibilityState === 'visible') {
        setSelectedDate(prev => {
          const today = new Date()
          return prev.toDateString() !== today.toDateString() ? today : prev
        })
      }
    }
    document.addEventListener('visibilitychange', resetIfNewDay)
    return () => document.removeEventListener('visibilitychange', resetIfNewDay)
  }, [])

  return (
    <DateContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </DateContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSelectedDate() {
  const ctx = useContext(DateContext)
  if (!ctx) throw new Error('useSelectedDate must be used inside DateProvider')
  return ctx
}
