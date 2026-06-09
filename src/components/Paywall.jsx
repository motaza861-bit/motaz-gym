import { useNavigate } from 'react-router-dom'
import './Paywall.css'

const FEATURE_COPY = {
  coach:          { icon: '🤖', title: 'AI Coach is a Tier 2 feature',     line: 'Subscribe to chat with your coach and let it adjust your program or log meals automatically.' },
  log_workout:    { icon: '🏋️', title: 'Tracking workouts needs a plan',   line: 'Subscribe to log sets, reps, and weights — and watch your strength climb over time.' },
  log_nutrition:  { icon: '🥗', title: 'Logging food needs a plan',        line: 'Subscribe to log meals, hit macro targets, and track nutrition history.' },
  body_weight:    { icon: '⚖️', title: 'Tracking body weight needs a plan',line: 'Subscribe to log daily body-weight and see trends over time.' },
  big_three:      { icon: '🏋️', title: 'Big-three tracking needs a plan', line: 'Subscribe to track your squat, bench, and deadlift progress.' },
  one_rm:         { icon: '📐', title: '1RM estimator needs a plan',       line: 'Subscribe to estimate one-rep maxes from your lift history.' },
  barcode_scan:   { icon: '📊', title: 'Barcode scanning needs a plan',    line: 'Subscribe to scan supermarket products and log their macros instantly.' },
  ai_estimate:    { icon: '✨', title: 'AI macro estimates need a plan',   line: 'Subscribe to estimate macros for foods that aren’t in our database.' },
  ai_photo_scan:  { icon: '📷', title: 'Photo scanning needs a plan',      line: 'Subscribe to snap your meals and get instant macro estimates.' },
  detect_muscles: { icon: '💪', title: 'Auto-detect muscles needs a plan', line: 'Subscribe to auto-detect which muscles an exercise trains.' },
  meal_text:      { icon: '✏️', title: 'AI meal analysis needs a plan',    line: 'Subscribe to estimate macros from a typed meal description.' },
}

export default function Paywall({ feature }) {
  const navigate = useNavigate()
  const copy = FEATURE_COPY[feature] ?? {
    icon: '🔒',
    title: 'Subscription required',
    line: 'Subscribe to keep using this feature.',
  }
  return (
    <div className="paywall-card">
      <div className="paywall-icon">{copy.icon}</div>
      <div className="paywall-title">{copy.title}</div>
      <div className="paywall-body">{copy.line}</div>
      <button className="paywall-btn" onClick={() => navigate('/pricing')}>Choose a plan</button>
      <div>
        <a
          href="/pricing"
          className="paywall-link"
          onClick={(e) => { e.preventDefault(); navigate('/pricing') }}
        >
          See what's in each plan ›
        </a>
      </div>
    </div>
  )
}
