import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import './Pricing.css'

export default function Pricing() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [contactMessage, setContactMessage] = useState('')

  function handleSubscribe(tier) {
    setContactMessage(t('pricing.coming_soon', { tier }))
  }

  return (
    <div className="pricing-page">
      <h1 className="pricing-title">{t('pricing.title')}</h1>

      <div className="pricing-grid">
        <div className="pricing-card">
          <span className="pricing-tier">{t('pricing.tier1')}</span>
          <div className="pricing-price">$XX<span className="pricing-price-suffix">{t('pricing.month_suffix')}</span></div>
          <ul className="pricing-features">
            <li>{t('pricing.feat_workouts')}</li>
            <li>{t('pricing.feat_meals')}</li>
            <li>{t('pricing.feat_bigthree')}</li>
            <li>{t('pricing.feat_barcode')}</li>
            <li>{t('pricing.feat_ai_macros')}</li>
            <li>{t('pricing.feat_photo')}</li>
            <li className="disabled">{t('pricing.feat_no_coach')}</li>
          </ul>
          <button className="pricing-subscribe" onClick={() => handleSubscribe(t('pricing.tier1'))}>{t('pricing.subscribe')}</button>
        </div>

        <div className="pricing-card pricing-card-popular">
          <span className="pricing-popular-pill">{t('pricing.popular')}</span>
          <span className="pricing-tier">{t('pricing.tier2')}</span>
          <div className="pricing-price">$XX<span className="pricing-price-suffix">{t('pricing.month_suffix')}</span></div>
          <ul className="pricing-features">
            <li>{t('pricing.tier2_everything')}</li>
            <li>{t('pricing.tier2_coach')}</li>
          </ul>
          <button className="pricing-subscribe" onClick={() => handleSubscribe(t('pricing.tier2'))}>{t('pricing.subscribe')}</button>
        </div>
      </div>

      {contactMessage && <div className="pricing-soon">{contactMessage}</div>}

      <p className="pricing-trial">{t('pricing.trial_note')}</p>

      <p className="pricing-trial">
        <a href="/dashboard" onClick={(e) => { e.preventDefault(); navigate('/dashboard') }}>{t('pricing.back')}</a>
      </p>
    </div>
  )
}
