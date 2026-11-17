import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// A teacher course opened from a homework (#370): the homework banner above it, and a way back
// to the homework when the course cannot be read.

const listerMesDevoirs = vi.hoisted(() => vi.fn())

vi.mock('@brio/api-client', () => ({
  createApiClient: vi.fn(),
  listerMesDevoirs,
  // The reader's rail and tools ask these on mount — default: nothing open, no class.
  getSerie: async () => null,
  getMoi: async () => null,
  controleActif: async () => ({ enControle: false, titre: null, echeanceAt: null }),
  examenActif: async () => ({ enExamen: false, annaleId: null, titre: null, endsAt: null }),
  mesClasses: async () => [],
}))

vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  getCoursPublie: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => 'JSESSIONID=abc', get: () => undefined }),
}))

vi.mock('@/components/site-header', () => ({ SiteHeader: () => null }))

const COURS_ID = '0b6f2c1e-8d4a-4c3b-9f1e-2a7d5c9e1b40'

const COURS = {
  schemaVersion: 1,
  id: 'contenu-du-cours',
  title: 'Les fractions, version M. Dubois',
  subject: 'mathematiques',
  level: '5e',
  sections: [
    {
      id: 'decouvrir',
      title: 'Découvrir',
      kind: 'lesson',
      blocks: [{ id: 'b1', type: 'prose', text: 'Une fraction partage une unité.' }],
    },
  ],
}

const DEVOIR = {
  id: 'd1',
  classeId: 'c1',
  titre: 'Relire le cours',
  enseignant: 'M. Dubois',
  sourceType: 'cours',
  sourceRef: COURS_ID,
  echeanceAt: '2026-10-03T10:00:00Z',
  nombreExercices: 1,
  statutRendu: 'non_commence',
  corrige: false,
}

async function renderPage({
  devoir,
  disponible = true,
}: { devoir?: string | string[]; disponible?: boolean } = {}) {
  const { getCoursPublie } = await import('@/lib/api')
  if (disponible) vi.mocked(getCoursPublie).mockResolvedValue(COURS as never)
  else vi.mocked(getCoursPublie).mockRejectedValue(new Error(`Cours indisponible: ${COURS_ID}`))

  const { default: Page } = await import('../page')
  const page = await Page({
    params: Promise.resolve({ coursId: COURS_ID }),
    searchParams: Promise.resolve(devoir === undefined ? {} : { devoir }),
  })
  const rendu = render(page)
  // Let a mounted banner load the homework list.
  await act(async () => {})
  return rendu
}

beforeEach(() => {
  vi.resetModules()
  listerMesDevoirs.mockReset()
  listerMesDevoirs.mockResolvedValue([DEVOIR])
})

describe('CoursPage', () => {
  describe('a readable course', () => {
    // critère 2
    it('shows the course with the homework banner when opened from the homework', async () => {
      await renderPage({ devoir: 'd1' })

      expect(
        screen.getByRole('heading', { level: 1, name: 'Les fractions, version M. Dubois' })
      ).toBeInTheDocument()
      expect(
        await screen.findByText('Devoir de M. Dubois · à rendre le 3 octobre')
      ).toBeInTheDocument()
    })

    it('says “Devoir” alone when the backend has no name for the teacher', async () => {
      listerMesDevoirs.mockResolvedValue([{ ...DEVOIR, enseignant: null }])
      await renderPage({ devoir: 'd1' })

      expect(await screen.findByText('Devoir · à rendre le 3 octobre')).toBeInTheDocument()
    })

    it('shows no banner without ?devoir=', async () => {
      await renderPage()

      expect(
        screen.getByRole('heading', { level: 1, name: 'Les fractions, version M. Dubois' })
      ).toBeInTheDocument()
      expect(listerMesDevoirs).not.toHaveBeenCalled()
      expect(screen.queryByText(/à rendre le/)).toBeNull()
    })

    it('shows no banner when ?devoir= is repeated', async () => {
      await renderPage({ devoir: ['d1', 'd1'] })

      expect(listerMesDevoirs).not.toHaveBeenCalled()
      expect(screen.queryByText(/à rendre le/)).toBeNull()
    })

    it('shows no banner for a homework on another course, the course staying readable', async () => {
      listerMesDevoirs.mockResolvedValue([
        { ...DEVOIR, sourceRef: '5c1d9e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f' },
      ])
      await renderPage({ devoir: 'd1' })

      expect(screen.getByText('Une fraction partage une unité.')).toBeInTheDocument()
      expect(screen.queryByText(/à rendre le/)).toBeNull()
    })

    it('offers no way back to the homework when the course is readable', async () => {
      await renderPage({ devoir: 'd1' })

      expect(screen.queryByRole('link', { name: 'Retour à mes devoirs' })).toBeNull()
    })
  })

  describe('a course that cannot be read (403, 404, network)', () => {
    // critère 5
    it('says so and leads back to the homework in one click when opened from one', async () => {
      await renderPage({ devoir: 'd1', disponible: false })

      expect(screen.getByRole('alert')).toHaveTextContent('Cours indisponible')
      expect(screen.getByRole('link', { name: 'Retour à mes devoirs' })).toHaveAttribute(
        'href',
        '/ma-classe'
      )
      // No banner on the error (spec UI, décision 5).
      expect(screen.queryByText(/à rendre le/)).toBeNull()
    })

    it('adds no link when not opened from a homework', async () => {
      await renderPage({ disponible: false })

      expect(screen.getByRole('alert')).toHaveTextContent('Cours indisponible')
      expect(screen.queryByRole('link', { name: 'Retour à mes devoirs' })).toBeNull()
    })

    it('adds no link when ?devoir= is repeated', async () => {
      await renderPage({ devoir: ['d1', 'd2'], disponible: false })

      expect(screen.getByRole('alert')).toHaveTextContent('Cours indisponible')
      expect(screen.queryByRole('link', { name: 'Retour à mes devoirs' })).toBeNull()
    })
  })
})
