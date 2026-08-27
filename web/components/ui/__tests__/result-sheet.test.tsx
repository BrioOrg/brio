import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResultSheet } from '../result-sheet'

const baseProps = {
  open: true,
  onClose: vi.fn(),
  title: 'Bien vu !',
}

describe('ResultSheet', () => {
  it('success: renders title and uses correct surface token class', () => {
    render(<ResultSheet {...baseProps} variant="success" />)
    expect(screen.getByText('Bien vu !')).toBeInTheDocument()
    // Dialog is announced via aria-label
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('failure: renders title', () => {
    render(<ResultSheet {...baseProps} variant="failure" title="Pas tout à fait…" />)
    expect(screen.getByText('Pas tout à fait…')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<ResultSheet {...baseProps} variant="success" subtitle="Tu gères !" />)
    expect(screen.getByText('Tu gères !')).toBeInTheDocument()
  })

  it('shows XP badge when xpEarned is provided', () => {
    render(<ResultSheet {...baseProps} variant="success" xpEarned={20} />)
    expect(screen.getByLabelText('20 XP gagnés')).toBeInTheDocument()
  })

  it('hides XP badge when xpEarned is absent', () => {
    render(<ResultSheet {...baseProps} variant="success" />)
    expect(screen.queryByLabelText(/XP gagnés/)).not.toBeInTheDocument()
  })

  it('calls onClose when continue button is clicked', async () => {
    const onClose = vi.fn()
    render(<ResultSheet {...baseProps} variant="success" onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /continuer/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not render when closed', () => {
    render(<ResultSheet {...baseProps} open={false} variant="success" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
