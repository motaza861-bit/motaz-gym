// src/lib/coachTools.js — pure appliers for AI Coach tool proposals.

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function generateEntryId(prefix = 'qlog') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function applyModifyWorkout(program, params) {
  const next = clone(program)
  const { operation } = params

  switch (operation) {
    case 'add_exercise': {
      const s = next.sessions[params.sessionKey]
      if (!s) return program
      s.exercises = [...(s.exercises ?? []), {
        name: params.exerciseName,
        sets: params.sets ?? 3,
        reps: params.reps ?? '8-10',
      }]
      return next
    }
    case 'remove_exercise': {
      const s = next.sessions[params.sessionKey]
      if (!s) return program
      s.exercises = (s.exercises ?? []).filter(e => e.name !== params.exerciseName)
      return next
    }
    case 'update_exercise': {
      const s = next.sessions[params.sessionKey]
      if (!s) return program
      s.exercises = (s.exercises ?? []).map(e =>
        e.name === params.exerciseName
          ? { ...e, ...(params.sets != null && { sets: params.sets }), ...(params.reps != null && { reps: params.reps }) }
          : e
      )
      return next
    }
    case 'add_session': {
      next.sessions[params.sessionKey] = {
        name: params.newName ?? params.sessionKey,
        focus: '',
        muscles: '',
        exercises: [],
      }
      return next
    }
    case 'rename_session': {
      const s = next.sessions[params.sessionKey]
      if (!s) return program
      s.name = params.newName
      return next
    }
    case 'change_day_session': {
      next.daySession[params.weekday] = params.newSessionKey
      return next
    }
    default:
      return program
  }
}

export function applyLogFood(nutritionLogs, dateStr, params) {
  const next = clone(nutritionLogs)
  const entries = (params.items ?? []).map(item => {
    const ratio = (item.grams ?? 100) / 100
    return {
      id: generateEntryId('aichat'),
      name: item.name,
      emoji: item.emoji ?? '✨',
      portionG: item.grams ?? 100,
      calories: Math.round((item.per100g?.calories ?? 0) * ratio),
      protein:  Math.round((item.per100g?.protein  ?? 0) * ratio),
      carbs:    Math.round((item.per100g?.carbs    ?? 0) * ratio),
      fat:      Math.round((item.per100g?.fat      ?? 0) * ratio),
      _source: 'ai-chat',
    }
  })

  const existing = next.find(l => l.date === dateStr)
  if (existing) {
    existing.quickLogs = [...(existing.quickLogs ?? []), ...entries]
    return next
  }
  next.push({ date: dateStr, meals: [], quickLogs: entries, calorieBump: 0 })
  return next
}
