import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ jsonMock: vi.fn() }))
vi.mock('../../api/_gemini.js', () => ({ generateJSON: mocks.jsonMock }))

import handler from '../../api/estimate-food.js'

function mockRes() {
  return {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this },
    json(p) { this.payload = p; return this },
  }
}

beforeEach(() => { mocks.jsonMock.mockReset() })

describe('estimate-food', () => {
  it('rejects non-POST', async () => {
    const res = mockRes(); await handler({ method: 'GET', body: {} }, res)
    expect(res.statusCode).toBe(405)
  })
  it('rejects empty query', async () => {
    const res = mockRes(); await handler({ method: 'POST', body: { query: '   ' } }, res)
    expect(res.statusCode).toBe(400)
  })
  it('returns parsed estimate on success', async () => {
    mocks.jsonMock.mockResolvedValueOnce({
      name: 'Almarai Labneh Full Fat',
      emoji: '🥛',
      per100g: { calories: 95, protein: 5, carbs: 4, fat: 7 },
      defaultPortion: 100,
    })
    const res = mockRes(); await handler({ method: 'POST', body: { query: 'Almarai labneh full fat' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.name).toBe('Almarai Labneh Full Fat')
    expect(res.payload._source).toBe('ai')
    expect(res.payload._aiEstimate).toBe(true)
  })
  it('returns 422 when AI reports error', async () => {
    mocks.jsonMock.mockResolvedValueOnce({ error: 'Could not estimate' })
    const res = mockRes(); await handler({ method: 'POST', body: { query: 'xyz' } }, res)
    expect(res.statusCode).toBe(422)
  })
  it('returns 422 when JSON parse fails (SyntaxError)', async () => {
    mocks.jsonMock.mockRejectedValueOnce(new SyntaxError('bad json'))
    const res = mockRes(); await handler({ method: 'POST', body: { query: 'qwerty' } }, res)
    expect(res.statusCode).toBe(422)
  })
  it('returns 422 on invalid shape', async () => {
    mocks.jsonMock.mockResolvedValueOnce({ name: 'X' /* missing per100g */ })
    const res = mockRes(); await handler({ method: 'POST', body: { query: 'x' } }, res)
    expect(res.statusCode).toBe(422)
  })
  it('returns 500 on other failures', async () => {
    mocks.jsonMock.mockRejectedValueOnce(new Error('boom'))
    const res = mockRes(); await handler({ method: 'POST', body: { query: 'rice' } }, res)
    expect(res.statusCode).toBe(500)
  })
})
