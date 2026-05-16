import { createContext, useContext, useState } from 'react'

const DateContext = createContext(null)

export function DateProvider({ children }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  return (
    <DateContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </DateContext.Provider>
  )
}

export function useSelectedDate() {
  return useContext(DateContext)
}
