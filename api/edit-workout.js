import Groq from 'groq-sdk'

const MODEL = 'llama-3.3-70b-versatile'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { currentProgram, feedback } = req.body

  if (!currentProgram?.sessions || !feedback?.trim()) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const sessionKeys = Object.keys(currentProgram.sessions)

  const prompt = `You are an expert strength and conditioning coach. Modify the workout program below based on the user's feedback.

CURRENT PROGRAM (session keys: ${sessionKeys.join(', ')}):
${JSON.stringify(currentProgram.sessions, null, 2)}

USER FEEDBACK: "${feedback.trim()}"

INSTRUCTIONS:
- Apply only the changes the user asked for
- Keep the exact same session keys: ${sessionKeys.join(', ')}
- If user dislikes an exercise, replace it with a different movement for the same muscle group
- Each exercise must include: name (string), sets (number), reps (string e.g. "8-12"), rest (number, seconds), muscles (string)
- Do not add more than 8 exercises per session

Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:
{"sessions":{"${sessionKeys[0]}":{"name":"...","focus":"...","muscles":"...","exercises":[{"name":"...","sets":3,"reps":"8-12","rest":90,"muscles":"..."}]}},"daySession":${JSON.stringify(currentProgram.daySession)}}`

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = completion.choices[0].message.content.trim()
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const data = JSON.parse(jsonStr)

    // Normalise: if AI returns sessions directly without the wrapper, handle it
    const sessions = data.sessions && typeof data.sessions === 'object'
      ? data.sessions
      : (sessionKeys.every(k => data[k]) ? data : null)

    if (!sessions) {
      console.error('edit-workout bad structure:', JSON.stringify(data).slice(0, 200))
      throw new Error('Invalid response structure')
    }

    const daySession = data.daySession ?? currentProgram.daySession

    return res.status(200).json({ sessions, daySession })
  } catch (err) {
    console.error('edit-workout error:', err)
    return res.status(500).json({ error: 'Failed to edit workout program' })
  }
}
