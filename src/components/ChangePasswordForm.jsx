import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../context/LanguageContext'

export default function ChangePasswordForm({ onClose }) {
  const { t } = useLanguage()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setError('')
    if (next.length < 8) { setError(t('st.cp_short')); return }
    if (next !== confirm) { setError(t('st.cp_mismatch')); return }
    setBusy(true)

    const { data: userData } = await supabase.auth.getUser()
    const email = userData?.user?.email
    if (!email) { setError('No active session.'); setBusy(false); return }

    const verify = await supabase.auth.signInWithPassword({ email, password: current })
    if (verify.error) {
      setError(t('st.cp_wrong_current'))
      setBusy(false)
      return
    }

    const update = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (update.error) {
      setError(update.error.message)
      return
    }

    onClose({ ok: true })
  }

  return (
    <div className="cp-form">
      {error && <div className="auth-error">{error}</div>}
      <label className="profile-field">
        <span className="profile-label">{t('st.cp_current')}</span>
        <input className="calc-input" type="password" autoComplete="current-password"
          value={current} onChange={e => setCurrent(e.target.value)} />
      </label>
      <label className="profile-field">
        <span className="profile-label">{t('st.cp_new')}</span>
        <input className="calc-input" type="password" autoComplete="new-password"
          value={next} onChange={e => setNext(e.target.value)} />
      </label>
      <label className="profile-field">
        <span className="profile-label">{t('st.cp_confirm')}</span>
        <input className="calc-input" type="password" autoComplete="new-password"
          value={confirm} onChange={e => setConfirm(e.target.value)} />
      </label>
      <div className="cp-form-actions">
        <button className="settings-btn" onClick={() => onClose({ ok: false })} disabled={busy}>
          {t('st.cp_cancel')}
        </button>
        <button className="settings-btn" onClick={save} disabled={busy}>
          {busy ? '…' : t('st.cp_save')}
        </button>
      </div>
    </div>
  )
}
