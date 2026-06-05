import { Link } from 'react-router-dom'
import './Auth.css'

export default function Terms() {
  return (
    <div className="auth-page" style={{ maxWidth: 640 }}>
      <h1 className="auth-title">Terms of Service</h1>
      <p>Last updated: 2026-06-05</p>
      <h3>Use at your own risk</h3>
      <p>IronMind is a tracking tool, not medical advice. Consult a qualified professional before starting any training or nutrition program.</p>
      <h3>Your account</h3>
      <p>You're responsible for keeping your password safe. We can suspend accounts that abuse the service or violate the law.</p>
      <h3>Service availability</h3>
      <p>We aim for high availability but cannot guarantee uninterrupted service.</p>
      <h3>Liability</h3>
      <p>To the maximum extent permitted by law, IronMind and its developer are not liable for indirect or consequential damages from your use of the app.</p>
      <h3>Changes</h3>
      <p>We may update these terms; continued use means you accept the new terms.</p>
      <p className="auth-foot"><Link to="/signup">Back</Link></p>
    </div>
  )
}
