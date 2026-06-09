import { generateJSON } from './_gemini.js'
import { withTierGate } from './_subscription.js'

const MODEL = 'gemini-2.0-flash'

const SYSTEM = `You are a nutrition expert. Estimate macros for a meal description.
Return ONLY valid JSON with whole numbers, no explanation:
{"calories":number,"protein":number,"carbs":number,"fat":number}`

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { description } = req.body ?? {}
  if (!description?.trim()) return res.status(400).json({ error: 'Missing description' })

  try {
    const data = await generateJSON({
      model: MODEL,
      system: SYSTEM,
      user: description.trim(),
      maxOutputTokens: 128,
    })

    return res.status(200).json({
      calories: Math.max(0, Math.round(data.calories) || 0),
      protein:  Math.max(0, Math.round(data.protein)  || 0),
      carbs:    Math.max(0, Math.round(data.carbs)    || 0),
      fat:      Math.max(0, Math.round(data.fat)      || 0),
    })
  } catch (err) {
    console.error('analyze-meal-text error:', err)
    return res.status(500).json({ error: 'Failed to estimate macros' })
  }
}

export default withTierGate(['tier1', 'tier2'], handler)
