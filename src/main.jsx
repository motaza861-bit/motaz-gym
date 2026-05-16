import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DateProvider } from './context/DateContext'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DateProvider>
      <App />
    </DateProvider>
  </StrictMode>
)
