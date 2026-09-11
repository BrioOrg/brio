import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CommencerPage from '../page'

describe('CommencerPage', () => {
  it('présente les deux portes et les aiguille vers les bons écrans', () => {
    render(<CommencerPage />)

    const codeLink = screen.getByRole('link', { name: /j’ai un code de classe/i })
    expect(codeLink).toHaveAttribute('href', '/rejoindre')

    const inscriptionLink = screen.getByRole('link', { name: /je m’inscris tout seul/i })
    expect(inscriptionLink).toHaveAttribute('href', '/inscription')
  })

  it('propose un retour vers la connexion pour les comptes existants', () => {
    render(<CommencerPage />)
    expect(screen.getByRole('link', { name: /se connecter/i })).toHaveAttribute(
      'href',
      '/connexion'
    )
  })
})
