import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  getCatalogue: vi.fn(),
  getCoursVisibles: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => 'JSESSIONID=abc' }),
}))

vi.mock('next/navigation', () => ({
  // Read by the SiteHeader's section links.
  usePathname: () => '/ma-classe',
}))

vi.mock('@/components/messagerie/salon-classe', () => ({
  SalonClasse: () => <h1>Ma classe</h1>,
}))

const COURS = {
  id: 'c-1',
  titre: 'Pythagore en pratique',
  niveauCode: '3e',
  matiereCode: 'mathematiques',
  enseignant: 'Mme Durand',
  publieAt: '2026-09-28T10:00:00Z',
}

const CATALOGUE = [
  {
    niveauCode: '3e',
    niveauLibelle: 'Troisième',
    matieres: [{ matiereCode: 'mathematiques', matiereLibelle: 'Mathématiques', chapitres: [] }],
  },
]

describe('MaClassePage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
  })

  it('donne accès aux devoirs et aux cours de la classe', async () => {
    const { getCatalogue, getCoursVisibles } = await import('@/lib/api')
    vi.mocked(getCatalogue).mockResolvedValue(CATALOGUE)
    vi.mocked(getCoursVisibles).mockResolvedValue([COURS])

    const { default: Page } = await import('../page')
    render(await Page())

    expect(getCoursVisibles).toHaveBeenCalledWith('JSESSIONID=abc')
    expect(screen.getByRole('link', { name: /tes devoirs/i })).toHaveAttribute('href', '/devoirs')
    const lien = screen.getByRole('link', { name: /pythagore en pratique/i })
    expect(lien).toHaveAttribute('href', '/cours/c-1')
    expect(lien).toHaveTextContent('Mathématiques · par Mme Durand')
    expect(lien).toHaveTextContent('Publié le 28 septembre')
  })

  it('omet le nom du prof quand le backend n’en a pas', async () => {
    const { getCatalogue, getCoursVisibles } = await import('@/lib/api')
    vi.mocked(getCatalogue).mockResolvedValue(CATALOGUE)
    vi.mocked(getCoursVisibles).mockResolvedValue([{ ...COURS, enseignant: null }])

    const { default: Page } = await import('../page')
    render(await Page())

    expect(screen.getByRole('link', { name: /pythagore en pratique/i })).not.toHaveTextContent(
      'par'
    )
  })

  it('garde le lien des devoirs sans section de cours quand le backend échoue', async () => {
    const { getCatalogue, getCoursVisibles } = await import('@/lib/api')
    vi.mocked(getCatalogue).mockResolvedValue(CATALOGUE)
    vi.mocked(getCoursVisibles).mockRejectedValue(new Error('Cours indisponibles'))

    const { default: Page } = await import('../page')
    render(await Page())

    expect(screen.queryByRole('heading', { name: 'Les cours de ta classe' })).toBeNull()
    expect(screen.getByRole('link', { name: /tes devoirs/i })).toBeInTheDocument()
  })
})
