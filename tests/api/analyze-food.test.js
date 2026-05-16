import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('groq-sdk', () => ({
  default: class {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: '{"food":"Grilled chicken breast","calories":165,"protein":31,"carbs":0,"fat":4}'
            }
          }]
        })
      }
    }
  }
}))

const mockRes = () => {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('analyze-food handler', () => {
  let handler

  beforeEach(async () => {
    vi.resetModules()
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

  it('returns food data on success', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: { image: 'base64data', mimeType: 'image/jpeg' } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload).toHaveProperty('food')
    expect(payload).toHaveProperty('calories')
    expect(payload).toHaveProperty('protein')
    expect(payload).toHaveProperty('carbs')
    expect(payload).toHaveProperty('fat')
  })
})
