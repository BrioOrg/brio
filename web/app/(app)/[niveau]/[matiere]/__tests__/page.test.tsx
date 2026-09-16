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
        chapitres: [
          {
            slug: 'theoreme-de-pythagore',
            titre: 'Le théorème de Pythagore',
            dureeEstimeeMinutes: 55,
            ordre: 0,
          },
        ],
      },
    ],
  },
]

describe('MatierePage', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('affiche les chapitres pour une matière connue', async () => {
    const { getCatalogue } = await import('@/lib/api')
    vi.mocked(getCatalogue).mockResolvedValue(FIXTURE_CATALOGUE)

    const { default: Page } = await import('../page')
    render(await Page({ params: Promise.resolve({ niveau: '3e', matiere: 'mathematiques' }) }))

    expect(screen.getByRole('heading', { name: 'Le parcours' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /pythagore/i })
    expect(link).toHaveAttribute('href', '/3e/mathematiques/theoreme-de-pythagore')
  })

  it('appelle notFound pour une combinaison niveau/matière inexistante', async () => {
    const { getCatalogue } = await import('@/lib/api')
    vi.mocked(getCatalogue).mockResolvedValue(FIXTURE_CATALOGUE)

    const { default: Page } = await import('../page')
    await expect(
      Page({ params: Promise.resolve({ niveau: '3e', matiere: 'physique' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
