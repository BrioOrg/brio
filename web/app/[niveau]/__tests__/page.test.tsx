import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  getCatalogue: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

const FIXTURE_CATALOGUE = [
  {
    niveauCode: '3e',
    niveauLibelle: 'Troisième',
    matieres: [
      {
        matiereCode: 'mathematiques',
        matiereLibelle: 'Mathématiques',
        chapitres: [],
      },
    ],
  },
]

describe('NiveauPage', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('affiche les matières pour un niveau connu', async () => {
    const { getCatalogue } = await import('@/lib/api')
    vi.mocked(getCatalogue).mockResolvedValue(FIXTURE_CATALOGUE)

    const { default: Page } = await import('../page')
    render(await Page({ params: Promise.resolve({ niveau: '3e' }) }))

    expect(screen.getByRole('heading', { name: 'Choisis une matière' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /mathématiques/i })
    expect(link).toHaveAttribute('href', '/3e/mathematiques')
  })

  it('appelle notFound pour un niveau inexistant', async () => {
    const { getCatalogue } = await import('@/lib/api')
    vi.mocked(getCatalogue).mockResolvedValue(FIXTURE_CATALOGUE)

    const { default: Page } = await import('../page')
    await expect(Page({ params: Promise.resolve({ niveau: '5e' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND'
    )
  })
})
