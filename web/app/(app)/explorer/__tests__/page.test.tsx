import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  getCatalogue: vi.fn(),
  getNiveauDeLEleve: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => 'JSESSIONID=abc' }),
}))

vi.mock('next/navigation', () => ({
  // Read by the SiteHeader's section links.
  usePathname: () => '/explorer',
}))

const niveau = (niveauCode: string, niveauLibelle: string) => ({
  niveauCode,
  niveauLibelle,
  matieres: [
    {
      matiereCode: 'mathematiques',
      matiereLibelle: 'Mathématiques',
      chapitres: [{ slug: 'un-chapitre', titre: 'Un chapitre', dureeEstimeeMinutes: 55, ordre: 0 }],
    },
  ],
})

const CATALOGUE = [niveau('6e', 'Sixième'), niveau('5e', 'Cinquième'), niveau('3e', 'Troisième')]

async function renderPage(niveauEleve: () => Promise<string | null>) {
  const { getCatalogue, getNiveauDeLEleve } = await import('@/lib/api')
  vi.mocked(getCatalogue).mockResolvedValue(CATALOGUE)
  vi.mocked(getNiveauDeLEleve).mockImplementation(niveauEleve)
  const { default: Page } = await import('../page')
  render(await Page())
}

describe('ExplorerPage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
  })

  it('met le niveau de l’élève en avant, en premier, avec ses matières', async () => {
    await renderPage(() => Promise.resolve('5e'))

    const { getNiveauDeLEleve } = await import('@/lib/api')
    expect(getNiveauDeLEleve).toHaveBeenCalledWith('JSESSIONID=abc')

    const niveaux = within(screen.getByRole('region', { name: 'Les niveaux' })).getAllByRole('link')
    expect(niveaux.map((a) => a.getAttribute('href'))).toEqual(['/5e', '/6e', '/3e'])
    expect(niveaux[0]).toHaveTextContent('Ton niveau')
    expect(niveaux[1]).not.toHaveTextContent('Ton niveau')

    const matieres = screen.getByRole('region', { name: 'Les matières de ton niveau' })
    expect(within(matieres).getByRole('link', { name: /mathématiques/i })).toHaveAttribute(
      'href',
      '/5e/mathematiques'
    )
  })

  it.each([
    ['sans classe', () => Promise.resolve(null)],
    ['dont la classe est hors catalogue', () => Promise.resolve('2nde')],
    ['quand le backend échoue', () => Promise.reject(new Error('indisponible'))],
  ])('ne met aucun niveau en avant pour un compte %s', async (_cas, niveauEleve) => {
    await renderPage(niveauEleve)

    expect(screen.queryByText('Ton niveau')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Les matières de ton niveau' })).toBeNull()
    const niveaux = within(screen.getByRole('region', { name: 'Les niveaux' })).getAllByRole('link')
    expect(niveaux.map((a) => a.getAttribute('href'))).toEqual(['/6e', '/5e', '/3e'])
  })

  it('propose les annales et ne parle pas des cours du prof', async () => {
    await renderPage(() => Promise.resolve('5e'))

    expect(screen.getByRole('link', { name: /annales/i })).toHaveAttribute('href', '/annales')
    expect(screen.queryByRole('heading', { name: 'Les cours de ta classe' })).toBeNull()
  })
})
