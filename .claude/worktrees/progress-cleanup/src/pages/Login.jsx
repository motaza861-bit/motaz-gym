import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
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
        setError('Please verify your email first. Check your inbox.')
      } else {
        setError('Invalid email or password.')
      }
      return
    }
    navigate('/dashboard')
  }

  return (
    <div className="auth-page">
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-sub">Log in to sync your training across devices.</p>
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <label>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Log in'}</button>
      </form>
      <p className="auth-foot"><Link to="/forgot-password">Forgot password?</Link></p>
      <p className="auth-foot">No account? <Link to="/signup">Sign up</Link></p>
    </div>
  )
}
