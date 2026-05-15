// src/utils/volumeHelpers.js

const MUSCLE_MAP = {
  'Barbell Back Squat':    'Legs',
  'Romanian Deadlift':     'Legs',
  'Bulgarian Split Squat': 'Legs',
  'Bench Press':           'Chest',
  'Incline Dumbbell Press':'Chest',
  'Barbell Row':           'Back',
  'Pull-ups':              'Back',
  'Cable Row':             'Back',
  'Conventional Deadlift': 'Back',
  'Overhead Press':        'Shoulders',
  'Lateral Raises':        'Shoulders',
  'Face Pulls':            'Shoulders',
  'Tricep Pushdown':       'Arms',
  'Bicep Curl':            'Arms',
}

// Returns array of { date, Chest, Back, Legs, Shoulders, Arms }
export function calcVolumeBySession(workoutLogs) {
  return workoutLogs
    .filter(l => l.completed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(log => {
      const point = { date: log.date.slice(5) }
      for (const ex of log.exercises ?? []) {
        const muscle = MUSCLE_MAP[ex.name] ?? 'Other'
        const vol = ex.sets
          .filter(s => s.completed && s.weight > 0 && s.reps > 0)
          .reduce((sum, s) => sum + s.weight * s.reps, 0)
        if (vol > 0) point[muscle] = (point[muscle] ?? 0) + vol
      }
      return point
    })
}

// Adds a rolling `avg` field to each data point
export function movingAverage(data, field = 'weight', windowSize = 7) {
  return data.map((point, i) => {
    const slice = data.slice(Math.max(0, i - windowSize + 1), i + 1)
    const avg = slice.reduce((sum, p) => sum + (p[field] ?? 0), 0) / slice.length
    return { ...point, avg: Math.round(avg * 10) / 10 }
  })
}
