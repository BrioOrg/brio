import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  getCatalogue: vi.fn(),
  getCoursVisibles: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => 'JSESSIONID=abc' }),
}))

// The real redirect() throws to stop rendering; mirror that so the page stops too.
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
  // Read by the SiteHeader's section links.
  usePathname: () => '/',
}))

function stubMoi(status: number) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status === 200, status })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const COURS = {
  id: 'c-1',
  titre: 'Pythagore en pratique',
  niveauCode: '3e',
  matiereCode: 'mathematiques',
  enseignant: 'Mme Durand',
  publieAt: '2026-09-28T10:00:00Z',
}

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
    redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`)
    })
    stubMoi(200)
  })

  it('redirige vers /connexion quand la session n’est plus valide', async () => {
    const { getCatalogue, getCoursVisibles } = await import('@/lib/api')
    const fetchMock = stubMoi(401)

    const { default: Page } = await import('../page')
    await expect(Page()).rejects.toThrow('REDIRECT:/connexion?from=/')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/moi'),
      expect.objectContaining({ headers: { cookie: 'JSESSIONID=abc' } })
    )
    expect(getCatalogue).not.toHaveBeenCalled()
    expect(getCoursVisibles).not.toHaveBeenCalled()
  })

  it('affiche le titre et un lien vers le niveau 3e', async () => {
    const { getCatalogue, getCoursVisibles } = await import('@/lib/api')
    vi.mocked(getCatalogue).mockResolvedValue(FIXTURE_CATALOGUE)
    vi.mocked(getCoursVisibles).mockResolvedValue([])

    const { default: Page } = await import('../page')
    render(await Page())

    expect(screen.getByRole('heading', { name: /apprends, progresse/i })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /troisième/i })
    expect(link).toHaveAttribute('href', '/3e')
  })

  it('montre les cours de la classe au-dessus du catalogue, avec matière, prof et date', async () => {
    const { getCatalogue, getCoursVisibles } = await import('@/lib/api')
    vi.mocked(getCatalogue).mockResolvedValue(FIXTURE_CATALOGUE)
    vi.mocked(getCoursVisibles).mockResolvedValue([COURS])

    const { default: Page } = await import('../page')
    render(await Page())

    expect(getCoursVisibles).toHaveBeenCalledWith('JSESSIONID=abc')
    const section = screen.getByRole('heading', { name: 'Les cours de ta classe' })
    const lien = screen.getByRole('link', { name: /pythagore en pratique/i })
    expect(lien).toHaveAttribute('href', '/cours/c-1')
    expect(lien).toHaveTextContent('Mathématiques · par Mme Durand')
    expect(lien).toHaveTextContent('Publié le 28 septembre')
    // Above the catalogue.
    const catalogue = screen.getByRole('heading', { name: 'Ta classe' })
    expect(
      section.compareDocumentPosition(catalogue) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('omet le nom du prof quand le backend n’en a pas', async () => {
    const { getCatalogue, getCoursVisibles } = await import('@/lib/api')
    vi.mocked(getCatalogue).mockResolvedValue(FIXTURE_CATALOGUE)
    vi.mocked(getCoursVisibles).mockResolvedValue([{ ...COURS, enseignant: null }])

    const { default: Page } = await import('../page')
    render(await Page())

    const lien = screen.getByRole('link', { name: /pythagore en pratique/i })
    expect(lien).toHaveTextContent('Mathématiques')
    expect(lien).not.toHaveTextContent('par')
  })

  it.each([
    ['aucun cours', () => Promise.resolve([])],
    ['une erreur du backend', () => Promise.reject(new Error('Cours indisponibles'))],
  ])('n’affiche pas la section quand il y a %s', async (_cas, reponse) => {
    const { getCatalogue, getCoursVisibles } = await import('@/lib/api')
    vi.mocked(getCatalogue).mockResolvedValue(FIXTURE_CATALOGUE)
    vi.mocked(getCoursVisibles).mockImplementation(reponse)

    const { default: Page } = await import('../page')
    render(await Page())

    expect(screen.queryByRole('heading', { name: 'Les cours de ta classe' })).toBeNull()
    expect(screen.getByRole('link', { name: /troisième/i })).toBeInTheDocument()
  })
})
