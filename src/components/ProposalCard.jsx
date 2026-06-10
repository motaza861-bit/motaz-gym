import { useLanguage } from '../context/LanguageContext'
import './Chat.css'

const WEEKDAY_KEYS = ['prop.wd_sun', 'prop.wd_mon', 'prop.wd_tue', 'prop.wd_wed', 'prop.wd_thu', 'prop.wd_fri', 'prop.wd_sat']

function describeWorkoutParams(t, params) {
  const lines = [`${t('prop.op')}: ${params.operation}`]
  if (params.sessionKey)      lines.push(`${t('prop.session')}: ${params.sessionKey}`)
  if (params.exerciseName)    lines.push(`${t('prop.exercise')}: ${params.exerciseName}`)
  if (params.sets != null)    lines.push(`${t('prop.sets')}: ${params.sets}`)
  if (params.reps != null)    lines.push(`${t('prop.reps')}: ${params.reps}`)
  if (params.newName)         lines.push(`${t('prop.new_name')}: ${params.newName}`)
  if (params.weekday != null) lines.push(`${t('prop.weekday')}: ${t(WEEKDAY_KEYS[params.weekday])}`)
  if (params.newSessionKey)   lines.push(`${t('prop.new_session')}: ${params.newSessionKey}`)
  return lines.join('\n')
}

function describeFoodParams(params) {
  return (params.items ?? []).map(item => {
    const ratio = (item.grams ?? 100) / 100
    const cal = Math.round((item.per100g?.calories ?? 0) * ratio)
    return `${item.emoji ?? '✨'} ${item.name} — ${item.grams}g (~${cal} kcal)`
  }).join('\n')
}

export default function ProposalCard({ proposal, applied, onApply, onCancel }) {
  const { t } = useLanguage()
  const title = proposal.tool === 'modifyWorkout' ? t('prop.title_workout') : t('prop.title_food')
  const details = proposal.tool === 'modifyWorkout'
    ? describeWorkoutParams(t, proposal.params)
    : describeFoodParams(proposal.params)

  return (
    <div className="chat-row left">
      <div className="proposal-card">
        <div className="proposal-card-header">{title}</div>
        <div className="proposal-card-summary">{proposal.summary}</div>
        <pre className="proposal-card-details">{details}</pre>
        {applied ? (
          <div className="proposal-applied">{t('prop.applied')}</div>
        ) : (
          <div className="proposal-card-actions">
            <button className="proposal-cancel" onClick={onCancel}>{t('prop.cancel')}</button>
            <button className="proposal-apply"  onClick={onApply}>{t('prop.apply')}</button>
          </div>
        )}
      </div>
    </div>
  )
}
