import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: mockCreate } }
  }
}))

const mockRes = () => {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

const SUCCESS_RESPONSE = {
  choices: [{
    message: {
      content: '{"food":"Potato chips","portionGrams":30,"calories":160,"protein":2,"carbs":15,"fat":10}'
    }
  }]
}

describe('analyze-food handler', () => {
  let handler

  beforeEach(async () => {
    vi.resetModules()
    mockCreate.mockResolvedValue(SUCCESS_RESPONSE)
    const mod = await import('../../api/analyze-food.js')
    handler = mod.default
  })

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 400 if no image provided', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns portionGrams in success payload', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: { image: 'base64data', mimeType: 'image/jpeg' } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload).toHaveProperty('food')
    expect(payload).toHaveProperty('portionGrams')
    expect(payload).toHaveProperty('calories')
    expect(payload).toHaveProperty('protein')
    expect(payload).toHaveProperty('carbs')
    expect(payload).toHaveProperty('fat')
    expect(typeof payload.portionGrams).toBe('number')
  })

  it('uses llama-4-scout model', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: { image: 'base64data', mimeType: 'image/jpeg' } }, res)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'meta-llama/llama-4-scout-17b-16e-instruct' })
    )
  })
})
