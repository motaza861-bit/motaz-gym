import './WorkoutCard.css'

export default function WorkoutCard({ session, sessionLabel, onStart }) {
  const preview = session.exercises.slice(0, 3)
  return (
    <div className="workout-card">
      <div className="wc-header">
        <div>
          <div className="wc-eyebrow">Today's Training</div>
          <div className="wc-title">{session.name}</div>
          <div className="wc-muscles">{session.muscles}</div>
        </div>
        <div className="wc-badge">{sessionLabel}</div>
      </div>

      <div className="wc-exercises">
        {preview.map(ex => (
          <div key={ex.name} className="wc-ex">
            <span className="wc-ex-name">{ex.name}</span>
            <span className="wc-ex-sets">{ex.sets}×{ex.reps}</span>
          </div>
        ))}
        {session.exercises.length > 3 && (
          <div className="wc-ex-more">+{session.exercises.length - 3} more exercises</div>
        )}
      </div>

      <button className="btn-primary" onClick={onStart}>⚡ Start Workout</button>
    </div>
  )
}
