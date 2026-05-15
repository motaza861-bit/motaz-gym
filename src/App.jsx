import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import WorkoutLogger from './pages/WorkoutLogger'
import Nutrition from './pages/Nutrition'
import Progress from './pages/Progress'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workout" element={<WorkoutLogger />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  )
}
