import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  getCatalogue: vi.fn(),
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

describe('HomePage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
  })

  it('affiche le titre et un lien vers le niveau 3e', async () => {
    const { getCatalogue } = await import('@/lib/api')
    vi.mocked(getCatalogue).mockResolvedValue(FIXTURE_CATALOGUE)

    const { default: Page } = await import('../page')
    render(await Page())

    expect(screen.getByRole('heading', { name: 'brio' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /troisième/i })
    expect(link).toHaveAttribute('href', '/3e')
  })
})
