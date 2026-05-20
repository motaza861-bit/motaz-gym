import Groq from 'groq-sdk'

const MODEL = 'llama-3.3-70b-versatile'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { description } = req.body
  if (!description?.trim()) return res.status(400).json({ error: 'Missing description' })

  const prompt = `You are a nutrition expert. Estimate the macros for this meal:
"${description.trim()}"

Return ONLY valid JSON with whole numbers, no explanation:
{"calories":number,"protein":number,"carbs":number,"fat":number}`

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 128,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = completion.choices[0].message.content.trim()
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const data = JSON.parse(jsonStr)

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
