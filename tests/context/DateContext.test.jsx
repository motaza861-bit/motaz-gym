import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { DateProvider, useSelectedDate } from '../../src/context/DateContext'

const wrapper = ({ children }) => <DateProvider>{children}</DateProvider>

describe('DateContext', () => {
  it('initialises to today', () => {
    const { result } = renderHook(() => useSelectedDate(), { wrapper })
    const today = new Date()
    expect(result.current.selectedDate.toDateString()).toBe(today.toDateString())
  })

  it('resets to today when visibilitychange fires on a new day', () => {
    const { result } = renderHook(() => useSelectedDate(), { wrapper })

    // Simulate user navigating to yesterday
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    act(() => result.current.setSelectedDate(yesterday))
    expect(result.current.selectedDate.toDateString()).toBe(yesterday.toDateString())

    // Simulate app coming to foreground
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    // Should reset to today because yesterday !== today
    expect(result.current.selectedDate.toDateString()).toBe(new Date().toDateString())
  })
})
