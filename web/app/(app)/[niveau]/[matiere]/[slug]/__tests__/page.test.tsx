import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@brio/api-client', () => ({
  createApiClient: vi.fn(),
  // The page's SiteHeader renders the streak flame, which reads getSerie.
  // Plain async fn (not vi.fn) so vi.resetAllMocks() in beforeEach can't wipe it.
  getSerie: async () => null,
  // The SiteHeader also asks whether a session exists before showing the logout button.
  getMoi: async () => null,
  // The TuteurPanel checks for an open control/exam on mount (ADR 0025/0027) — default: none.
  controleActif: async () => ({ enControle: false, titre: null, echeanceAt: null }),
  examenActif: async () => ({ enExamen: false, annaleId: null, titre: null, endsAt: null }),
  // The rail's entraide tab loads the reader's classes on mount (ADR 0023) — default: none.
  mesClasses: async () => [],
}))

vi.mock('@/lib/api', () => ({
  getCatalogue: vi.fn(),
  getChapitreByTriplet: vi.fn(),
}))

// The chapter mode cookie (ADR 0032 §5), set per test.
let modeCookie: string | undefined
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'brio_mode_chapitre' && modeCookie ? { value: modeCookie } : undefined,
  }),
}))

const SEED_CHAPTER = {
  schemaVersion: 1,
  id: 'theoreme-de-pythagore',
  title: 'Le théorème de Pythagore',
  subject: 'mathematiques',
  level: '3e',
  sections: [
    {
      id: 'enonce',
      title: 'Énoncé',
      kind: 'lesson',
      blocks: [
        { id: 'b1', type: 'prose', text: 'Le théorème de Pythagore.' },
        {
          id: 'e1',
          type: 'exercise',
          exerciceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          exerciseType: 'multiple-choice',
          prompt: "Quel côté est l'hypoténuse ?",
          multiple: false,
          choices: [
            { id: 'choice-rs', text: 'Le côté [RS]' },
            { id: 'choice-rt', text: 'Le côté [RT]' },
          ],
        },
      ],
    },
  ],
}

async function renderPage({
  slug = 'theoreme-de-pythagore',
  diapo,
}: { slug?: string; diapo?: string } = {}) {
  const { default: Page } = await import('../page')
  return render(
    await Page({
      params: Promise.resolve({ niveau: '3e', matiere: 'mathematiques', slug }),
      searchParams: Promise.resolve(diapo === undefined ? {} : { diapo }),
    })
  )
}

describe('ChapterPage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
    // The reading mode, unless a test says otherwise.
    modeCookie = 'lecture'
  })

  it('affiche le titre et le contenu du chapitre', async () => {
    const { getChapitreByTriplet } = await import('@/lib/api')
    vi.mocked(getChapitreByTriplet).mockResolvedValue(SEED_CHAPTER as never)

    await renderPage()

    expect(screen.getByRole('heading', { name: 'Le théorème de Pythagore' })).toBeInTheDocument()
    expect(screen.getByText('Le théorème de Pythagore.')).toBeInTheDocument()
  })

  it("affiche les choix de l'exercice à choix multiple", async () => {
    const { getChapitreByTriplet } = await import('@/lib/api')
    vi.mocked(getChapitreByTriplet).mockResolvedValue(SEED_CHAPTER as never)

    await renderPage()

    expect(screen.getByText(/Quel côté est l'hypoténuse/)).toBeInTheDocument()
    // Choices are now hexagon OptionRow buttons, not radio inputs.
    expect(screen.getByRole('button', { name: /Le côté \[RS\]/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Le côté \[RT\]/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vérifier' })).toBeInTheDocument()
  })

  it("affiche l'état d'erreur quand le chapitre est introuvable", async () => {
    const { getChapitreByTriplet } = await import('@/lib/api')
    vi.mocked(getChapitreByTriplet).mockRejectedValue(new Error('Chapitre introuvable'))

    await renderPage({ slug: 'inconnu' })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Chapitre introuvable')).toBeInTheDocument()
  })

  describe('mode (ADR 0032 §5)', () => {
    async function seed() {
      const { getChapitreByTriplet } = await import('@/lib/api')
      vi.mocked(getChapitreByTriplet).mockResolvedValue(SEED_CHAPTER as never)
    }

    it('renders the reading mode when the cookie says so', async () => {
      await seed()
      const { container } = await renderPage()

      expect(container.querySelector('[data-chapitre-mode]')).toHaveAttribute(
        'data-chapitre-mode',
        'lecture'
      )
      expect(screen.getByRole('button', { name: /Mode interactif/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Vérifier' })).toBeVisible()
    })

    it('opens the interactive mode on a first visit, on the opening slide', async () => {
      await seed()
      modeCookie = undefined
      const { container } = await renderPage()

      expect(container.querySelector('[data-chapitre-mode]')).toHaveAttribute(
        'data-chapitre-mode',
        'interactif'
      )
      expect(screen.getByText('1 / 4')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).toBeVisible()
      // The other slides are in the page, hidden: nothing is fetched or remounted to show them.
      expect(screen.getByText('Le théorème de Pythagore.')).not.toBeVisible()
    })

    it('opens the slide named by ?diapo, whatever the cookie says', async () => {
      await seed()
      modeCookie = 'lecture'
      const { container } = await renderPage({ diapo: 'e1' })

      expect(container.querySelector('[data-chapitre-mode]')).toHaveAttribute(
        'data-chapitre-mode',
        'interactif'
      )
      expect(screen.getByText('3 / 4')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Vérifier' })).toBeVisible()
      expect(screen.getByText('Le théorème de Pythagore.')).not.toBeVisible()
    })
  })
})
