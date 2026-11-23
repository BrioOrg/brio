import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A teacher course opened from a homework (#370): the homework banner above it, and a way back
// to the homework when the course cannot be read. The banner is found on the server, alongside
// the course, so it is in the first paint (U6: no layout shift, no client round trip).

const lireDevoirs = vi.hoisted(() => vi.fn())
const listerMesDevoirs = vi.hoisted(() => vi.fn())

vi.mock('@/lib/espace-eleve', async (original) => ({
  ...(await original<typeof import('@/lib/espace-eleve')>()),
  lireDevoirs,
}))

vi.mock('@brio/api-client', () => ({
  createApiClient: vi.fn(),
  // The browser-side homework list: the course page must no longer need it for its banner.
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

// The banner is a client component: whatever the server page hands it is serialized into the RSC
// payload sent to the browser. Record those props, and render the real banner with them.
const propsBandeau = vi.hoisted(() => [] as Record<string, unknown>[])
vi.mock('@/components/bandeau-devoir', async (original) => {
  const reel = await original<typeof import('@/components/bandeau-devoir')>()
  return {
    ...reel,
    BandeauDevoirVue: (props: Parameters<typeof reel.BandeauDevoirVue>[0]) => {
      propsBandeau.push({ ...props })
      return reel.BandeauDevoirVue(props)
    },
  }
})

const COURS_ID = '0b6f2c1e-8d4a-4c3b-9f1e-2a7d5c9e1b40'
const AUTRE_COURS_ID = '5c1d9e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f'

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
  consigne: 'Note les deux définitions dans ton cahier.',
  enseignant: 'M. Dubois',
  sourceType: 'cours',
  sourceRef: COURS_ID,
  echeanceAt: '2026-10-03T10:00:00Z',
  nombreExercices: 1,
  statutRendu: 'non_commence',
  corrige: false,
}

// Renders the server page and returns at once: the banner, if any, is already in the tree —
// nothing is flushed before the caller's assertions.
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
  return render(page)
}

beforeEach(() => {
  vi.resetModules()
  lireDevoirs.mockReset()
  lireDevoirs.mockResolvedValue([DEVOIR])
  listerMesDevoirs.mockReset()
  listerMesDevoirs.mockResolvedValue([DEVOIR])
  propsBandeau.length = 0
})

// Let the reader's client components settle (rail, tools) so their late updates stay inside act.
afterEach(async () => {
  await act(async () => {})
})

describe('CoursPage', () => {
  describe('a readable course', () => {
    // critère 2
    it('shows the course with the homework banner in the first paint when opened from the homework', async () => {
      await renderPage({ devoir: 'd1' })

      expect(
        screen.getByRole('heading', { level: 1, name: 'Les fractions, version M. Dubois' })
      ).toBeInTheDocument()
      // Synchronous: rendered on the server, no client fetch to wait for (U6).
      expect(screen.getByText('Devoir de M. Dubois · à rendre le 3 octobre')).toBeInTheDocument()
      // Read with the student's session, the one the course is read with.
      expect(lireDevoirs).toHaveBeenCalledWith('JSESSIONID=abc')
    })

    // critère 2 — U6: the homework list is read alongside the course, not after it.
    it('reads the homework list while the course is still loading', async () => {
      const { getCoursPublie } = await import('@/lib/api')
      let livrerCours: (cours: unknown) => void = () => {}
      vi.mocked(getCoursPublie).mockReturnValue(
        new Promise((resolve) => {
          livrerCours = resolve
        }) as never
      )
      const { default: Page } = await import('../page')
      const enCours = Page({
        params: Promise.resolve({ coursId: COURS_ID }),
        searchParams: Promise.resolve({ devoir: 'd1' }),
      })

      await vi.waitFor(() => expect(lireDevoirs).toHaveBeenCalled())
      expect(getCoursPublie).toHaveBeenCalled()
      livrerCours(COURS)
      render(await enCours)

      expect(screen.getByText('Devoir de M. Dubois · à rendre le 3 octobre')).toBeInTheDocument()
    })

    it('does not fetch the homework list from the browser for the banner', async () => {
      await renderPage({ devoir: 'd1' })
      await act(async () => {})

      expect(listerMesDevoirs).not.toHaveBeenCalled()
    })

    it('says “Devoir” alone when the backend has no name for the teacher', async () => {
      lireDevoirs.mockResolvedValue([{ ...DEVOIR, enseignant: null }])
      await renderPage({ devoir: 'd1' })

      expect(screen.getByText('Devoir · à rendre le 3 octobre')).toBeInTheDocument()
    })

    // V1, V5: the banner gets only what it shows, so the homework's title, instructions and class
    // are not serialized into the page sent to the browser.
    it('hands the banner only the teacher and the due date', async () => {
      await renderPage({ devoir: 'd1' })

      expect(propsBandeau).toEqual([
        { enseignant: 'M. Dubois', echeanceAt: '2026-10-03T10:00:00Z' },
      ])
      expect(screen.queryByText(/Relire le cours/)).toBeNull()
      expect(screen.queryByText(/Note les deux définitions/)).toBeNull()
    })

    it('shows no banner without ?devoir=, and does not read the homework list', async () => {
      await renderPage()

      expect(
        screen.getByRole('heading', { level: 1, name: 'Les fractions, version M. Dubois' })
      ).toBeInTheDocument()
      expect(lireDevoirs).not.toHaveBeenCalled()
      expect(screen.queryByText(/à rendre le/)).toBeNull()
    })

    it('shows no banner when ?devoir= is repeated, and does not read the homework list', async () => {
      await renderPage({ devoir: ['d1', 'd1'] })

      expect(lireDevoirs).not.toHaveBeenCalled()
      expect(screen.queryByText(/à rendre le/)).toBeNull()
    })

    it.each([
      ['is not the student’s', 'autre', DEVOIR],
      ['points to another course', 'd1', { ...DEVOIR, sourceRef: AUTRE_COURS_ID }],
      [
        'is a chapter homework whose slug equals the course id',
        'd1',
        { ...DEVOIR, sourceType: 'chapitre' },
      ],
    ])(
      'shows no banner when the homework %s, the course staying readable',
      async (_cas, devoirId, devoir) => {
        lireDevoirs.mockResolvedValue([devoir])
        await renderPage({ devoir: devoirId })

        expect(lireDevoirs).toHaveBeenCalled()
        expect(screen.getByText('Une fraction partage une unité.')).toBeInTheDocument()
        expect(screen.queryByText(/à rendre le/)).toBeNull()
      }
    )

    // A failed read of the homework list never hides the course.
    it.each([
      ['a lapsed session (null)', () => lireDevoirs.mockResolvedValue(null)],
      ['a rejected read', () => lireDevoirs.mockRejectedValue(new TypeError('fetch failed'))],
    ])('shows no banner on %s, the course staying readable', async (_cas, echec) => {
      echec()
      await renderPage({ devoir: 'd1' })

      expect(lireDevoirs).toHaveBeenCalled()
      expect(
        screen.getByRole('heading', { level: 1, name: 'Les fractions, version M. Dubois' })
      ).toBeInTheDocument()
      expect(screen.getByText('Une fraction partage une unité.')).toBeInTheDocument()
      expect(screen.queryByText(/à rendre le/)).toBeNull()
      expect(screen.queryByRole('alert')).toBeNull()
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
      // The homework list already read alongside the course: nothing read again for the link.
      expect(lireDevoirs).toHaveBeenCalledTimes(1)
      expect(lireDevoirs).toHaveBeenCalledWith('JSESSIONID=abc')
    })

    // critère 5: the student's own homework keeps its way back, whatever its content points to —
    // the real 403 is a homework whose course has left the student's reach.
    it.each([
      ['points to this course (now out of reach)', DEVOIR],
      ['points to another course', { ...DEVOIR, sourceRef: AUTRE_COURS_ID }],
      ['is a chapter homework', { ...DEVOIR, sourceType: 'chapitre', sourceRef: 'fractions' }],
    ])('leads back to the homework when it is the student’s and %s', async (_cas, devoir) => {
      lireDevoirs.mockResolvedValue([devoir])
      await renderPage({ devoir: 'd1', disponible: false })

      expect(screen.getByRole('alert')).toHaveTextContent('Cours indisponible')
      expect(screen.getByRole('link', { name: 'Retour à mes devoirs' })).toHaveAttribute(
        'href',
        '/ma-classe'
      )
      expect(screen.queryByText(/à rendre le/)).toBeNull()
    })

    // V5 (S3): no misleading label for a forged URL, a teacher, or a student without a class —
    // the navigation bar stays the way out.
    it.each([
      ['an id that is not the student’s', () => lireDevoirs.mockResolvedValue([DEVOIR]), 'autre'],
      ['no homework at all (no class)', () => lireDevoirs.mockResolvedValue([]), 'd1'],
      [
        'an unreadable list (a teacher, a lapsed session)',
        () => lireDevoirs.mockResolvedValue(null),
        'd1',
      ],
      ['a rejected read', () => lireDevoirs.mockRejectedValue(new TypeError('fetch failed')), 'd1'],
    ])('adds no homework link for %s', async (_cas, preparer, devoirId) => {
      preparer()
      await renderPage({ devoir: devoirId, disponible: false })

      expect(lireDevoirs).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('alert')).toHaveTextContent('Cours indisponible')
      expect(screen.queryByRole('link', { name: 'Retour à mes devoirs' })).toBeNull()
      expect(screen.queryByText('Retour à mes devoirs')).toBeNull()
    })

    // U7: one tab stop for the way back — the link, not the button drawn inside it.
    it('makes the way back a single tab stop', async () => {
      await renderPage({ devoir: 'd1', disponible: false })

      const lien = screen.getByRole('link', { name: 'Retour à mes devoirs' })
      expect(within(lien).getByRole('button', { name: 'Retour à mes devoirs' })).toHaveAttribute(
        'tabindex',
        '-1'
      )
    })

    it('adds no homework link when not opened from a homework', async () => {
      await renderPage({ disponible: false })

      expect(lireDevoirs).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('Cours indisponible')
      expect(screen.queryByRole('link', { name: 'Retour à mes devoirs' })).toBeNull()
    })

    it('adds no homework link when ?devoir= is repeated', async () => {
      await renderPage({ devoir: ['d1', 'd2'], disponible: false })

      expect(screen.getByRole('alert')).toHaveTextContent('Cours indisponible')
      expect(screen.queryByRole('link', { name: 'Retour à mes devoirs' })).toBeNull()
    })
  })
})
