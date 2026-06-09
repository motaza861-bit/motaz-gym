// Returns array of { date, [sessionKey]: totalVolume }
export function calcVolumeBySession(workoutLogs) {
  return workoutLogs
    .filter(l => l.completed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(log => {
      const point = { date: log.date.slice(5) }
      const key = log.session ?? 'Workout'
      const vol = (log.exercises ?? [])
        .flatMap(ex => ex.sets ?? [])
        .filter(s => s.completed && s.weight > 0 && s.reps > 0)
        .reduce((sum, s) => sum + s.weight * s.reps, 0)
      if (vol > 0) point[key] = vol
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
