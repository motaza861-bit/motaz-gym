import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Auth.css'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [resent, setResent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      const user = data?.user
      if (!user) { navigate('/login'); return }
      if (user.email_confirmed_at) { navigate('/dashboard'); return }
      setEmail(user.email ?? '')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user?.email_confirmed_at) navigate('/dashboard')
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [navigate])

  async function resend() {
    setError('')
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) { setError(error.message); return }
    setResent(true)
  }

  return (
    <div className="auth-page">
      <h1 className="auth-title">Verify your email</h1>
      <p className="auth-sub">We sent a verification link to {email || 'your inbox'}. Click it to activate your account.</p>
      {error && <div className="auth-error">{error}</div>}
      {resent ? <p className="auth-sub">Sent! Check your inbox.</p> : (
        <button className="auth-btn" onClick={resend}>Resend verification email</button>
      )}
      <p className="auth-foot">Wrong email? <button onClick={() => supabase.auth.signOut().then(() => navigate('/signup'))} style={{ background: 'none', border: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>Sign out and try again</button></p>
    </div>
  )
}
