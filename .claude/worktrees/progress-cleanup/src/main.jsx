import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DateProvider } from './context/DateContext'
import { LanguageProvider } from './context/LanguageContext'
import './index.css'
import App from './App'

try { localStorage.removeItem('motaz_notifications') } catch {}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <DateProvider>
        <App />
      </DateProvider>
    </LanguageProvider>
  </StrictMode>
)
