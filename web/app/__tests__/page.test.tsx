import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

describe('HomePage', () => {
  it('affiche le titre et le lien vers le chapitre Pythagore', async () => {
    const { default: Page } = await import('../page')
    render(Page())

    expect(screen.getByRole('heading', { name: 'brio' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /pythagore/i })
    expect(link).toHaveAttribute('href', '/chapitres/theoreme-de-pythagore')
  })
})
