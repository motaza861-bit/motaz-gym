import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTheme } from './hooks/useTheme'
import AuthGuard from './components/AuthGuard'
import InstallPrompt from './components/InstallPrompt'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import WorkoutLogger from './pages/WorkoutLogger'
import Nutrition from './pages/Nutrition'
import Progress from './pages/Progress'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'
import Onboarding from './pages/Onboarding'
import FoodSearchPage from './pages/FoodSearchPage'
import FoodScannerPage from './pages/FoodScannerPage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Coach from './pages/Coach'

export default function App() {
  useTheme()
  return (
    <BrowserRouter>
      <div className="bg-orb bg-orb-tr" />
      <div className="bg-orb bg-orb-bl" />
      <AuthGuard>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<><Dashboard /><BottomNav /></>} />
          <Route path="/workout" element={<><WorkoutLogger /><BottomNav /></>} />
          <Route path="/nutrition" element={<><Nutrition /><BottomNav /></>} />
          <Route path="/progress" element={<><Progress /><BottomNav /></>} />
          <Route path="/classes" element={<Navigate to="/workout" replace />} />
          <Route path="/food-search" element={<><FoodSearchPage /><BottomNav /></>} />
          <Route path="/food-scan" element={<><FoodScannerPage /><BottomNav /></>} />
          <Route path="/schedule" element={<><Schedule /><BottomNav /></>} />
          <Route path="/coach" element={<><Coach /><BottomNav /></>} />
          <Route path="/settings" element={<><Settings /><BottomNav /></>} />
          <Route path="/onboarding" element={<Onboarding onComplete={() => window.location.assign('/dashboard')} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <InstallPrompt />
      </AuthGuard>
    </BrowserRouter>
  )
}
