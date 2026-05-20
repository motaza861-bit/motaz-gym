import Groq from 'groq-sdk'

const MODEL = 'llama-3.3-70b-versatile'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { exercise } = req.body
  if (!exercise?.trim()) return res.status(400).json({ error: 'Missing exercise name' })

  const prompt = `List the primary muscles trained by this exercise: "${exercise.trim()}"
Return ONLY a short comma-separated list, for example: "Chest, Triceps, Front Delt"
No explanation, no extra text, just the list.`

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 60,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })

    const muscles = completion.choices[0].message.content.trim().replace(/^["']|["']$/g, '')
    return res.status(200).json({ muscles })
  } catch (err) {
    console.error('detect-muscles error:', err)
    return res.status(500).json({ error: 'Failed to detect muscles' })
  }
}
