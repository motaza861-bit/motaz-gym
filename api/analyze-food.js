import { generateVisionJSON } from './_gemini.js'
import { withTierGate } from './_subscription.js'

const MODEL = 'gemini-2.0-flash'
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BASE64_BYTES = 5 * 1024 * 1024

const SYSTEM = `You are a nutrition expert analysing a food photo.
Step 1 — Identify the food item(s) visible.
Step 2 — Estimate the visible portion weight in grams based on plate/container size, density, and context clues.
Step 3 — Using standard nutrition data, compute calories, protein, carbs, and fat for that exact weight.

Return ONLY this JSON (no markdown, no explanation):
{"food":"name","portionGrams":number,"calories":number,"protein":number,"carbs":number,"fat":number}

If you cannot identify any food, return: {"error":"Could not identify food"}`

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { image, mimeType = 'image/jpeg' } = req.body
  if (!image) return res.status(400).json({ error: 'No image provided' })
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return res.status(400).json({ error: 'Unsupported image type' })
  if (image.length > MAX_BASE64_BYTES) return res.status(400).json({ error: 'Image too large' })

  try {
    const data = await generateVisionJSON({
      model: MODEL,
      system: SYSTEM,
      imageBase64: image,
      mimeType,
      user: 'Analyse this image.',
    })

    if (data.error) return res.status(422).json(data)

    const { food, portionGrams, calories, protein, carbs, fat } = data
    if (
      typeof calories !== 'number' || typeof protein !== 'number' ||
      typeof carbs !== 'number' || typeof fat !== 'number' ||
      typeof portionGrams !== 'number'
    ) {
      return res.status(422).json({ error: 'Could not identify food' })
    }

    return res.status(200).json({ food, portionGrams, calories, protein, carbs, fat })
  } catch (err) {
    console.error('analyze-food error:', err)
    return res.status(500).json({ error: 'Failed to analyse image' })
  }
}

export default withTierGate(['tier1', 'tier2'], handler)
