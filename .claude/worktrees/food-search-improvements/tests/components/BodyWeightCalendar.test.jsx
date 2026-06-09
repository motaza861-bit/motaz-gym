import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BodyWeightCalendar from '../../src/components/BodyWeightCalendar'

const logs = [
  { date: '2026-06-04', weight: 73.4 },
  { date: '2026-06-05', weight: 73.2 },
  { date: '2026-06-07', weight: 72.9 },
]

describe('BodyWeightCalendar', () => {
  it('renders the month/year header for the initial month', () => {
    render(<BodyWeightCalendar logs={logs} initialMonth="2026-06" onSave={() => {}} onDelete={() => {}} />)
    expect(screen.getByText(/june 2026/i)).toBeInTheDocument()
  })

  it('renders weights in cells for logged days', () => {
    render(<BodyWeightCalendar logs={logs} initialMonth="2026-06" onSave={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('73.4')).toBeInTheDocument()
    expect(screen.getByText('73.2')).toBeInTheDocument()
    expect(screen.getByText('72.9')).toBeInTheDocument()
  })

  it('navigates to next and previous months', () => {
    render(<BodyWeightCalendar logs={logs} initialMonth="2026-06" onSave={() => {}} onDelete={() => {}} />)
    fireEvent.click(screen.getByLabelText(/next month/i))
    expect(screen.getByText(/july 2026/i)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/previous month/i))
    fireEvent.click(screen.getByLabelText(/previous month/i))
    expect(screen.getByText(/may 2026/i)).toBeInTheDocument()
  })

  it('opens an editor when a logged day is tapped, pre-filled with that weight', () => {
    render(<BodyWeightCalendar logs={logs} initialMonth="2026-06" onSave={() => {}} onDelete={() => {}} />)
    fireEvent.click(screen.getByText('73.4'))
    const input = screen.getByDisplayValue('73.4')
    expect(input).toBeInTheDocument()
  })

  it('calls onSave with the date and new weight when save is clicked', () => {
    const onSave = vi.fn()
    render(<BodyWeightCalendar logs={logs} initialMonth="2026-06" onSave={onSave} onDelete={() => {}} />)
    fireEvent.click(screen.getByText('73.4'))
    const input = screen.getByDisplayValue('73.4')
    fireEvent.change(input, { target: { value: '73.0' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith('2026-06-04', 73)
  })

  it('calls onDelete with the date when delete is clicked on a logged day editor', () => {
    const onDelete = vi.fn()
    render(<BodyWeightCalendar logs={logs} initialMonth="2026-06" onSave={() => {}} onDelete={onDelete} />)
    fireEvent.click(screen.getByText('73.4'))
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledWith('2026-06-04')
  })
})
