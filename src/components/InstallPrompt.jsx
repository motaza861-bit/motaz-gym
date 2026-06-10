import { useEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import './InstallPrompt.css'

const DISMISSED_KEY = '__install_dismissed'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(window.navigator.userAgent)
}

export default function InstallPrompt() {
  const { t } = useLanguage()
  const [evt, setEvt] = useState(null)
  const [iosHint, setIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1')

  useEffect(() => {
    if (dismissed || isStandalone()) return
    function onPrompt(e) { e.preventDefault(); setEvt(e) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    if (isIOS()) setIosHint(true)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [dismissed])

  if (dismissed || isStandalone()) return null
  if (!evt && !iosHint) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  async function install() {
    if (!evt) return
    evt.prompt()
    await evt.userChoice
    dismiss()
  }

  return (
    <div className="install-banner">
      <div className="install-banner-text">
        {evt ? t('inst.with_evt') : t('inst.ios')}
      </div>
      <div className="install-banner-actions">
        <button onClick={dismiss}>{t('inst.later')}</button>
        {evt && <button className="primary" onClick={install}>{t('inst.install')}</button>}
      </div>
    </div>
  )
}
