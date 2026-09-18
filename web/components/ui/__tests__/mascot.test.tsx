import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Mascot } from '../mascot'

describe('Mascot', () => {
  it('expose un nom accessible quand un label est fourni', () => {
    render(<Mascot label="Brio, la mascotte" />)
    expect(screen.getByRole('img', { name: /brio, la mascotte/i })).toBeInTheDocument()
  })

  it('est décorative (cachée aux lecteurs d’écran) sans label', () => {
    const { container } = render(<Mascot />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('garde le ratio 128×108 selon la taille', () => {
    const { container } = render(<Mascot size={128} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '128')
    expect(svg).toHaveAttribute('height', '108')
  })

  it('ajoute le sourire en état happy', () => {
    const { container: calm } = render(<Mascot mood="calm" />)
    const { container: happy } = render(<Mascot mood="happy" />)
    // The smile adds one extra <path> to the calm baseline.
    expect(happy.querySelectorAll('path').length).toBe(calm.querySelectorAll('path').length + 1)
  })
})
