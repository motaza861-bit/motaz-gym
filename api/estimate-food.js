import Groq from 'groq-sdk'

const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

const PROMPT = `You are a nutrition expert. The user typed a food name. Estimate macros per 100g for that food.
Return ONLY this JSON (no markdown, no explanation):
{"name":"<canonical name>","emoji":"<single emoji>","per100g":{"calories":<int>,"protein":<int>,"carbs":<int>,"fat":<int>},"defaultPortion":<int grams>}
Use your best judgement for region-specific or branded products.
If the query is too vague or you can't make a sensible estimate, return: {"error":"Could not estimate"}`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query } = req.body ?? {}
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Missing query' })
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 256,
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: query.trim() },
      ],
    })
    const raw = completion.choices[0].message.content.trim()
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')

    let data
    try { data = JSON.parse(jsonStr) }
    catch { return res.status(422).json({ error: 'Could not parse estimate' }) }

    if (data.error) return res.status(422).json(data)

    const { name, emoji, per100g, defaultPortion } = data
    if (
      typeof name !== 'string' ||
      !per100g ||
      typeof per100g.calories !== 'number' ||
      typeof per100g.protein !== 'number' ||
      typeof per100g.carbs !== 'number' ||
      typeof per100g.fat !== 'number'
    ) {
      return res.status(422).json({ error: 'Invalid estimate shape' })
    }

    return res.status(200).json({
      id: `ai_${Date.now()}`,
      name,
      emoji: emoji || '✨',
      per100g: {
        calories: Math.round(per100g.calories),
        protein:  Math.round(per100g.protein),
        carbs:    Math.round(per100g.carbs),
        fat:      Math.round(per100g.fat),
      },
      defaultPortion: typeof defaultPortion === 'number' ? Math.round(defaultPortion) : 100,
      _source: 'ai',
      _aiEstimate: true,
    })
  } catch {
    return res.status(500).json({ error: 'Failed to estimate' })
  }
}
