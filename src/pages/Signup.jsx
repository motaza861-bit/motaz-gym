import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'
import './Auth.css'

export default function Signup() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError(t('au.err_password_short')); return }
    if (password !== confirm) { setError(t('au.err_password_mismatch')); return }
    if (!agreed) { setError(t('au.err_agree')); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/verify-email', { state: { email } })
  }

  return (
    <div className="auth-page">
      <h1 className="auth-title">{t('au.signup_title')}</h1>
      <p className="auth-sub">{t('au.signup_sub')}</p>
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <label>
          {t('au.email')}
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label>
          {t('au.password')}
          <input type="password" required autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <label>
          {t('au.confirm_password')}
          <input type="password" required autoComplete="new-password" minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} />
        </label>
        <label className="auth-check">
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
          <span>{t('au.agree_prefix')} <Link to="/privacy" target="_blank">{t('au.privacy')}</Link> {t('au.agree_and')} <Link to="/terms" target="_blank">{t('au.terms')}</Link>.</span>
        </label>
        <button className="auth-btn" type="submit" disabled={loading}>{loading ? t('au.signup_busy') : t('au.signup_btn')}</button>
      </form>
      <p className="auth-foot">{t('au.have_account')} <Link to="/login">{t('au.login')}</Link></p>
    </div>
  )
}
