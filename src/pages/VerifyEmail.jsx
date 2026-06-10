import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'
import './Auth.css'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLanguage()
  const passedEmail = location.state?.email ?? ''
  const [email, setEmail] = useState(passedEmail)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      const user = data?.user
      if (user?.email_confirmed_at) { navigate('/dashboard'); return }
      if (user?.email) setEmail(user.email)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user?.email_confirmed_at) navigate('/dashboard')
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [navigate])

  async function resend() {
    setError('')
    if (!email) { setError(t('au.verify_need_email')); return }
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) { setError(error.message); return }
    setResent(true)
  }

  return (
    <div className="auth-page">
      <h1 className="auth-title">{t('au.verify_title')}</h1>
      <p className="auth-sub">{t('au.verify_sub', { email: email || t('au.verify_default_inbox') })}</p>
      {error && <div className="auth-error">{error}</div>}
      {resent ? <p className="auth-sub">{t('au.verify_resent')}</p> : (
        <button className="auth-btn" onClick={resend} disabled={!email}>{t('au.verify_resend')}</button>
      )}
      <p className="auth-foot">{t('au.verify_wrong_email')} <button onClick={() => supabase.auth.signOut().then(() => navigate('/signup'))} style={{ background: 'none', border: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>{t('au.verify_signout_retry')}</button></p>
    </div>
  )
}
