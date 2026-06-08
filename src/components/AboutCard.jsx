/* global __APP_VERSION__ */
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'

const FEEDBACK_EMAIL = 'adelmotaz861@gmail.com'

export default function AboutCard() {
  const { t } = useLanguage()
  return (
    <div className="card settings-card about-card">
      <div className="settings-card-title">{t('st.about')}</div>
      <div className="about-meta">
        <div className="about-name">IronMind v{__APP_VERSION__}</div>
        <div className="about-stack">React + Vite · Supabase · Gemini</div>
        <div className="about-author">{t('st.about_made_by')}</div>
      </div>
      <div className="about-links">
        <Link to="/privacy" className="about-link">
          <span>{t('st.about_privacy')}</span><span>›</span>
        </Link>
        <Link to="/terms" className="about-link">
          <span>{t('st.about_terms')}</span><span>›</span>
        </Link>
        <a href={`mailto:${FEEDBACK_EMAIL}`} className="about-link">
          <span>{t('st.about_feedback')}</span><span>›</span>
        </a>
      </div>
    </div>
  )
}
