// Only count Top Set and Working Set — not warm-ups or drop sets.
// Sets without a type field (legacy logs) are treated as countable.
function maxWeight(sets) {
  const countable = sets.filter(s =>
    s.completed && s.weight > 0 && (!s.type || s.type === 'T' || s.type === 'S')
  )
  if (!countable.length) return 0
  return Math.max(...countable.map(s => s.weight))
}

// Returns PR object if newSets set a new weight record, else null
export function detectPR(exerciseName, newSets, workoutLogs) {
  const previousMax = workoutLogs
    .flatMap(log => log.exercises ?? [])
    .filter(ex => ex.name === exerciseName)
    .reduce((best, ex) => Math.max(best, maxWeight(ex.sets)), 0)

  const newMax = maxWeight(newSets)
  if (!newMax) return null
  if (!previousMax) return { exercise: exerciseName, weight: newMax, previousBest: 0 }
  if (newMax > previousMax) {
    return { exercise: exerciseName, weight: newMax, previousBest: previousMax }
  }
  return null
}

// Returns the all-time best working-set weight per exercise across all logs
export function getPRs(workoutLogs) {
  const bests = {}
  for (const log of workoutLogs) {
    for (const ex of log.exercises ?? []) {
      const w = maxWeight(ex.sets)
      if (w > 0 && (!bests[ex.name] || w >= bests[ex.name].weight)) {
        bests[ex.name] = { exercise: ex.name, weight: w, date: log.date }
      }
    }
  }
  return Object.values(bests)
}
