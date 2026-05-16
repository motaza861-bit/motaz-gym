import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL = 'gemini-2.0-flash'
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BASE64_BYTES = 5 * 1024 * 1024 // ~3.75 MB decoded

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

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: MODEL })

  try {
    const result = await model.generateContent([
      { inlineData: { data: image, mimeType } },
      'Analyse this food photo. Estimate the nutritional content for the portion visible. Return ONLY this JSON (no markdown, no explanation): {"food":"food name","calories":number,"protein":number,"carbs":number,"fat":number}. If you cannot identify any food, return {"error":"Could not identify food"}.',
    ])

    const raw = result.response.text().trim()
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

    const { food, calories, protein, carbs, fat } = data
    if (typeof calories !== 'number' || typeof protein !== 'number' ||
        typeof carbs !== 'number' || typeof fat !== 'number') {
      return res.status(422).json({ error: 'Could not identify food' })
    }

    return res.status(200).json({ food, calories, protein, carbs, fat })
  } catch (err) {
    console.error('analyze-food error:', err)
    return res.status(500).json({ error: 'Failed to analyse image' })
  }
}
