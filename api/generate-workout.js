import Anthropic from '@anthropic-ai/sdk'

const EQUIPMENT_GUIDE = {
  full: 'barbells, cables, machines, dumbbells — full commercial gym',
  home: 'dumbbells, pull-up bar, resistance bands — home gym',
  bodyweight: 'bodyweight only — no equipment',
}

const GOAL_GUIDE = {
  cut: 'higher reps (12-15), shorter rest (45-60s), supersets, fat-loss focus',
  bulk: 'heavy compounds (5-8 reps), longer rest (90-180s), strength focus',
  recomp: 'balanced reps (8-12), standard rest (60-90s), hypertrophy focus',
}

const EXP_GUIDE = {
  beginner: 'simple compound movements, 3 sets, moderate volume, no advanced techniques',
  intermediate: 'progressive overload, 3-4 sets, compound and isolation mix',
  advanced: '4-5 sets, higher intensity, include advanced techniques where appropriate',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { goal, experience, daysPerWeek, equipment, weight, age } = req.body

  if (!goal || !experience || !daysPerWeek || !equipment) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are an expert strength and conditioning coach. Create a personalised workout program.

User profile:
- Goal: ${goal} — ${GOAL_GUIDE[goal] ?? ''}
- Experience: ${experience} — ${EXP_GUIDE[experience] ?? ''}
- Training days per week: ${daysPerWeek}
- Equipment: ${equipment} — ${EQUIPMENT_GUIDE[equipment] ?? ''}
- Age: ${age ?? 'unknown'}, Weight: ${weight ?? 'unknown'}kg

Create exactly ${daysPerWeek} distinct sessions labeled A, B, C, etc. Distribute them across Mon–Sun (key 1=Mon … 6=Sat, 0=Sun); remaining days are "rest".

Return ONLY this JSON (no markdown fences, no explanation):
{
  "sessions": {
    "A": {
      "name": "string",
      "focus": "string",
      "muscles": "string",
      "exercises": [
        { "name": "string", "sets": 3, "reps": "8-10", "rest": 90, "muscles": "string" }
      ]
    }
  },
  "daySession": { "0": "rest", "1": "A", "2": "B", "3": "rest", "4": "A", "5": "B", "6": "rest" }
}

Rules: 5-8 exercises per session. Cover all major muscle groups. rest is in seconds (60-180).`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].text.trim()
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const data = JSON.parse(jsonStr)

    if (!data.sessions || !data.daySession) {
      throw new Error('Invalid response structure')
    }

    return res.status(200).json(data)
  } catch (err) {
    console.error('generate-workout error:', err.message)
    return res.status(500).json({ error: 'Failed to generate workout program' })
  }
}
