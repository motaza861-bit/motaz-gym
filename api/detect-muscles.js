import { generateText } from './_gemini.js'
import { withTierGate } from './_subscription.js'

const MODEL = 'gemini-2.0-flash'

const SYSTEM = `List the primary muscles trained by an exercise name. Return ONLY a short comma-separated list, for example: "Chest, Triceps, Front Delt". No explanation, no extra text, just the list.`

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { exercise } = req.body ?? {}
  if (!exercise?.trim()) return res.status(400).json({ error: 'Missing exercise name' })

  try {
    const text = await generateText({
      model: MODEL,
      system: SYSTEM,
      user: exercise.trim(),
      maxOutputTokens: 60,
    })
    const muscles = text.replace(/^["']|["']$/g, '')
    return res.status(200).json({ muscles })
  } catch (err) {
    console.error('detect-muscles error:', err)
    return res.status(500).json({ error: 'Failed to detect muscles' })
  }
}

export default withTierGate(['tier1', 'tier2'], handler)
