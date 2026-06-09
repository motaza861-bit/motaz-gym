import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const upsertMock = vi.fn().mockResolvedValue({ error: null })
  const selectMock = vi.fn().mockResolvedValue({ data: [], error: null })
  const fromMock = vi.fn(() => ({ upsert: upsertMock, select: selectMock }))
  return { upsertMock, selectMock, fromMock }
})

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: mocks.fromMock,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  },
}))

import { pushKey, flushQueue, queueSize } from '../../src/lib/sync'

beforeEach(() => {
  localStorage.clear()
  mocks.upsertMock.mockClear()
  mocks.upsertMock.mockResolvedValue({ error: null })
  mocks.fromMock.mockClear()
})

describe('pushKey', () => {
  it('upserts to supabase when successful', async () => {
    await pushKey('workout_logs', [{ a: 1 }])
    expect(mocks.fromMock).toHaveBeenCalledWith('user_data')
    expect(mocks.upsertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      key: 'workout_logs',
      value: [{ a: 1 }],
    }, { onConflict: 'user_id,key' })
  })

  it('queues mutation when upsert fails', async () => {
    mocks.upsertMock.mockResolvedValueOnce({ error: { message: 'offline' } })
    await pushKey('targets', { p: 180 })
    expect(queueSize()).toBe(1)
  })
})

describe('flushQueue', () => {
  it('flushes queued mutations on success', async () => {
    mocks.upsertMock.mockResolvedValueOnce({ error: { message: 'offline' } })
    await pushKey('targets', { p: 1 })
    expect(queueSize()).toBe(1)

    mocks.upsertMock.mockResolvedValue({ error: null })
    await flushQueue()
    expect(queueSize()).toBe(0)
  })

  it('keeps items in queue when flush fails', async () => {
    mocks.upsertMock.mockResolvedValueOnce({ error: { message: 'offline' } })
    await pushKey('targets', { p: 1 })

    mocks.upsertMock.mockResolvedValueOnce({ error: { message: 'still offline' } })
    await flushQueue()
    expect(queueSize()).toBe(1)
  })
})
