import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Auth.css'

export default function ForgotPassword() {
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
        <h1 className="auth-title">Check your inbox</h1>
        <p className="auth-sub">We sent a reset link to {email}. Click it to set a new password.</p>
        <p className="auth-foot"><Link to="/login">Back to log in</Link></p>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <h1 className="auth-title">Reset your password</h1>
      <p className="auth-sub">Enter your email and we'll send you a reset link.</p>
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <label>
          Email
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
      </form>
      <p className="auth-foot"><Link to="/login">Back to log in</Link></p>
    </div>
  )
}
