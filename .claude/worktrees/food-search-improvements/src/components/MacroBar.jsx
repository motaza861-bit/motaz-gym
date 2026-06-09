import './MacroBar.css'

export default function MacroBar({ label, value = 0, target = 0, color, unit = 'g' }) {
  const pct = Math.min(100, target > 0 ? Math.round((value / target) * 100) : 0)
  return (
    <div className="macro-bar">
      <div className="macro-bar-top">
        <span className="macro-bar-label">{label}</span>
        <span className="macro-bar-values" style={{ color }}>
          {value}{unit} <span className="macro-bar-target">/ {target}{unit}</span>
        </span>
      </div>
      <div className="macro-bar-track">
        <div className="macro-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
