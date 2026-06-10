import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'
import './Auth.css'

export default function ForgotPassword() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="auth-page">
        <h1 className="auth-title">{t('au.forgot_sent_title')}</h1>
        <p className="auth-sub">{t('au.forgot_sent_sub', { email })}</p>
        <p className="auth-foot"><Link to="/login">{t('au.back_to_login')}</Link></p>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <h1 className="auth-title">{t('au.forgot_title')}</h1>
      <p className="auth-sub">{t('au.forgot_sub')}</p>
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <label>
          {t('au.email')}
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <button className="auth-btn" type="submit" disabled={loading}>{loading ? t('au.forgot_sending') : t('au.forgot_send')}</button>
      </form>
      <p className="auth-foot"><Link to="/login">{t('au.back_to_login')}</Link></p>
    </div>
  )
}
