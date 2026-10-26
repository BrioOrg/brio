import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/progression', () => ({ getParcours: vi.fn() }))

import { getParcours } from '@/lib/progression'
import { ChapterAtlas } from '../chapter-atlas'

const mock = vi.mocked(getParcours)

const CHAPTERS = [
  { slug: 'ch-a', titre: 'Nombres relatifs', dureeEstimeeMinutes: 30, ordre: 0 },
  { slug: 'ch-b', titre: 'Fractions', dureeEstimeeMinutes: 40, ordre: 1 },
  { slug: 'ch-c', titre: 'Pythagore', dureeEstimeeMinutes: 55, ordre: 2 },
]

function renderAtlas() {
  return render(
    <ChapterAtlas
      niveau="3e"
      matiere="mathematiques"
      matiereLibelle="Mathématiques"
      chapters={CHAPTERS}
    />
  )
}

/** The title of the chapter the mascot stands by. */
function mascotChapter(container: HTMLElement) {
  const li = container.querySelector('[data-mascotte]')?.closest('li')
  return li?.querySelector('a')?.getAttribute('aria-label')?.split(' — ')[0] ?? null
}

beforeEach(() => {
  mock.mockReset()
})

describe('ChapterAtlas', () => {
  it('logged out (null) — every chapter is a reachable link, no fabricated state', async () => {
    mock.mockResolvedValue(null)
    renderAtlas()

    for (const c of CHAPTERS) {
      const link = screen.getByRole('link', { name: new RegExp(c.titre, 'i') })
      expect(link).toHaveAttribute('href', `/3e/mathematiques/${c.slug}`)
    }
    // No lock and no "done" claim without real data.
    expect(screen.queryByText('Verrouillé')).toBeNull()
    expect(screen.queryByText('Terminé')).toBeNull()
    // Neutral status shows the reading estimate instead, and no mascot without a path.
    expect(screen.getByText(/Lecture ≈ 30 min/)).toBeInTheDocument()
    expect(document.querySelector('[data-mascotte]')).toBeNull()
  })

  it('renders the real states joined by chapitreId = slug, with no lock', async () => {
    mock.mockResolvedValue([
      { chapitreId: 'ch-a', ordre: 0, etat: 'fait', pourcentage: 100 },
      { chapitreId: 'ch-b', ordre: 1, etat: 'en_cours', pourcentage: 40 },
      { chapitreId: 'ch-c', ordre: 2, etat: 'verrouille', pourcentage: 0 },
    ])
    const { container } = renderAtlas()

    // Done chapter: still a link, marked "Terminé".
    await waitFor(() => expect(screen.getByText('Terminé')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /Nombres relatifs — Terminé/i })).toBeInTheDocument()

    // First chapter not done: "EN ROUTE" bubble and the real percentage (#82).
    expect(screen.getByText('EN ROUTE')).toBeInTheDocument()
    expect(screen.getByText('40 % effectués')).toBeInTheDocument()
    expect(screen.getByText('Chapitre 2')).toBeInTheDocument()

    // Real completion bars only: done = 100, started = 40 (#82).
    const values = screen
      .getAllByRole('progressbar')
      .map((b) => b.getAttribute('aria-valuenow'))
      .sort()
    expect(values).toEqual(['100', '40'])

    // A chapter the backend still computes as locked is an open link, with no lock shown.
    expect(screen.getByRole('link', { name: /Pythagore/i })).toHaveAttribute(
      'href',
      '/3e/mathematiques/ch-c'
    )
    expect(screen.queryByText(/verrouillé/i)).toBeNull()
    expect(container.querySelector('[aria-disabled]')).toBeNull()

    // The mascot stands by the first chapter not done.
    expect(mascotChapter(container)).toBe('Fractions')
  })

  it('places the mascot by the first chapter not done, even after a skipped one', async () => {
    // Chapter 2 done before chapter 1: the first one not done is still chapter 1.
    mock.mockResolvedValue([
      { chapitreId: 'ch-a', ordre: 0, etat: 'en_cours', pourcentage: 0 },
      { chapitreId: 'ch-b', ordre: 1, etat: 'fait', pourcentage: 100 },
      { chapitreId: 'ch-c', ordre: 2, etat: 'en_cours', pourcentage: 25 },
    ])
    const { container } = renderAtlas()

    await waitFor(() => expect(screen.getByText('EN ROUTE')).toBeInTheDocument())
    expect(mascotChapter(container)).toBe('Nombres relatifs')
    expect(screen.getByRole('link', { name: /Nombres relatifs — À commencer/i })).toBeInTheDocument()
    // Only one current chapter, even with another one started.
    expect(screen.getAllByText('EN ROUTE')).toHaveLength(1)
    expect(screen.getByText('25 % effectués')).toBeInTheDocument()
  })

  it('every chapter done: the mascot waits by the last one, no current chapter', async () => {
    mock.mockResolvedValue(
      CHAPTERS.map((c) => ({ chapitreId: c.slug, ordre: c.ordre, etat: 'fait', pourcentage: 100 }))
    )
    const { container } = renderAtlas()

    await waitFor(() => expect(screen.getByText('Parcours terminé')).toBeInTheDocument())
    expect(screen.getAllByText('Terminé')).toHaveLength(3)
    expect(screen.queryByText('EN ROUTE')).toBeNull()
    expect(mascotChapter(container)).toBe('Pythagore')
  })

  it('falls back to a neutral node for an unknown state code', async () => {
    mock.mockResolvedValue([{ chapitreId: 'ch-a', ordre: 0, etat: 'wibble', pourcentage: 0 }])
    renderAtlas()

    // Unknown state must not lock or claim completion — it stays a reachable link.
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Nombres relatifs/i })).toBeInTheDocument()
    )
    expect(screen.queryByText('Verrouillé')).toBeNull()
  })
})
