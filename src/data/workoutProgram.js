// src/data/workoutProgram.js
export const SESSIONS = {
  A: {
    name: 'Full Body A',
    focus: 'Squat & Push',
    muscles: 'Quads · Chest · Back · Shoulders · Triceps',
    exercises: [
      { name: 'Barbell Back Squat', sets: 4, reps: '6–8', rest: 180, muscles: 'Quads, Glutes' },
      { name: 'Bench Press',        sets: 4, reps: '8–10', rest: 120, muscles: 'Chest, Triceps' },
      { name: 'Barbell Row',        sets: 3, reps: '8–10', rest: 120, muscles: 'Back, Biceps' },
      { name: 'Romanian Deadlift',  sets: 3, reps: '10–12', rest: 120, muscles: 'Hamstrings, Glutes' },
      { name: 'Overhead Press',     sets: 3, reps: '10–12', rest: 120, muscles: 'Shoulders' },
      { name: 'Lateral Raises',     sets: 3, reps: '15', rest: 60,  muscles: 'Side Delts' },
      { name: 'Tricep Pushdown',    sets: 3, reps: '12', rest: 60,  muscles: 'Triceps' },
    ],
  },
  B: {
    name: 'Full Body B',
    focus: 'Deadlift & Pull',
    muscles: 'Back · Hamstrings · Chest · Biceps · Rear Delts',
    exercises: [
      { name: 'Conventional Deadlift',  sets: 4, reps: '5–6',   rest: 180, muscles: 'Back, Hamstrings, Glutes' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: '10–12', rest: 120, muscles: 'Upper Chest' },
      { name: 'Pull-ups',               sets: 4, reps: '8–10',  rest: 120, muscles: 'Back, Biceps' },
      { name: 'Bulgarian Split Squat',  sets: 3, reps: '10–12', rest: 120, muscles: 'Quads, Glutes' },
      { name: 'Cable Row',              sets: 3, reps: '12',     rest: 60,  muscles: 'Mid Back' },
      { name: 'Face Pulls',             sets: 3, reps: '15',     rest: 60,  muscles: 'Rear Delts' },
      { name: 'Bicep Curl',             sets: 3, reps: '12',     rest: 60,  muscles: 'Biceps' },
    ],
  },
}

// Mon=1,Tue=2,Wed=3,Thu=4,Fri=5,Sat=6,Sun=0
export const DAY_SESSION = { 0: 'rest', 1: 'A', 2: 'B', 3: 'rest', 4: 'A', 5: 'B', 6: 'rest' }
