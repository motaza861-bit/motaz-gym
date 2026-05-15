// src/data/nutritionPlan.js
export const TARGETS = {
  calories: 2400,
  protein: 210,   // grams — approx 2g/kg at ~105kg; meal plan provides ~208g
  carbs: 250,     // grams — meal plan actual
  fat: 70,        // grams — goal; meal plan provides ~66g
}

export const MEALS = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    emoji: '🍳',
    time: '7:00 AM',
    description: '5 eggs scrambled + 80g oats + banana',
    calories: 620,
    protein: 45, carbs: 75, fat: 18,
  },
  {
    id: 'pre-workout',
    name: 'Pre-Workout',
    emoji: '🥛',
    time: '10:30 AM',
    description: 'Whey protein shake + 1 banana',
    calories: 320,
    protein: 35, carbs: 40, fat: 4,
  },
  {
    id: 'lunch',
    name: 'Lunch',
    emoji: '🍗',
    time: '1:00 PM',
    description: '200g chicken breast + 150g rice + vegetables',
    calories: 620,
    protein: 55, carbs: 70, fat: 8,
  },
  {
    id: 'snack',
    name: 'Afternoon Snack',
    emoji: '🥜',
    time: '4:00 PM',
    description: 'Greek yogurt (200g) + 30g almonds',
    calories: 320,
    protein: 25, carbs: 20, fat: 18,
  },
  {
    id: 'dinner',
    name: 'Dinner',
    emoji: '🥩',
    time: '7:30 PM',
    description: '200g beef mince + sweet potato + salad',
    calories: 520,
    protein: 48, carbs: 45, fat: 18,
  },
]
