import { render, screen } from '@testing-library/react'
import MacroBar from '../../src/components/MacroBar'

describe('MacroBar', () => {
  it('renders label and values', () => {
    render(<MacroBar label="Protein" value={165} target={220} color="red" unit="g" />)
    expect(screen.getByText('Protein')).toBeInTheDocument()
    expect(screen.getByText(/165g/)).toBeInTheDocument()
  })

  it('caps fill at 100%', () => {
    render(<MacroBar label="Fat" value={300} target={70} color="yellow" unit="g" />)
    const fill = document.querySelector('.macro-bar-fill')
    expect(fill.style.width).toBe('100%')
  })

  it('shows correct partial fill width', () => {
    render(<MacroBar label="Carbs" value={110} target={220} color="orange" unit="g" />)
    const fill = document.querySelector('.macro-bar-fill')
    expect(fill.style.width).toBe('50%')
  })
})
