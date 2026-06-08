import './Chat.css'

function describeWorkoutParams(params) {
  const lines = [`Operation: ${params.operation}`]
  if (params.sessionKey)    lines.push(`Session: ${params.sessionKey}`)
  if (params.exerciseName)  lines.push(`Exercise: ${params.exerciseName}`)
  if (params.sets != null)  lines.push(`Sets: ${params.sets}`)
  if (params.reps != null)  lines.push(`Reps: ${params.reps}`)
  if (params.newName)       lines.push(`New name: ${params.newName}`)
  if (params.weekday != null) lines.push(`Weekday: ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][params.weekday]}`)
  if (params.newSessionKey) lines.push(`New session: ${params.newSessionKey}`)
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
  const title = proposal.tool === 'modifyWorkout' ? '📋 Change to your program' : '🍽️ Log this food'
  const details = proposal.tool === 'modifyWorkout'
    ? describeWorkoutParams(proposal.params)
    : describeFoodParams(proposal.params)

  return (
    <div className="chat-row left">
      <div className="proposal-card">
        <div className="proposal-card-header">{title}</div>
        <div className="proposal-card-summary">{proposal.summary}</div>
        <pre className="proposal-card-details">{details}</pre>
        {applied ? (
          <div className="proposal-applied">✓ Applied</div>
        ) : (
          <div className="proposal-card-actions">
            <button className="proposal-cancel" onClick={onCancel}>Cancel</button>
            <button className="proposal-apply"  onClick={onApply}>Apply</button>
          </div>
        )}
      </div>
    </div>
  )
}
