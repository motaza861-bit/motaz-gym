import './PRAlert.css'

export default function PRAlert({ pr }) {
  if (!pr) return null
  return (
    <div className="pr-alert">
      <span className="pr-icon">🏆</span>
      <div className="pr-body">
        <div className="pr-title">New PR — {pr.exercise}</div>
        <div className="pr-sub">{pr.date}</div>
      </div>
      <div className="pr-weight">{pr.weight}kg</div>
    </div>
  )
}
