export const DEFAULT_TARGETS = {
  calories: 2400,
  protein: 210,
  carbs: 250,
  fat: 70,
}

export const DEFAULT_MEALS = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    emoji: '🍳',
    time: '7:00 AM',
    description: '5 eggs scrambled + 80g oats + banana',
    calories: 620, protein: 45, carbs: 75, fat: 18,
  },
  {
    id: 'lunch',
    name: 'Lunch',
    emoji: '🍗',
    time: '1:00 PM',
    description: '200g chicken breast + 150g rice + vegetables',
    calories: 620, protein: 55, carbs: 70, fat: 8,
  },
  {
    id: 'snack',
    name: 'Afternoon Snack',
    emoji: '🥜',
    time: '4:00 PM',
    description: 'Greek yogurt (200g) + 30g almonds',
    calories: 320, protein: 25, carbs: 20, fat: 18,
  },
  {
    id: 'dinner',
    name: 'Dinner',
    emoji: '🥩',
    time: '7:30 PM',
    description: '200g beef mince + sweet potato + salad',
    calories: 520, protein: 48, carbs: 45, fat: 18,
  },
]

// Legacy named exports kept for any direct imports
export const MEALS = DEFAULT_MEALS
export const TARGETS = DEFAULT_TARGETS
