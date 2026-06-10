import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'
import { useLanguage } from '../context/LanguageContext'

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
  const { t } = useLanguage()
  const sub = useSubscription()
  const v = variantOf(sub)

  if (v === 'active') {
    return (
      <div className="card settings-card sub-card">
        <div className="sub-card-title">🎟️ {t('sub.title')}</div>
        <div className="sub-card-row"><span className="sub-card-row-label">{t('sub.status')}</span><span>{t('sub.status_active')}</span></div>
        <div className="sub-card-row"><span className="sub-card-row-label">{t('sub.tier')}</span><span>{sub.storedTier === 'tier2' ? t('sub.tier2_full') : t('sub.tier1')}</span></div>
        <button className="sub-card-cta" onClick={() => navigate('/pricing')}>{t('sub.manage_plan')}</button>
        <button className="sub-card-link" onClick={() => navigate('/pricing')}>{t('sub.compare_plans')}</button>
      </div>
    )
  }

  if (v === 'trialing') {
    return (
      <div className="card settings-card sub-card">
        <div className="sub-card-title">🎟️ {t('sub.title')}</div>
        <div className="sub-card-row"><span className="sub-card-row-label">{t('sub.status')}</span><span>{t('sub.status_trialing')}</span></div>
        <div className="sub-card-row"><span className="sub-card-row-label">{t('sub.tier')}</span><span>{t('sub.tier_trial_access')}</span></div>
        <div className="sub-card-row"><span className="sub-card-row-label">{t('sub.days_left')}</span><span>{sub.daysLeft}</span></div>
        <button className="sub-card-cta" onClick={() => navigate('/pricing')}>{t('sub.choose_plan')}</button>
        <button className="sub-card-link" onClick={() => navigate('/pricing')}>{t('sub.see_each_plan')}</button>
      </div>
    )
  }

  if (v === 'warning') {
    return (
      <div className="card settings-card sub-card sub-card-warning">
        <div className="sub-card-title">⚠️ {t('sub.urgent_title', { n: sub.daysLeft, unit: sub.daysLeft === 1 ? t('sub.day') : t('sub.days') })}</div>
        <div className="sub-card-body">{t('sub.urgent_body')}</div>
        <button className="sub-card-cta" onClick={() => navigate('/pricing')}>{t('sub.choose_plan')}</button>
        <button className="sub-card-link" onClick={() => navigate('/pricing')}>{t('sub.see_each_plan')}</button>
      </div>
    )
  }

  return (
    <div className="card settings-card sub-card sub-card-expired">
      <div className="sub-card-title">🔒 {t('sub.expired_title')}</div>
      <div className="sub-card-body">{t('sub.expired_body', { date: format(sub.trialEndsAt) })}</div>
      <button className="sub-card-cta" onClick={() => navigate('/pricing')}>{t('sub.subscribe')}</button>
      <button className="sub-card-link" onClick={() => navigate('/pricing')}>{t('sub.see_plans')}</button>
    </div>
  )
}
