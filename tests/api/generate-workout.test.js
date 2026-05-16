import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateContent = vi.fn().mockResolvedValue({
  response: {
    text: () => JSON.stringify({
      sessions: {
        A: { name: 'Full Body A', focus: 'Push', muscles: 'Chest', exercises: [{ name: 'Bench Press', sets: 3, reps: '8-10', rest: 90, muscles: 'Chest' }] }
      },
      daySession: { '0': 'rest', '1': 'A', '2': 'rest', '3': 'A', '4': 'rest', '5': 'A', '6': 'rest' }
    })
  }
})

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() { return { generateContent: mockGenerateContent } }
  }
}))

const mockRes = () => {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('generate-workout handler', () => {
  let handler

  beforeEach(async () => {
    mockGenerateContent.mockClear()
    const mod = await import('../../api/generate-workout.js')
    handler = mod.default
  })

  it('returns 405 for non-POST requests', async () => {
    const res = mockRes()
    await handler({ method: 'GET', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 400 if required fields missing', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns sessions and daySession on success', async () => {
    const res = mockRes()
    await handler({
      method: 'POST',
      body: { goal: 'bulk', experience: 'intermediate', daysPerWeek: 3, equipment: 'full', weight: 80, age: 25 }
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload).toHaveProperty('sessions')
    expect(payload).toHaveProperty('daySession')
  })
})
