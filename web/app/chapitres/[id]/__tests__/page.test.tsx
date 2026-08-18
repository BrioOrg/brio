import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@brio/api-client', () => ({
  createApiClient: vi.fn(),
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
          exerciseType: 'multiple-choice',
          prompt: "Quel côté est l'hypoténuse ?",
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
    const { createApiClient } = await import('@brio/api-client')
    vi.mocked(createApiClient).mockReturnValue({
      GET: vi.fn().mockResolvedValue({ data: SEED_CHAPTER, error: undefined }),
    } as never)

    const { default: Page } = await import('../page')
    render(await Page({ params: Promise.resolve({ id: 'theoreme-de-pythagore' }) }))

    expect(screen.getByRole('heading', { name: 'Le théorème de Pythagore' })).toBeInTheDocument()
    expect(screen.getByText('Le théorème de Pythagore.')).toBeInTheDocument()
  })

  it("affiche la question de l'exercice sans champ de réponse", async () => {
    const { createApiClient } = await import('@brio/api-client')
    vi.mocked(createApiClient).mockReturnValue({
      GET: vi.fn().mockResolvedValue({ data: SEED_CHAPTER, error: undefined }),
    } as never)

    const { default: Page } = await import('../page')
    render(await Page({ params: Promise.resolve({ id: 'theoreme-de-pythagore' }) }))

    expect(screen.getByText(/Quel côté est l'hypoténuse/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it("affiche l'état d'erreur quand le chapitre est introuvable", async () => {
    const { createApiClient } = await import('@brio/api-client')
    vi.mocked(createApiClient).mockReturnValue({
      GET: vi.fn().mockResolvedValue({ data: undefined, error: { message: 'Not found' } }),
    } as never)

    const { default: Page } = await import('../page')
    render(await Page({ params: Promise.resolve({ id: 'inconnu' }) }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Chapitre introuvable')).toBeInTheDocument()
  })
})
