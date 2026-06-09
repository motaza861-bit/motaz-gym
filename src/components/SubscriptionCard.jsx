import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'

function format(date) {
  if (!date) return ''
  return new Date(date).toISOString().slice(0, 10)
}

function variantOf({ status, daysLeft }) {
  if (status === 'active') return 'active'
  if (status === 'trialing' && daysLeft > 2) return 'trialing'
  if (status === 'trialing' && daysLeft <= 2) return 'warning'
  return 'expired'
}

export default function SubscriptionCard() {
  const navigate = useNavigate()
  const sub = useSubscription()
  const v = variantOf(sub)

  if (v === 'active') {
    return (
      <div className="card settings-card sub-card">
        <div className="sub-card-title">🎟️ Subscription</div>
        <div className="sub-card-row"><span className="sub-card-row-label">Status</span><span>Active</span></div>
        <div className="sub-card-row"><span className="sub-card-row-label">Tier</span><span>{sub.storedTier === 'tier2' ? 'Tier 2 (full access)' : 'Tier 1'}</span></div>
        <button className="sub-card-cta" onClick={() => navigate('/pricing')}>Manage plan</button>
        <button className="sub-card-link" onClick={() => navigate('/pricing')}>Compare plans ›</button>
      </div>
    )
  }

  if (v === 'trialing') {
    return (
      <div className="card settings-card sub-card">
        <div className="sub-card-title">🎟️ Subscription</div>
        <div className="sub-card-row"><span className="sub-card-row-label">Status</span><span>Trialing</span></div>
        <div className="sub-card-row"><span className="sub-card-row-label">Tier</span><span>Trial (Tier 2 access)</span></div>
        <div className="sub-card-row"><span className="sub-card-row-label">Days left in trial</span><span>{sub.daysLeft}</span></div>
        <button className="sub-card-cta" onClick={() => navigate('/pricing')}>Choose a plan</button>
        <button className="sub-card-link" onClick={() => navigate('/pricing')}>See what's in each plan ›</button>
      </div>
    )
  }

  if (v === 'warning') {
    return (
      <div className="card settings-card sub-card sub-card-warning">
        <div className="sub-card-title">⚠️ Your trial ends in {sub.daysLeft} {sub.daysLeft === 1 ? 'day' : 'days'}</div>
        <div className="sub-card-body">
          Choose a plan now to keep tracking, logging meals, and using AI Coach.
        </div>
        <button className="sub-card-cta" onClick={() => navigate('/pricing')}>Choose a plan</button>
        <button className="sub-card-link" onClick={() => navigate('/pricing')}>See what's in each plan ›</button>
      </div>
    )
  }

  return (
    <div className="card settings-card sub-card sub-card-expired">
      <div className="sub-card-title">🔒 Subscription expired</div>
      <div className="sub-card-body">
        Trial ended on {format(sub.trialEndsAt)}. Subscribe to keep using IronMind.
      </div>
      <button className="sub-card-cta" onClick={() => navigate('/pricing')}>Subscribe</button>
      <button className="sub-card-link" onClick={() => navigate('/pricing')}>See plans ›</button>
    </div>
  )
}
