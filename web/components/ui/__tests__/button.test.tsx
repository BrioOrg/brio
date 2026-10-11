import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../button'

describe('Button', () => {
  it('renders label text', () => {
    render(<Button>Valider</Button>)
    expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument()
  })

  it('is disabled when disabled prop is set', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Valider
      </Button>
    )
    const btn = screen.getByRole('button', { name: 'Valider' })
    expect(btn).toBeDisabled()
    await userEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('loading: sets aria-busy, disables pointer events, keeps label in DOM', () => {
    render(<Button loading>Valider</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn).toBeDisabled()
    // Label text still in DOM (hidden via invisible class, but accessible)
    expect(btn).toHaveTextContent('Valider')
  })

  it('loading: does not fire onClick', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Valider
      </Button>
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('idle: no aria-busy attribute', () => {
    render(<Button>Valider</Button>)
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy')
  })

  // MOTION.md budget rule 2: the face drops onto a fixed edge; no box-shadow to animate.
  it('stands an enabled primary button on an edge, under its face', () => {
    render(<Button>Valider</Button>)
    const btn = screen.getByRole('button')
    expect(btn.querySelector('[data-bouton-bord]')).not.toBeNull()
    expect(btn.querySelector('[data-bouton-face]')).toHaveTextContent('Valider')
  })

  it('gives no edge to a disabled, loading or flat button', () => {
    render(
      <>
        <Button disabled>A</Button>
        <Button loading>B</Button>
        <Button variant="secondary">C</Button>
        <Button variant="ghost">D</Button>
      </>
    )
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.querySelector('[data-bouton-bord]')).toBeNull()
      expect(btn.querySelector('[data-bouton-face]')).not.toBeNull()
    }
  })
})
