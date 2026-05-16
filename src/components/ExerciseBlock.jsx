// src/components/ExerciseBlock.jsx
import './ExerciseBlock.css'

const SET_TYPES = ['S', 'W', 'T', 'D']
const TYPE_COLORS = { S: 'var(--text-muted)', W: 'var(--orange)', T: 'var(--red)', D: 'var(--yellow)' }

export default function ExerciseBlock({ exercise, sets, onSetUpdate, previousSets, onSwap, onEdit, onDelete }) {
  const hasPrev = previousSets?.some(s => s.weight > 0)

  return (
    <div className="ex-block">
      <div className="ex-block-header">
        <div>
          <div className="ex-block-name">{exercise.name}</div>
          <div className="ex-block-meta">{exercise.sets} sets · {exercise.reps} reps · {exercise.rest}s rest</div>
        </div>
        <div className="ex-block-header-actions">
          {onSwap && (
            <button className="ex-swap-btn" onClick={onSwap} title="Swap exercise">⇄</button>
          )}
          {onEdit && (
            <button className="ex-action-btn" onClick={onEdit} title="Edit exercise">✏️</button>
          )}
          {onDelete && (
            <button className="ex-action-btn" onClick={onDelete} title="Delete exercise">🗑</button>
          )}
        </div>
      </div>

      {hasPrev && <div className="ex-ghost-hint">Placeholders = last session</div>}

      <div className="ex-set-header">
        <span>Type</span><span>#</span><span>kg</span><span>Reps</span><span>✓</span>
      </div>

      {sets.map((set, i) => {
        const prev = previousSets?.[i]
        const nextType = SET_TYPES[(SET_TYPES.indexOf(set.type) + 1) % SET_TYPES.length]
        return (
          <div key={i}>
            <div className={`ex-set-row ${set.completed ? 'done' : ''}`}>
              <button
                className="set-type-btn"
                style={{ color: TYPE_COLORS[set.type] }}
                onClick={() => onSetUpdate(i, 'type', nextType)}
                title={`${set.type} — click to change`}
              >
                {set.type}
              </button>
              <span className="set-num">{i + 1}</span>
              <input
                className="set-input"
                type="number"
                inputMode="decimal"
                value={set.weight || ''}
                placeholder={prev?.weight ? String(prev.weight) : '0'}
                onChange={e => onSetUpdate(i, 'weight', parseFloat(e.target.value) || 0)}
              />
              <input
                className="set-input"
                type="number"
                inputMode="numeric"
                value={set.reps || ''}
                placeholder={prev?.reps ? String(prev.reps) : '0'}
                onChange={e => onSetUpdate(i, 'reps', parseInt(e.target.value) || 0)}
              />
              <button
                className={`set-check ${set.completed ? 'checked' : ''}`}
                onClick={() => onSetUpdate(i, 'completed', !set.completed)}
              >
                {set.completed ? '✓' : '○'}
              </button>
            </div>
            {set.completed && (
              <div className="set-rpe-row">
                <span className="set-rpe-label">RPE</span>
                <input
                  className="set-rpe-input"
                  type="number"
                  inputMode="numeric"
                  min="1" max="10"
                  value={set.rpe ?? ''}
                  placeholder="1–10"
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    onSetUpdate(i, 'rpe', v >= 1 && v <= 10 ? v : null)
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
