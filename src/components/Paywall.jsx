import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import './Paywall.css'

const FEATURE_ICONS = {
  coach: '🤖',
  log_workout: '🏋️',
  log_nutrition: '🥗',
  body_weight: '⚖️',
  big_three: '🏋️',
  one_rm: '📐',
  barcode_scan: '📊',
  ai_estimate: '✨',
  ai_photo_scan: '📷',
  detect_muscles: '💪',
  meal_text: '✏️',
}

export default function Paywall({ feature }) {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const icon = FEATURE_ICONS[feature] ?? '🔒'
  const titleKey = feature ? `paywall.${feature}_title` : 'paywall.fallback_title'
  const bodyKey  = feature ? `paywall.${feature}_body`  : 'paywall.fallback_body'

  return (
    <div className="paywall-card">
      <div className="paywall-icon">{icon}</div>
      <div className="paywall-title">{t(titleKey)}</div>
      <div className="paywall-body">{t(bodyKey)}</div>
      <button className="paywall-btn" onClick={() => navigate('/pricing')}>{t('paywall.cta')}</button>
      <div>
        <a
          href="/pricing"
          className="paywall-link"
          onClick={(e) => { e.preventDefault(); navigate('/pricing') }}
        >
          {t('paywall.see_plans')}
        </a>
      </div>
    </div>
  )
}
