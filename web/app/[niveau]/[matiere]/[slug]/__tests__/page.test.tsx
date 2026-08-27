import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@brio/api-client', () => ({
  createApiClient: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  getCatalogue: vi.fn(),
  getChapitreByTriplet: vi.fn(),
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

describe('ChapterPage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
  })

  it('affiche le titre et le contenu du chapitre', async () => {
    const { getChapitreByTriplet } = await import('@/lib/api')
    vi.mocked(getChapitreByTriplet).mockResolvedValue(SEED_CHAPTER as never)

    const { default: Page } = await import('../page')
    render(
      await Page({
        params: Promise.resolve({
          niveau: '3e',
          matiere: 'mathematiques',
          slug: 'theoreme-de-pythagore',
        }),
      })
    )

    expect(screen.getByRole('heading', { name: 'Le théorème de Pythagore' })).toBeInTheDocument()
    expect(screen.getByText('Le théorème de Pythagore.')).toBeInTheDocument()
  })

  it("affiche les choix de l'exercice à choix multiple", async () => {
    const { getChapitreByTriplet } = await import('@/lib/api')
    vi.mocked(getChapitreByTriplet).mockResolvedValue(SEED_CHAPTER as never)

    const { default: Page } = await import('../page')
    render(
      await Page({
        params: Promise.resolve({
          niveau: '3e',
          matiere: 'mathematiques',
          slug: 'theoreme-de-pythagore',
        }),
      })
    )

    expect(screen.getByText(/Quel côté est l'hypoténuse/)).toBeInTheDocument()
    // Choices are now hexagon OptionRow buttons, not radio inputs.
    expect(screen.getByRole('button', { name: /Le côté \[RS\]/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Le côté \[RT\]/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vérifier' })).toBeInTheDocument()
  })

  it("affiche l'état d'erreur quand le chapitre est introuvable", async () => {
    const { getChapitreByTriplet } = await import('@/lib/api')
    vi.mocked(getChapitreByTriplet).mockRejectedValue(new Error('Chapitre introuvable'))

    const { default: Page } = await import('../page')
    render(
      await Page({
        params: Promise.resolve({ niveau: '3e', matiere: 'mathematiques', slug: 'inconnu' }),
      })
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Chapitre introuvable')).toBeInTheDocument()
  })
})
