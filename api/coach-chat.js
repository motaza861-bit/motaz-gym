import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL = 'gemini-2.0-flash'

const VALID_OPERATIONS = new Set([
  'add_exercise', 'remove_exercise', 'update_exercise',
  'add_session', 'rename_session', 'change_day_session',
])

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'modifyWorkout',
        description: "Modify the user's workout program template.",
        parameters: {
          type: 'OBJECT',
          properties: {
            operation: { type: 'STRING' },
            sessionKey: { type: 'STRING' },
            exerciseName: { type: 'STRING' },
            sets: { type: 'NUMBER' },
            reps: { type: 'STRING' },
            newName: { type: 'STRING' },
            weekday: { type: 'NUMBER' },
            newSessionKey: { type: 'STRING' },
            summary: { type: 'STRING' },
          },
          required: ['operation', 'summary'],
        },
      },
      {
        name: 'logFood',
        description: "Log one or more foods into today's nutrition quick log.",
        parameters: {
          type: 'OBJECT',
          properties: {
            items: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING' },
                  emoji: { type: 'STRING' },
                  grams: { type: 'NUMBER' },
                  per100g: {
                    type: 'OBJECT',
                    properties: {
                      calories: { type: 'NUMBER' },
                      protein:  { type: 'NUMBER' },
                      carbs:    { type: 'NUMBER' },
                      fat:      { type: 'NUMBER' },
                    },
                    required: ['calories', 'protein', 'carbs', 'fat'],
                  },
                },
                required: ['name', 'grams', 'per100g'],
              },
            },
            summary: { type: 'STRING' },
          },
          required: ['items', 'summary'],
        },
      },
    ],
  },
]

function buildSystem(context) {
  const program = JSON.stringify(context?.program ?? {})
  const targets = JSON.stringify(context?.targets ?? {})
  const profile = JSON.stringify(context?.profile ?? {})
  return `You are a fitness and nutrition coach embedded in the IronMind app.
You speak in a friendly, concise tone — like a trainer texting a client.
When the user wants to add/remove/change exercises, sessions, or which weekday runs which session,
call the modifyWorkout tool with a single operation.
When the user says they ate or drank something, call the logFood tool.
Otherwise reply with normal text.

Current user state (use this for context, do NOT echo it back):
- Program template: ${program}
- Macro targets: ${targets}
- Profile: ${profile}`
}

function historyToContents(history) {
  return (history ?? []).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content ?? m.proposal?.summary ?? '' }],
  }))
}

function validateModifyWorkout(args) {
  if (!args || !VALID_OPERATIONS.has(args.operation)) return null
  if (!args.summary || typeof args.summary !== 'string') return null
  return args
}

function validateLogFood(args) {
  if (!args || !Array.isArray(args.items) || args.items.length === 0) return null
  for (const it of args.items) {
    if (!it.name || typeof it.grams !== 'number' || !it.per100g) return null
    const p = it.per100g
    if (typeof p.calories !== 'number' || typeof p.protein !== 'number' || typeof p.carbs !== 'number' || typeof p.fat !== 'number') return null
  }
  if (!args.summary) return null
  return args
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { history, message, context } = req.body ?? {}
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Missing message' })
  }

  try {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = client.getGenerativeModel({
      model: MODEL,
      systemInstruction: buildSystem(context),
      tools: TOOLS,
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
    })

    const contents = [
      ...historyToContents(history),
      { role: 'user', parts: [{ text: message.trim() }] },
    ]

    const result = await model.generateContent({ contents })
    const calls = (result.response.functionCalls?.() ?? [])

    if (calls.length > 0) {
      const call = calls[0]
      let params = null
      if (call.name === 'modifyWorkout') params = validateModifyWorkout(call.args)
      else if (call.name === 'logFood')   params = validateLogFood(call.args)

      if (!params) {
        return res.status(200).json({
          reply: {
            role: 'assistant',
            type: 'text',
            content: "I had trouble understanding that — try rephrasing.",
          },
        })
      }

      return res.status(200).json({
        reply: {
          role: 'assistant',
          type: 'tool_proposal',
          proposal: { tool: call.name, params, summary: params.summary },
        },
      })
    }

    const text = result.response.text().trim()
    return res.status(200).json({
      reply: { role: 'assistant', type: 'text', content: text || "I'm not sure what to say." },
    })
  } catch (err) {
    console.error('coach-chat error:', err)
    return res.status(500).json({ error: 'Coach unavailable' })
  }
}
