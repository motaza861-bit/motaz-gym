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
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  },
}))

import { findLocalLegacyKeys, migrateLegacyToCloud, discardLegacy } from '../../src/lib/sync'

beforeEach(() => {
  localStorage.clear()
  mocks.upsertMock.mockClear()
  mocks.upsertMock.mockResolvedValue({ error: null })
})

describe('findLocalLegacyKeys', () => {
  it('returns motaz_-prefixed keys present in localStorage', () => {
    localStorage.setItem('motaz_workout_logs', '[]')
    localStorage.setItem('motaz_profile', '{}')
    localStorage.setItem('other', 'x')
    expect(findLocalLegacyKeys().sort()).toEqual(['motaz_profile', 'motaz_workout_logs'])
  })

  it('returns [] when no legacy keys', () => {
    expect(findLocalLegacyKeys()).toEqual([])
  })
})

describe('migrateLegacyToCloud', () => {
  it('upserts each legacy key without the prefix and deletes the legacy key', async () => {
    localStorage.setItem('motaz_workout_logs', JSON.stringify([{ x: 1 }]))
    localStorage.setItem('motaz_targets', JSON.stringify({ p: 180 }))

    await migrateLegacyToCloud()

    expect(mocks.upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'workout_logs', value: [{ x: 1 }] }),
      expect.any(Object)
    )
    expect(mocks.upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'targets', value: { p: 180 } }),
      expect.any(Object)
    )
    expect(localStorage.getItem('motaz_workout_logs')).toBeNull()
    expect(localStorage.getItem('motaz_targets')).toBeNull()
    expect(JSON.parse(localStorage.getItem('workout_logs'))).toEqual([{ x: 1 }])
  })
})

describe('discardLegacy', () => {
  it('removes motaz_ keys without uploading', () => {
    localStorage.setItem('motaz_workout_logs', '[]')
    discardLegacy()
    expect(localStorage.getItem('motaz_workout_logs')).toBeNull()
    expect(mocks.upsertMock).not.toHaveBeenCalled()
  })
})
