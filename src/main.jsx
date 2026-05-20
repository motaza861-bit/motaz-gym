import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DateProvider } from './context/DateContext'
import { LanguageProvider } from './context/LanguageContext'
import { scheduleNotifications } from './utils/notifications'
import './index.css'
import App from './App'

try {
  const prefs = JSON.parse(localStorage.getItem('motaz_notifications') || '{}')
  if (prefs.enabled) scheduleNotifications(prefs)
} catch {}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <DateProvider>
        <App />
      </DateProvider>
    </LanguageProvider>
  </StrictMode>
)
