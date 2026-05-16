import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { image, mimeType = 'image/jpeg' } = req.body

  if (!image) {
    return res.status(400).json({ error: 'No image provided' })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: image },
          },
          {
            type: 'text',
            text: 'Analyse this food photo. Estimate the nutritional content for the portion visible. Return ONLY this JSON (no markdown, no explanation): {"food":"food name","calories":number,"protein":number,"carbs":number,"fat":number}. If you cannot identify any food, return {"error":"Could not identify food"}.',
          },
        ],
      }],
    })

    const raw = message.content[0].text.trim()
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const data = JSON.parse(jsonStr)

    if (data.error) {
      return res.status(422).json(data)
    }

    return res.status(200).json(data)
  } catch (err) {
    console.error('analyze-food error:', err.message)
    return res.status(500).json({ error: 'Failed to analyse image' })
  }
}
