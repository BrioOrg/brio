import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// PL-6a (#398), C1, C2, C6: the way into and out of a teacher course. The header is replaced by
// a recorder so the breadcrumb the page hands it can be read; the body is rendered for real.

// The first import of the page is slow on a cold run.
vi.setConfig({ testTimeout: 15_000 })

const lireDevoirs = vi.hoisted(() => vi.fn())
const crumbs = vi.hoisted(() => [] as { label: string; href?: string }[][])

vi.mock('@/lib/espace-eleve', async (original) => ({
  ...(await original<typeof import('@/lib/espace-eleve')>()),
  lireDevoirs,
}))

vi.mock('@brio/api-client', () => ({
  createApiClient: vi.fn(),
  listerMesDevoirs: async () => [],
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

vi.mock('@/components/site-header', () => ({
  SiteHeader: (props: { crumbs?: { label: string; href?: string }[] }) => {
    crumbs.push(props.crumbs ?? [])
    return null
  },
}))

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

const devoir = (sourceRef: string) => ({
  id: 'd1',
  classeId: 'c1',
  titre: 'Relire le cours',
  consigne: 'Note les deux définitions.',
  enseignant: 'M. Dubois',
  sourceType: 'cours',
  sourceRef,
  echeanceAt: '2026-10-03T10:00:00Z',
  nombreExercices: 1,
  statutRendu: 'non_commence',
  corrige: false,
})

const FIL = [
  { label: 'Ma classe', href: '/ma-classe' },
  { label: 'Cours du prof', href: '/ma-classe/cours' },
]

async function renderPage({
  devoir: devoirParam,
  disponible = true,
}: { devoir?: string | string[]; disponible?: boolean } = {}) {
  const { getCoursPublie } = await import('@/lib/api')
  if (disponible) vi.mocked(getCoursPublie).mockResolvedValue(COURS as never)
  else vi.mocked(getCoursPublie).mockRejectedValue(new Error('Cours indisponible'))
  const { default: Page } = await import('../page')
  const page = await Page({
    params: Promise.resolve({ coursId: COURS_ID }),
    searchParams: Promise.resolve(devoirParam === undefined ? {} : { devoir: devoirParam }),
  })
  return render(page)
}

const lienCoursDuProf = () => screen.queryAllByRole('link', { name: /Voir les cours du prof/ })
const lienRetour = () => screen.queryAllByRole('link', { name: /Retour à mes devoirs/ })

beforeEach(() => {
  vi.resetModules()
  crumbs.length = 0
  lireDevoirs.mockReset()
  lireDevoirs.mockResolvedValue([devoir(COURS_ID)])
})

afterEach(async () => {
  await act(async () => {})
})

describe('Cours du prof — fil et sortie (PL-6a)', () => {
  describe('un cours lisible', () => {
    // C1
    it('C1 : le fil a deux entrées liées avant le titre, le titre est la page courante', async () => {
      await renderPage()

      expect(crumbs.at(-1)).toEqual([...FIL, { label: 'Les fractions, version M. Dubois' }])
    })

    // C1 + C6
    it('C1/C6 : même fil quand le cours est ouvert depuis un devoir, bandeau conservé', async () => {
      await renderPage({ devoir: 'd1' })

      expect(crumbs.at(-1)).toEqual([...FIL, { label: 'Les fractions, version M. Dubois' }])
      expect(screen.getByText('Devoir de M. Dubois · à rendre le 3 octobre')).toBeInTheDocument()
    })

    it('un cours lisible ne montre pas de bouton « Voir les cours du prof » dans le corps', async () => {
      await renderPage()

      expect(lienCoursDuProf()).toHaveLength(0)
    })
  })

  describe('un cours indisponible', () => {
    // C2
    it('C2 : le fil garde ses deux entrées liées puis « Cours indisponible »', async () => {
      await renderPage({ disponible: false })

      expect(crumbs.at(-1)).toEqual([...FIL, { label: 'Cours indisponible' }])
    })

    // C2: whatever the way the page was reached, one way out, to the teacher's courses.
    it.each([
      ['sans ?devoir=', async () => renderPage({ disponible: false }), () => {}],
      [
        'avec un ?devoir= forgé',
        async () => renderPage({ disponible: false, devoir: 'forge' }),
        () => {},
      ],
      [
        'avec ?devoir= répété',
        async () => renderPage({ disponible: false, devoir: ['d1', 'd2'] }),
        () => {},
      ],
      [
        'quand la liste des devoirs est illisible',
        async () => renderPage({ disponible: false, devoir: 'd1' }),
        () => lireDevoirs.mockRejectedValue(new Error('401')),
      ],
      [
        'quand la liste des devoirs est vide',
        async () => renderPage({ disponible: false, devoir: 'd1' }),
        () => lireDevoirs.mockResolvedValue([]),
      ],
    ])('C2 : un seul lien « Voir les cours du prof » %s', async (_nom, rendre, preparer) => {
      preparer()
      await rendre()

      const liens = lienCoursDuProf()
      expect(liens).toHaveLength(1)
      expect(liens[0]).toHaveAttribute('href', '/ma-classe/cours')
      expect(lienRetour()).toHaveLength(0)
    })

    // C2 / U7: one tab stop, like the other way back.
    it('C2 : le lien ne compte que pour un arrêt de tabulation (le bouton est hors tabulation)', async () => {
      await renderPage({ disponible: false })

      const lien = lienCoursDuProf()[0]!
      expect(within(lien).getByRole('button')).toHaveAttribute('tabindex', '-1')
    })

    // C6 — the homework way back is not replaced by the teacher's courses.
    it('C6 : un devoir de l’élève garde « Retour à mes devoirs », sans « Voir les cours du prof »', async () => {
      lireDevoirs.mockResolvedValue([devoir(AUTRE_COURS_ID)])
      await renderPage({ disponible: false, devoir: 'd1' })

      expect(lienRetour()).toHaveLength(1)
      expect(lienRetour()[0]).toHaveAttribute('href', '/ma-classe')
      expect(lienCoursDuProf()).toHaveLength(0)
      expect(within(screen.getByRole('main')).getAllByRole('link')).toHaveLength(1)
      expect(crumbs.at(-1)).toEqual([...FIL, { label: 'Cours indisponible' }])
    })
  })
})
