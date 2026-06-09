// src/components/CalorieRing.jsx
import './CalorieRing.css'

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function CalorieRing({ eaten, target }) {
  const pct = Math.min(1, target > 0 ? eaten / target : 0)
  const offset = CIRCUMFERENCE * (1 - pct)
  const remaining = Math.max(0, target - eaten)

  return (
    <div className="calorie-ring-wrap">
      <div className="calorie-ring">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--border-light)" strokeWidth="12" />
          <circle
            cx="60" cy="60" r={RADIUS}
            fill="none" stroke="var(--accent)" strokeWidth="12"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="calorie-ring-center">
          <div className="calorie-ring-eaten">{eaten}</div>
          <div className="calorie-ring-label">kcal</div>
        </div>
      </div>
      <div className="calorie-ring-info">
        <div className="calorie-ring-remaining">{remaining} kcal left</div>
        <div className="calorie-ring-target">Goal: {target} kcal</div>
        <div className="calorie-ring-pct">{Math.round(pct * 100)}% reached</div>
      </div>
    </div>
  )
}
