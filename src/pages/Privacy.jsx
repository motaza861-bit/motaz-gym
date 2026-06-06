import { Link } from 'react-router-dom'
import './Auth.css'

export default function Privacy() {
  return (
    <div className="auth-page" style={{ maxWidth: 640 }}>
      <h1 className="auth-title">Privacy Policy</h1>
      <p>Last updated: 2026-06-05</p>
      <h3>What we collect</h3>
      <p>Your email address (for sign-in and password reset) and the fitness, nutrition, and program data you enter in the app.</p>
      <h3>Where it lives</h3>
      <p>On Supabase (a hosted Postgres database). Data is encrypted in transit and at rest.</p>
      <h3>How long we keep it</h3>
      <p>Until you delete your account. You can delete your account at any time from Settings — this removes all your data from our servers.</p>
      <h3>We do not</h3>
      <p>Sell your data. Share it with third parties for advertising. Send marketing emails.</p>
      <h3>Contact</h3>
      <p>Questions? Reach the developer at adelmotaz861@gmail.com.</p>
      <p className="auth-foot"><Link to="/signup">Back</Link></p>
    </div>
  )
}
