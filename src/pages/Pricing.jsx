import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Pricing.css'

export default function Pricing() {
  const navigate = useNavigate()
  const [contactMessage, setContactMessage] = useState('')

  function handleSubscribe(tier) {
    setContactMessage(
      `Coming soon. Email adelmotaz861@gmail.com with "Subscribe to ${tier}" and we'll set you up manually until automated billing ships.`
    )
  }

  return (
    <div className="pricing-page">
      <h1 className="pricing-title">Choose your plan</h1>

      <div className="pricing-grid">
        <div className="pricing-card">
          <span className="pricing-tier">Tier 1</span>
          <div className="pricing-price">$XX<span className="pricing-price-suffix">/mo</span></div>
          <ul className="pricing-features">
            <li>Track every workout</li>
            <li>Log meals + body weight</li>
            <li>Big-three + 1RM tracking</li>
            <li>Barcode scanner</li>
            <li>AI macro estimates</li>
            <li>Photo food scanner</li>
            <li className="disabled">AI Coach</li>
          </ul>
          <button className="pricing-subscribe" onClick={() => handleSubscribe('Tier 1')}>Subscribe</button>
        </div>

        <div className="pricing-card pricing-card-popular">
          <span className="pricing-popular-pill">Most popular</span>
          <span className="pricing-tier">Tier 2</span>
          <div className="pricing-price">$XX<span className="pricing-price-suffix">/mo</span></div>
          <ul className="pricing-features">
            <li>Everything in Tier 1</li>
            <li><strong>AI Coach</strong> — chat to adjust your program, log food automatically</li>
          </ul>
          <button className="pricing-subscribe" onClick={() => handleSubscribe('Tier 2')}>Subscribe</button>
        </div>
      </div>

      {contactMessage && <div className="pricing-soon">{contactMessage}</div>}

      <p className="pricing-trial">💡 7-day free trial included — Tier 2 access, auto-started at signup.</p>

      <p className="pricing-trial">
        <a href="/dashboard" onClick={(e) => { e.preventDefault(); navigate('/dashboard') }}>← Back</a>
      </p>
    </div>
  )
}
