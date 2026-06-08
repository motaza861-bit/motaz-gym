// api/_gemini.js
import { GoogleGenerativeAI } from '@google/generative-ai'

let client = null
export function getGemini() {
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return client
}

export async function generateJSON({ model, system, user, schema, maxOutputTokens = 256 }) {
  const m = getGemini().getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: {
      responseMimeType: 'application/json',
      ...(schema ? { responseSchema: schema } : {}),
      maxOutputTokens,
      temperature: 0,
    },
  })
  const result = await m.generateContent(user)
  const text = result.response.text().trim()
  const stripped = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(stripped)
}

export async function generateText({ model, system, user, maxOutputTokens = 128 }) {
  const m = getGemini().getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: { maxOutputTokens, temperature: 0 },
  })
  const result = await m.generateContent(user)
  return result.response.text().trim()
}

export async function generateVisionJSON({ model, system, imageBase64, mimeType, user, maxOutputTokens = 256 }) {
  const m = getGemini().getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens,
      temperature: 0,
    },
  })
  const result = await m.generateContent([
    { inlineData: { data: imageBase64, mimeType } },
    { text: user },
  ])
  const text = result.response.text().trim()
  const stripped = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(stripped)
}
