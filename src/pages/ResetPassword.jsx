import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'
import './Auth.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError(t('au.err_password_short')); return }
    if (password !== confirm) { setError(t('au.err_password_mismatch')); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    navigate('/dashboard')
  }

  return (
    <div className="auth-page">
      <h1 className="auth-title">{t('au.reset_title')}</h1>
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <label>
          {t('au.new_password')}
          <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <label>
          {t('au.confirm_new_password')}
          <input type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} />
        </label>
        <button className="auth-btn" type="submit" disabled={loading}>{loading ? t('au.saving') : t('au.save_password')}</button>
      </form>
    </div>
  )
}
