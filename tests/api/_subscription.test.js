import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const single = vi.fn()
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  const getUser = vi.fn()
  return { single, eq, select, from, getUser }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mocks.from,
    auth: { getUser: mocks.getUser },
  }),
}))

import { getEffectiveSubscription, requireTier, withTierGate } from '../../api/_subscription.js'

function mockRes() {
  return {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this },
    json(p) { this.payload = p; return this },
  }
}

beforeEach(() => {
  mocks.single.mockReset()
  mocks.getUser.mockReset()
})

describe('getEffectiveSubscription', () => {
  it('returns the row for the user', async () => {
    mocks.single.mockResolvedValueOnce({ data: { user_id: 'u1', effective_tier: 'tier2', trial_days_left: 4, status: 'trialing' }, error: null })
    const sub = await getEffectiveSubscription('u1')
    expect(sub.effective_tier).toBe('tier2')
    expect(mocks.from).toHaveBeenCalledWith('effective_subscription')
  })

  it('returns null when no row exists', async () => {
    mocks.single.mockResolvedValueOnce({ data: null, error: { message: 'No rows' } })
    const sub = await getEffectiveSubscription('u-missing')
    expect(sub).toBeNull()
  })
})

describe('requireTier', () => {
  it('throws 401 when no Authorization header', async () => {
    await expect(requireTier({ headers: {} }, ['tier1', 'tier2'])).rejects.toMatchObject({ status: 401 })
  })

  it('throws 401 when token is invalid', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } })
    await expect(requireTier({ headers: { authorization: 'Bearer bad' } }, ['tier1'])).rejects.toMatchObject({ status: 401 })
  })

  it('throws 403 when effective tier is not in allowed', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mocks.single.mockResolvedValueOnce({ data: { user_id: 'u1', effective_tier: 'tier1' }, error: null })
    await expect(requireTier({ headers: { authorization: 'Bearer ok' } }, ['tier2'])).rejects.toMatchObject({ status: 403 })
  })

  it('returns the subscription when allowed', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mocks.single.mockResolvedValueOnce({ data: { user_id: 'u1', effective_tier: 'tier2', trial_days_left: 4, status: 'trialing' }, error: null })
    const sub = await requireTier({ headers: { authorization: 'Bearer ok' } }, ['tier2'])
    expect(sub.effective_tier).toBe('tier2')
    expect(sub.userId).toBe('u1')
  })
})

describe('withTierGate', () => {
  it('calls the inner handler when allowed', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mocks.single.mockResolvedValueOnce({ data: { user_id: 'u1', effective_tier: 'tier1' }, error: null })
    const inner = vi.fn((_req, res) => res.status(200).json({ ok: true }))
    const handler = withTierGate(['tier1', 'tier2'], inner)
    const res = mockRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer ok' } }, res)
    expect(inner).toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
  })

  it('responds 403 when blocked', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mocks.single.mockResolvedValueOnce({ data: { user_id: 'u1', effective_tier: 'none' }, error: null })
    const inner = vi.fn()
    const handler = withTierGate(['tier1'], inner)
    const res = mockRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer ok' } }, res)
    expect(inner).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
  })
})
