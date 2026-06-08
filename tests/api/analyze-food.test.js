import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ visionMock: vi.fn() }))

vi.mock('../../api/_gemini.js', () => ({
  generateVisionJSON: mocks.visionMock,
}))

import handler from '../../api/analyze-food.js'

function mockRes() {
  return {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this },
    json(p) { this.payload = p; return this },
  }
}

beforeEach(() => { mocks.visionMock.mockReset() })

describe('analyze-food', () => {
  it('rejects non-POST', async () => {
    const res = mockRes(); await handler({ method: 'GET', body: {} }, res)
    expect(res.statusCode).toBe(405)
  })
  it('rejects missing image', async () => {
    const res = mockRes(); await handler({ method: 'POST', body: {} }, res)
    expect(res.statusCode).toBe(400)
  })
  it('rejects unsupported mimeType', async () => {
    const res = mockRes(); await handler({ method: 'POST', body: { image: 'abc', mimeType: 'image/bmp' } }, res)
    expect(res.statusCode).toBe(400)
  })
  it('returns parsed data on success', async () => {
    mocks.visionMock.mockResolvedValueOnce({ food: 'Apple', portionGrams: 150, calories: 78, protein: 0, carbs: 21, fat: 0 })
    const res = mockRes(); await handler({ method: 'POST', body: { image: 'abc', mimeType: 'image/jpeg' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.food).toBe('Apple')
  })
  it('returns 422 when AI reports error', async () => {
    mocks.visionMock.mockResolvedValueOnce({ error: 'Could not identify food' })
    const res = mockRes(); await handler({ method: 'POST', body: { image: 'abc', mimeType: 'image/jpeg' } }, res)
    expect(res.statusCode).toBe(422)
  })
  it('returns 500 on internal failure', async () => {
    mocks.visionMock.mockRejectedValueOnce(new Error('boom'))
    const res = mockRes(); await handler({ method: 'POST', body: { image: 'abc', mimeType: 'image/jpeg' } }, res)
    expect(res.statusCode).toBe(500)
  })
})
