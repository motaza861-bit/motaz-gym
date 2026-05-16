import Groq from 'groq-sdk'

const MODEL = 'llama-3.3-70b-versatile'

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

const SPLIT_GUIDE = {
  fullbody: {
    name: 'Full Body',
    structure: `Create 3 distinct full-body sessions (A, B, C). Each session must train ALL major muscle groups.
Schedule starting Sunday: 0=A, 1=rest, 2=B, 3=rest, 4=C, 5=rest, 6=rest.
Each session: start with a lower-body compound (squat or hinge), then an upper push compound, then an upper pull compound, then isolations. Rotate exercises across sessions so A, B, C each feel different.`,
    daySession: { '0': 'A', '1': 'rest', '2': 'B', '3': 'rest', '4': 'C', '5': 'rest', '6': 'rest' },
  },
  upperlower: {
    name: 'Upper / Lower',
    structure: `Create 2 sessions: A (Upper Body) and B (Lower Body), each done twice per week.
Schedule starting Sunday: 0=A, 1=B, 2=rest, 3=A, 4=B, 5=rest, 6=rest.
Upper (A): Chest, Back, Shoulders, Biceps, Triceps — compound movements first, isolations after.
Lower (B): Quads, Hamstrings, Glutes, Calves — squat or deadlift pattern first, isolations after.`,
    daySession: { '0': 'A', '1': 'B', '2': 'rest', '3': 'A', '4': 'B', '5': 'rest', '6': 'rest' },
  },
  ppl: {
    name: 'Push / Pull / Legs',
    structure: `Create 3 sessions: A (Push), B (Pull), C (Legs), each done twice per week.
Schedule starting Sunday: 0=A, 1=B, 2=C, 3=A, 4=B, 5=C, 6=rest.
Push (A): Chest compound first, then shoulder compound, then tricep isolations.
Pull (B): Vertical pull first (pull-up or lat pulldown), then horizontal row, then bicep isolations and rear delts.
Legs (C): Quad-dominant compound first (squat), then hip-hinge (RDL), then leg isolations and calves.`,
    daySession: { '0': 'A', '1': 'B', '2': 'C', '3': 'A', '4': 'B', '5': 'C', '6': 'rest' },
  },
  arnold: {
    name: 'Arnold Split',
    structure: `Arnold Schwarzenegger's classic split. Create 3 sessions: A (Chest + Back), B (Shoulders + Arms), C (Legs), each done twice per week.
Schedule starting Sunday: 0=A, 1=B, 2=C, 3=A, 4=B, 5=C, 6=rest.
Session A (Chest + Back): Train opposing muscle groups together for maximum pump. Include bench press, rows, flyes, pull-ups/pulldowns. Superset chest and back exercises where possible.
Session B (Shoulders + Arms): Overhead press, lateral raises, front raises, barbell curls, skull crushers, concentration curls, tricep pushdowns.
Session C (Legs): Squats, leg press, hamstring curls, leg extensions, calf raises, abs.`,
    daySession: { '0': 'A', '1': 'B', '2': 'C', '3': 'A', '4': 'B', '5': 'C', '6': 'rest' },
  },
  bro: {
    name: 'Bro Split',
    structure: `Create 5 distinct sessions: A (Chest), B (Back), C (Shoulders), D (Arms), E (Legs). Maximum volume per muscle group.
Schedule starting Sunday: 0=A, 1=B, 2=C, 3=D, 4=E, 5=rest, 6=rest.
Chest (A): 5-7 exercises — bench press variations, incline, dips, flyes, cable crossovers.
Back (B): 5-7 exercises — deadlift or rack pull, rows (barbell + cable), pull-ups, lat pulldowns. Cover width and thickness.
Shoulders (C): 5-6 exercises — overhead press, lateral raises, front raises, rear delt flyes, shrugs.
Arms (D): 5-6 exercises — barbell curls, hammer curls, preacher curls, skull crushers, pushdowns, overhead tricep extension.
Legs (E): 5-7 exercises — squats, leg press, Romanian deadlift, leg curls, leg extensions, calf raises.`,
    daySession: { '0': 'A', '1': 'B', '2': 'C', '3': 'D', '4': 'E', '5': 'rest', '6': 'rest' },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { goal, experience, split = 'ppl', equipment, weight, age } = req.body

  if (!goal || !experience || !equipment) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const splitGuide = SPLIT_GUIDE[split] ?? SPLIT_GUIDE.ppl

  const prompt = `You are an expert strength and conditioning coach. Create a personalised ${splitGuide.name} workout program.

User profile:
- Goal: ${goal} — ${GOAL_GUIDE[goal] ?? ''}
- Experience: ${experience} — ${EXP_GUIDE[experience] ?? ''}
- Equipment: ${equipment} — ${EQUIPMENT_GUIDE[equipment] ?? ''}
- Age: ${age ?? 'unknown'}, Weight: ${weight ?? 'unknown'}kg

Training split — follow this EXACTLY:
${splitGuide.structure}

Week key: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday.

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
  "daySession": ${JSON.stringify(splitGuide.daySession)}
}

Rules:
- Use EXACTLY the daySession shown above — do not change it
- Follow the split structure exactly — sessions must contain only the muscles specified
- ${EXP_GUIDE[experience] ?? ''}
- 5-8 exercises per session
- rest is in seconds (60-180)`

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = completion.choices[0].message.content.trim()
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const data = JSON.parse(jsonStr)

    if (!data.sessions || !data.daySession) {
      throw new Error('Invalid response structure')
    }

    // Enforce the correct daySession regardless of what the AI returned
    data.daySession = splitGuide.daySession

    return res.status(200).json(data)
  } catch (err) {
    console.error('generate-workout error:', err)
    return res.status(500).json({ error: 'Failed to generate workout program' })
  }
}
