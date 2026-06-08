import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const createMock = vi.fn()
  return { createMock }
})

vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: mocks.createMock } }
  },
}))

import handler from '../../api/estimate-food.js'

function mockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this },
  }
}

beforeEach(() => {
  mocks.createMock.mockReset()
})

describe('estimate-food', () => {
  it('rejects non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', body: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects empty query', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: { query: '   ' } }, res)
    expect(res.statusCode).toBe(400)
  })

  it('returns parsed estimate on success', async () => {
    mocks.createMock.mockResolvedValueOnce({
      choices: [{
        message: {
          content: '{"name":"Almarai Labneh Full Fat","emoji":"🥛","per100g":{"calories":95,"protein":5,"carbs":4,"fat":7},"defaultPortion":100}',
        },
      }],
    })
    const res = mockRes()
    await handler({ method: 'POST', body: { query: 'Almarai labneh full fat' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.name).toBe('Almarai Labneh Full Fat')
    expect(res.payload.per100g.calories).toBe(95)
    expect(res.payload._source).toBe('ai')
    expect(res.payload._aiEstimate).toBe(true)
  })

  it('strips ```json fences before parsing', async () => {
    mocks.createMock.mockResolvedValueOnce({
      choices: [{
        message: {
          content: '```json\n{"name":"Egg","emoji":"🥚","per100g":{"calories":143,"protein":13,"carbs":1,"fat":10},"defaultPortion":50}\n```',
        },
      }],
    })
    const res = mockRes()
    await handler({ method: 'POST', body: { query: 'egg' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.name).toBe('Egg')
  })

  it('returns 422 when JSON parse fails', async () => {
    mocks.createMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'not json at all' } }],
    })
    const res = mockRes()
    await handler({ method: 'POST', body: { query: 'qwerty' } }, res)
    expect(res.statusCode).toBe(422)
  })

  it('returns 422 when the AI itself reports an error', async () => {
    mocks.createMock.mockResolvedValueOnce({
      choices: [{ message: { content: '{"error":"Could not estimate"}' } }],
    })
    const res = mockRes()
    await handler({ method: 'POST', body: { query: 'xyzunknown' } }, res)
    expect(res.statusCode).toBe(422)
  })

  it('returns 500 when Groq throws', async () => {
    mocks.createMock.mockRejectedValueOnce(new Error('boom'))
    const res = mockRes()
    await handler({ method: 'POST', body: { query: 'rice' } }, res)
    expect(res.statusCode).toBe(500)
  })
})
