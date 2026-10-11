import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDeck } from '@brio/content'

vi.mock('@brio/api-client', () => ({
  createApiClient: vi.fn(),
  controleActif: vi.fn().mockResolvedValue({ enControle: false, titre: null, echeanceAt: null }),
  examenActif: vi
    .fn()
    .mockResolvedValue({ enExamen: false, annaleId: null, titre: null, endsAt: null }),
}))
vi.mock('@/lib/api', () => ({
  soumettre: vi.fn(),
  marquerSectionLue: vi.fn(),
  askTuteurForTarget: vi.fn(),
}))
vi.mock('@/lib/session', () => ({ getMoi: vi.fn(async () => null) }))
vi.mock('@/lib/progression', () => ({
  getProgression: vi.fn(async () => null),
  getSerie: vi.fn(async () => null),
  getParcours: vi.fn(async () => null),
}))
vi.mock('@/components/entraide/entraide-panel', () => ({
  EntraidePanel: ({ portee, porteeRef }: { portee: string; porteeRef: string }) => (
    <p>
      entraide {portee} {porteeRef}
    </p>
  ),
}))

import { askTuteurForTarget } from '@/lib/api'
import { ChapterInteractionProvider } from '@/components/chapter-interaction-context'
import { ChapterView, exercicesParBloc, type ChapitreResponse } from '@/components/chapter-view'
import { ModeChapitreProvider } from '../mode-context'
import { BarreScene, CommandesScene } from '../scene'
import { AideScene } from '../aide-scene'

const EX1 = '11111111-1111-1111-1111-111111111111'

const CHAPITRE: ChapitreResponse = {
  id: 'pythagore',
  title: 'Le théorème de Pythagore',
  sections: [
    {
      id: 'lecon',
      title: 'Énoncé',
      kind: 'lesson',
      blocks: [
        { id: 'p1', type: 'prose', text: 'Le théorème relie les côtés.' },
        { id: 'def', type: 'callout', variant: 'definition', text: 'L’hypoténuse est le plus long.' },
        {
          id: 'ex1',
          type: 'exercise',
          exerciceId: EX1,
          exerciseType: 'short-answer',
          prompt: 'Nomme le plus grand côté.',
        },
      ],
    },
  ],
}

// debut · p1 (prose + definition) · ex1 · fin
const DECK = buildDeck(CHAPITRE)
const CHEMIN = '/3e/mathematiques/pythagore'
const TARGET = {
  kind: 'chapitre' as const,
  niveau: '3e',
  matiere: 'mathematiques',
  slug: 'pythagore',
}

function renderChapitre(index: number) {
  return render(
    <ModeChapitreProvider
      chapitreId={CHAPITRE.id}
      deck={DECK}
      sectionTitles={{ lecon: 'Énoncé' }}
      chemin={CHEMIN}
      parcoursHref="/3e/mathematiques"
      niveau="3e"
      matiere="mathematiques"
      slug="pythagore"
      initialMode="interactif"
      initialIndex={index}
    >
      <ChapterInteractionProvider>
        <BarreScene />
        <ChapterView chapitre={CHAPITRE} deck={DECK} />
        <CommandesScene />
        <AideScene target={TARGET} exercices={exercicesParBloc(CHAPITRE)} />
      </ChapterInteractionProvider>
    </ModeChapitreProvider>
  )
}

function touche(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

function visibles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-diapo]:not([hidden])')).map(
    (el) => el.dataset.diapo ?? ''
  )
}

beforeEach(() => {
  window.scrollTo = vi.fn()
  window.history.replaceState(null, '', CHEMIN)
  vi.mocked(askTuteurForTarget).mockResolvedValue({ reponse: 'Regarde la définition.', citations: [] })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('interactive mode — help drawer (#250)', () => {
  it('opens with T on an exercise slide, scoped to that exercise', async () => {
    const user = userEvent.setup()
    renderChapitre(2)

    touche('t')
    const tiroir = await screen.findByRole('dialog', { name: 'Besoin d’aide ?' })
    expect(within(tiroir).getByText('Ta question porte sur cet exercice.')).toBeInTheDocument()
    expect(within(tiroir).getByText(`entraide exercice ${EX1}`)).toBeInTheDocument()

    await user.type(within(tiroir).getByLabelText('Ta question au tuteur'), 'Un indice ?')
    await user.click(within(tiroir).getByRole('button', { name: /envoyer/i }))
    await waitFor(() =>
      expect(askTuteurForTarget).toHaveBeenCalledWith(TARGET, 'Un indice ?', EX1)
    )
  })

  it('opens with the floating button on a lesson slide, about the whole chapter', async () => {
    const user = userEvent.setup()
    renderChapitre(1)

    await user.click(screen.getByRole('button', { name: 'Aide' }))
    const tiroir = await screen.findByRole('dialog', { name: 'Besoin d’aide ?' })
    expect(within(tiroir).getByText('Ta question porte sur tout le chapitre.')).toBeInTheDocument()
    expect(within(tiroir).getByText('entraide chapitre pythagore')).toBeInTheDocument()

    await user.type(within(tiroir).getByLabelText('Ta question au tuteur'), 'Pourquoi ?')
    await user.click(within(tiroir).getByRole('button', { name: /envoyer/i }))
    await waitFor(() => expect(askTuteurForTarget).toHaveBeenCalledWith(TARGET, 'Pourquoi ?', null))
  })

  it('keeps the slide keys off while open, and leaves the student on the same slide', async () => {
    const user = userEvent.setup()
    const before = window.history.length
    const { container } = renderChapitre(1)

    touche('T')
    await screen.findByRole('dialog')
    touche('ArrowRight')
    expect(visibles(container)).toEqual(['p1'])

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(visibles(container)).toEqual(['p1'])
    expect(container.firstElementChild).toHaveAttribute('data-chapitre-mode', 'interactif')
    expect(window.location.search).toBe('?diapo=p1')
    expect(window.history.length).toBe(before)
  })

  it('opens the slide holding a cited block, and closes', async () => {
    vi.mocked(askTuteurForTarget).mockResolvedValue({
      reponse: 'Relis la définition.',
      citations: ['lecon/def'],
    })
    const user = userEvent.setup()
    const { container } = renderChapitre(2)

    touche('t')
    const tiroir = await screen.findByRole('dialog')
    await user.type(within(tiroir).getByLabelText('Ta question au tuteur'), 'Rappel ?')
    await user.click(within(tiroir).getByRole('button', { name: /envoyer/i }))
    await user.click(await within(tiroir).findByRole('button', { name: 'def' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // The exercise slide leaves with its transition, then only the cited slide shows.
    await waitFor(() => expect(visibles(container)).toEqual(['p1']))
    expect(window.location.search).toBe('?diapo=p1')
  })
})

describe('interactive mode — help drawer focus (#250)', () => {
  it('gives focus back to the button that opened it', async () => {
    const user = userEvent.setup()
    renderChapitre(1)
    const bouton = screen.getByRole('button', { name: 'Aide' })

    await user.click(bouton)
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(bouton).toHaveFocus()
  })
})
