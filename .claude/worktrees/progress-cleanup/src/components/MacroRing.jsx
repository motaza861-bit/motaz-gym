import './MacroRing.css'

const SIZE = 72
const STROKE = 6
const R = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * R

export default function MacroRing({ label, value, target, color }) {
  const pct = Math.min(1, target > 0 ? value / target : 0)
  const offset = CIRCUMFERENCE * (1 - pct)

  return (
    <div className="macro-ring">
      <svg width={SIZE} height={SIZE}>
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none"
          stroke={color || 'var(--accent)'}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="macro-ring-center">
        <span className="macro-ring-pct">{Math.round(pct * 100)}%</span>
      </div>
      <div className="macro-ring-label">{label}</div>
      <div className="macro-ring-values">
        <span style={{ color: color || 'var(--accent)' }}>{value}</span>
        <span className="macro-ring-target">/{target}g</span>
      </div>
    </div>
  )
}
