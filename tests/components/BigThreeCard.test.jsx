import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BigThreeCard from '../../src/components/BigThreeCard'

beforeEach(() => { vi.clearAllMocks() })

describe('BigThreeCard', () => {
  it('renders the lift title', () => {
    render(<BigThreeCard lift="squat" title="Squat" entries={[]} onAdd={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('Squat')).toBeInTheDocument()
  })

  it('shows the empty state when there are no entries for this lift', () => {
    render(<BigThreeCard lift="squat" title="Squat" entries={[]} onAdd={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/no entries yet/i)).toBeInTheDocument()
  })

  it('shows latest entry summary when entries exist', () => {
    const entries = [
      { id: 'a', lift: 'squat', date: '2026-06-04', weight: 120, reps: 5 },
      { id: 'b', lift: 'squat', date: '2026-06-01', weight: 115, reps: 5 },
    ]
    render(<BigThreeCard lift="squat" title="Squat" entries={entries} onAdd={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/120 kg × 5/i)).toBeInTheDocument()
    expect(screen.getByText(/2026-06-04/)).toBeInTheDocument()
  })

  it('only renders entries matching its lift', () => {
    const entries = [
      { id: 'a', lift: 'squat', date: '2026-06-04', weight: 120, reps: 5 },
      { id: 'b', lift: 'bench', date: '2026-06-04', weight: 80, reps: 5 },
    ]
    render(<BigThreeCard lift="squat" title="Squat" entries={entries} onAdd={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/120 kg × 5/i)).toBeInTheDocument()
    expect(screen.queryByText(/80 kg × 5/i)).not.toBeInTheDocument()
  })

  it('calls onAdd with a new entry when the add form is submitted', () => {
    const onAdd = vi.fn()
    render(<BigThreeCard lift="bench" title="Bench" entries={[]} onAdd={onAdd} onDelete={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    fireEvent.change(screen.getByPlaceholderText(/weight/i), { target: { value: '100' } })
    fireEvent.change(screen.getByPlaceholderText(/reps/i), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onAdd).toHaveBeenCalledTimes(1)
    const arg = onAdd.mock.calls[0][0]
    expect(arg.lift).toBe('bench')
    expect(arg.weight).toBe(100)
    expect(arg.reps).toBe(5)
    expect(arg.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('calls onDelete with entry id when delete is clicked', () => {
    const onDelete = vi.fn()
    const entries = [{ id: 'a', lift: 'squat', date: '2026-06-04', weight: 120, reps: 5 }]
    render(<BigThreeCard lift="squat" title="Squat" entries={entries} onAdd={() => {}} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledWith('a')
  })
})
