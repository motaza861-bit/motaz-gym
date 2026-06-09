import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

vi.mock('../../api/_subscription.js', () => ({
  withTierGate: (_allowed, fn) => fn,
  requireTier: vi.fn(),
  getEffectiveSubscription: vi.fn(),
}))

import handler from '../../api/lookup-barcode.js'

function mockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this },
  }
}

beforeEach(() => { vi.restoreAllMocks() })
afterEach(() => { vi.restoreAllMocks() })

describe('lookup-barcode', () => {
  it('rejects non-POST', async () => {
    const res = mockRes()
    await handler({ method: 'GET', body: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects missing barcode', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: {} }, res)
    expect(res.statusCode).toBe(400)
  })

  it('rejects malformed barcode', async () => {
    const res = mockRes()
    await handler({ method: 'POST', body: { barcode: 'abc' } }, res)
    expect(res.statusCode).toBe(400)
  })

  it('returns { found: true, food } when OFF has the product', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          product_name: 'Coca-Cola Classic',
          brands: 'Coca-Cola',
          nutriments: {
            'energy-kcal_100g': 42,
            proteins_100g: 0,
            carbohydrates_100g: 11,
            fat_100g: 0,
          },
        },
      }),
    }))
    const res = mockRes()
    await handler({ method: 'POST', body: { barcode: '5449000000996' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload.found).toBe(true)
    expect(res.payload.food.name).toBe('Coca-Cola Classic')
    expect(res.payload.food.brand).toBe('Coca-Cola')
    expect(res.payload.food.per100g).toEqual({ calories: 42, protein: 0, carbs: 11, fat: 0 })
  })

  it('returns { found: false } when OFF returns status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 0 }),
    }))
    const res = mockRes()
    await handler({ method: 'POST', body: { barcode: '1234567890123' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ found: false })
  })

  it('returns { found: false } when OFF fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const res = mockRes()
    await handler({ method: 'POST', body: { barcode: '1234567890123' } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ found: false })
  })
})
