import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ generateMock: vi.fn() }))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mocks.generateMock }
    }
  },
}))

import handler from '../../api/coach-chat.js'

function mockRes() {
  return {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this },
    json(p) { this.payload = p; return this },
  }
}

beforeEach(() => { mocks.generateMock.mockReset() })

describe('coach-chat', () => {
  it('rejects non-POST', async () => {
    const res = mockRes(); await handler({ method: 'GET', body: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects empty message', async () => {
    const res = mockRes(); await handler({ method: 'POST', body: { message: '   ', history: [], context: {} } }, res)
    expect(res.statusCode).toBe(400)
  })

  it('returns text reply when model returns text', async () => {
    mocks.generateMock.mockResolvedValueOnce({
      response: {
        text: () => 'Eat more protein.',
        functionCalls: () => [],
      },
    })
    const res = mockRes(); await handler({ method: 'POST', body: { message: 'tips?', history: [], context: {} } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.reply.type).toBe('text')
    expect(res.payload.reply.content).toBe('Eat more protein.')
  })

  it('returns a tool proposal when model calls modifyWorkout', async () => {
    mocks.generateMock.mockResolvedValueOnce({
      response: {
        text: () => '',
        functionCalls: () => [{
          name: 'modifyWorkout',
          args: { operation: 'add_exercise', sessionKey: 'A', exerciseName: 'Bench Press', sets: 3, reps: '8-10', summary: 'Add 3x8-10 bench press to session A' },
        }],
      },
    })
    const res = mockRes(); await handler({ method: 'POST', body: { message: 'add bench press', history: [], context: {} } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.reply.type).toBe('tool_proposal')
    expect(res.payload.reply.proposal.tool).toBe('modifyWorkout')
    expect(res.payload.reply.proposal.params.exerciseName).toBe('Bench Press')
  })

  it('returns a tool proposal when model calls logFood', async () => {
    mocks.generateMock.mockResolvedValueOnce({
      response: {
        text: () => '',
        functionCalls: () => [{
          name: 'logFood',
          args: {
            items: [{ name: 'Egg', emoji: '🥚', grams: 50, per100g: { calories: 143, protein: 13, carbs: 1, fat: 10 } }],
            summary: 'Log 50g egg',
          },
        }],
      },
    })
    const res = mockRes(); await handler({ method: 'POST', body: { message: 'I ate an egg', history: [], context: {} } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.reply.type).toBe('tool_proposal')
    expect(res.payload.reply.proposal.tool).toBe('logFood')
    expect(res.payload.reply.proposal.params.items).toHaveLength(1)
  })

  it('returns a text "try rephrasing" fallback when tool call is malformed', async () => {
    mocks.generateMock.mockResolvedValueOnce({
      response: {
        text: () => '',
        functionCalls: () => [{ name: 'modifyWorkout', args: { operation: 'invalid' } }],
      },
    })
    const res = mockRes(); await handler({ method: 'POST', body: { message: 'do something', history: [], context: {} } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.reply.type).toBe('text')
    expect(res.payload.reply.content).toMatch(/rephrasing/i)
  })

  it('returns 500 when the model errors', async () => {
    mocks.generateMock.mockRejectedValueOnce(new Error('boom'))
    const res = mockRes(); await handler({ method: 'POST', body: { message: 'hi', history: [], context: {} } }, res)
    expect(res.statusCode).toBe(500)
  })
})
