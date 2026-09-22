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
    // Neutral status shows the reading estimate instead.
    expect(screen.getByText(/Lecture ≈ 30 min/)).toBeInTheDocument()
  })

  it('renders the real states joined by chapitreId = slug', async () => {
    mock.mockResolvedValue([
      { chapitreId: 'ch-a', ordre: 0, etat: 'fait', pourcentage: 100 },
      { chapitreId: 'ch-b', ordre: 1, etat: 'en_cours', pourcentage: 40 },
      { chapitreId: 'ch-c', ordre: 2, etat: 'verrouille', pourcentage: 0 },
    ])
    renderAtlas()

    // Done chapter: still a link, marked "Terminé".
    await waitFor(() => expect(screen.getByText('Terminé')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /Nombres relatifs/i })).toBeInTheDocument()

    // Active chapter: link, "EN ROUTE" bubble and the real percentage (#82).
    expect(screen.getByText('EN ROUTE')).toBeInTheDocument()
    expect(screen.getByText('40 % effectués')).toBeInTheDocument()

    // Banner points at the active chapter.
    expect(screen.getByText('Chapitre 2')).toBeInTheDocument()

    // Real completion bars: done = 100, in-progress = 40 (#82).
    const bars = screen.getAllByRole('progressbar')
    const values = bars.map((b) => b.getAttribute('aria-valuenow')).sort()
    expect(values).toEqual(['100', '40'])

    // Locked chapter: NOT a link, labelled locked, and NO fabricated bar.
    expect(screen.queryByRole('link', { name: /Pythagore/i })).toBeNull()
    expect(screen.getByLabelText(/Pythagore — verrouillé/i)).toBeInTheDocument()
    expect(bars).toHaveLength(2) // only fait + en_cours, never the locked one
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
