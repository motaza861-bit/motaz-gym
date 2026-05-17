import Groq from 'groq-sdk'

const MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct'
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BASE64_BYTES = 5 * 1024 * 1024

const PROMPT = `You are a nutrition expert analysing a food photo.
Step 1 — Identify the food item(s) visible.
Step 2 — Estimate the visible portion weight in grams based on plate/container size, density, and context clues.
Step 3 — Using standard nutrition data, compute calories, protein, carbs, and fat for that exact weight.

Return ONLY this JSON (no markdown, no explanation):
{"food":"name","portionGrams":number,"calories":number,"protein":number,"carbs":number,"fat":number}

If you cannot identify any food, return: {"error":"Could not identify food"}`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { image, mimeType = 'image/jpeg' } = req.body

  if (!image) {
    return res.status(400).json({ error: 'No image provided' })
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return res.status(400).json({ error: 'Unsupported image type' })
  }

  if (image.length > MAX_BASE64_BYTES) {
    return res.status(400).json({ error: 'Image too large' })
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}` } },
          { type: 'text', text: PROMPT },
        ],
      }],
    })

    const raw = completion.choices[0].message.content.trim()
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')

    let data
    try {
      data = JSON.parse(jsonStr)
    } catch {
      return res.status(422).json({ error: 'Could not parse food analysis' })
    }

    if (data.error) {
      return res.status(422).json(data)
    }

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
