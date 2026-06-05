import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../src/lib/sync', () => ({
  pushKey: vi.fn().mockResolvedValue(undefined),
  isLoggedIn: vi.fn(() => true),
}))

import { useSyncedStorage } from '../../src/hooks/useSyncedStorage'
import { pushKey } from '../../src/lib/sync'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('useSyncedStorage', () => {
  it('returns default when localStorage is empty', () => {
    const { result } = renderHook(() => useSyncedStorage('foo', { a: 1 }))
    expect(result.current[0]).toEqual({ a: 1 })
  })

  it('reads existing localStorage value', () => {
    localStorage.setItem('foo', JSON.stringify({ a: 2 }))
    const { result } = renderHook(() => useSyncedStorage('foo', { a: 1 }))
    expect(result.current[0]).toEqual({ a: 2 })
  })

  it('writes to localStorage and pushes to sync', () => {
    const { result } = renderHook(() => useSyncedStorage('foo', { a: 1 }))
    act(() => result.current[1]({ a: 3 }))
    expect(JSON.parse(localStorage.getItem('foo'))).toEqual({ a: 3 })
    expect(pushKey).toHaveBeenCalledWith('foo', { a: 3 })
  })

  it('accepts functional updates', () => {
    const { result } = renderHook(() => useSyncedStorage('foo', { n: 1 }))
    act(() => result.current[1](prev => ({ n: prev.n + 1 })))
    expect(result.current[0]).toEqual({ n: 2 })
    expect(pushKey).toHaveBeenCalledWith('foo', { n: 2 })
  })
})
