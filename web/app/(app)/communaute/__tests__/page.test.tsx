import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ toString: (): string => 'JSESSIONID=abc' })),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))
vi.mock('@/components/site-header', () => ({ SiteHeader: () => null }))
vi.mock('@/lib/api', () => ({ getCatalogue: vi.fn(async () => []) }))
vi.mock('@/lib/espace-eleve', () => ({ lireMoi: vi.fn() }))

const QUESTION = {
  id: '00000000-0000-4000-8000-000000000301',
  titre: 'Comment développer ?',
  auteur: { pseudonyme: 'Renard-Turquoise', niveau: '3e' },
  niveau: '3e',
  matiere: 'mathematiques',
  resolue: true,
  nombreReponses: 2,
  nombreUtile: 1,
  aVote: false,
  estAuteur: false,
  modifie: false,
  createdAt: '2026-10-20T16:00:00Z',
}

async function rendre(
  searchParams: Record<string, string> = {},
  page: unknown = { questions: [], pageSuivante: false },
  niveau: string | null = '5e'
) {
  const fetchMock = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(page), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const { lireMoi } = await import('@/lib/espace-eleve')
  vi.mocked(lireMoi).mockResolvedValue({ role: 'eleve', niveau } as never)
  const { default: Page } = await import('../page')
  render(await Page({ searchParams: Promise.resolve(searchParams) }))
  return String(fetchMock.mock.calls[0]?.[0])
}

describe('CommunautePage', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('filters on the student’s level by default', async () => {
    const url = await rendre()
    expect(url).toContain('/api/communaute/questions?niveau=5e')
    expect(screen.getByLabelText('Niveau')).toHaveValue('5e')
  })

  it('does not filter on « tous », or for a student with no level', async () => {
    expect(await rendre({ niveau: 'tous' })).toMatch(/\/questions$/)
  })

  it('shows every level to a student with no level', async () => {
    expect(await rendre({}, undefined, null)).toMatch(/\/questions$/)
    expect(screen.getByLabelText('Niveau')).toHaveValue('tous')
  })

  it('passes the subject and the page on', async () => {
    const url = await rendre({ niveau: '3e', matiere: 'mathematiques', page: '2' })
    expect(url).toContain('niveau=3e&matiere=mathematiques&page=2')
  })

  it('shows the author as a pseudonym and level, and the server’s counts', async () => {
    await rendre({}, { questions: [QUESTION], pageSuivante: false })
    expect(screen.getByRole('link', { name: /Comment développer/ })).toHaveAttribute(
      'href',
      `/communaute/${QUESTION.id}`
    )
    expect(screen.getByText(/Renard-Turquoise · 3e/)).toBeInTheDocument()
    expect(screen.getByText('Résolue')).toBeInTheDocument()
    expect(screen.getByText(/2 réponses · 1 vote « Utile »/)).toBeInTheDocument()
  })

  it('says when there is nothing, with no invented question', async () => {
    await rendre()
    expect(screen.getByText('Aucune question pour l’instant')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pages de questions' })).toBeNull()
  })

  it('links the next page only when the server has one', async () => {
    await rendre({ niveau: '5e' }, { questions: [QUESTION], pageSuivante: true })
    expect(screen.getByRole('link', { name: 'Questions plus anciennes' })).toHaveAttribute(
      'href',
      '/communaute?niveau=5e&page=1'
    )
    expect(screen.queryByRole('link', { name: 'Questions plus récentes' })).toBeNull()
  })

  it('is not found when the route does not exist, as with the setting off', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))
    const { lireMoi } = await import('@/lib/espace-eleve')
    vi.mocked(lireMoi).mockResolvedValue({ role: 'eleve', niveau: '5e' } as never)
    const { default: Page } = await import('../page')
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('calls no API for a teacher, whom the layout has already answered', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { lireMoi } = await import('@/lib/espace-eleve')
    vi.mocked(lireMoi).mockResolvedValue({ role: 'enseignant' } as never)
    const { default: Page } = await import('../page')
    expect(await Page({ searchParams: Promise.resolve({}) })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lets a failed read reach the error page instead of showing an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))
    const { lireMoi } = await import('@/lib/espace-eleve')
    vi.mocked(lireMoi).mockResolvedValue({ role: 'eleve', niveau: '5e' } as never)
    const { default: Page } = await import('../page')
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow()
  })
})
