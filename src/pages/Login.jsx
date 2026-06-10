import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setError(t('au.err_unverified'))
      } else {
        setError(t('au.err_invalid'))
      }
      return
    }
    navigate('/dashboard')
  }

  return (
    <div className="auth-page">
      <h1 className="auth-title">{t('au.login_title')}</h1>
      <p className="auth-sub">{t('au.login_sub')}</p>
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <label>
          {t('au.email')}
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label>
          {t('au.password')}
          <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <button className="auth-btn" type="submit" disabled={loading}>{loading ? t('au.signing_in') : t('au.login_btn')}</button>
      </form>
      <p className="auth-foot"><Link to="/forgot-password">{t('au.forgot_password')}</Link></p>
      <p className="auth-foot">{t('au.no_account')} <Link to="/signup">{t('au.signup')}</Link></p>
    </div>
  )
}
