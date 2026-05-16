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

export function useSelectedDate() {
  return useContext(DateContext)
}
