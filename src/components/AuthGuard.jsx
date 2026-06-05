import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { pullAll, findLocalLegacyKeys, migrateLegacyToCloud, discardLegacy } from '../lib/sync'
import './AuthGuard.css'

const SYNC_KEYS = [
  'workout_logs', 'nutrition_logs', 'body_weight_logs',
  'meals', 'targets', 'profile', 'exercises', 'custom_foods',
]

const PUBLIC_PATHS = new Set([
  '/login', '/signup', '/forgot-password', '/reset-password', '/privacy', '/terms',
])

export default function AuthGuard({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState('loading')
  const [showMigration, setShowMigration] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function evaluate(session) {
      if (cancelled) return
      const user = session?.user ?? null

      if (PUBLIC_PATHS.has(location.pathname)) {
        setStatus('public')
        return
      }

      if (!user) {
        setStatus('public')
        navigate('/login', { replace: true })
        return
      }

      if (!user.email_confirmed_at) {
        setStatus('verify')
        navigate('/verify-email', { replace: true })
        return
      }

      await pullAll(SYNC_KEYS)
      const legacy = findLocalLegacyKeys()
      const promptShownKey = `__migration_prompted_${user.id}`
      const alreadyPrompted = localStorage.getItem(promptShownKey) === '1'
      if (legacy.length > 0 && !alreadyPrompted) {
        setShowMigration(true)
      }
      setStatus('app')
    }

    supabase.auth.getSession().then(({ data }) => evaluate(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => evaluate(session))
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [navigate, location.pathname])

  async function onMigrate() {
    await migrateLegacyToCloud()
    const { data } = await supabase.auth.getUser()
    if (data?.user) localStorage.setItem(`__migration_prompted_${data.user.id}`, '1')
    window.location.reload()
  }

  async function onDiscard() {
    discardLegacy()
    const { data } = await supabase.auth.getUser()
    if (data?.user) localStorage.setItem(`__migration_prompted_${data.user.id}`, '1')
    setShowMigration(false)
  }

  if (status === 'loading') return <div className="auth-loading">Loading…</div>

  return (
    <>
      {children}
      {showMigration && (
        <div className="migration-modal-bg">
          <div className="migration-modal">
            <h2>Move your existing data?</h2>
            <p>We found workout and nutrition data on this device from before you signed up. Move it into your new account, or start fresh.</p>
            <div className="migration-actions">
              <button onClick={onDiscard}>Start fresh</button>
              <button className="primary" onClick={onMigrate}>Move it</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
