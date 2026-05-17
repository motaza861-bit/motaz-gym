import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTheme } from './hooks/useTheme'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import WorkoutLogger from './pages/WorkoutLogger'
import Nutrition from './pages/Nutrition'
import Progress from './pages/Progress'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'
import Onboarding from './pages/Onboarding'

export default function App() {
  useTheme()
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem('motaz_onboarded'))

  if (!onboarded) {
    return (
      <>
        <div className="bg-orb bg-orb-tr" />
        <div className="bg-orb bg-orb-bl" />
        <Onboarding onComplete={() => setOnboarded(true)} />
      </>
    )
  }

  return (
    <BrowserRouter>
      <div className="bg-orb bg-orb-tr" />
      <div className="bg-orb bg-orb-bl" />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workout" element={<WorkoutLogger />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  )
}
