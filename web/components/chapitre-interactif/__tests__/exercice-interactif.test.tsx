import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDeck } from '@brio/content'

vi.mock('@brio/api-client', () => ({ createApiClient: vi.fn() }))
vi.mock('@/lib/api', () => ({ soumettre: vi.fn(), marquerSectionLue: vi.fn() }))
vi.mock('@/lib/session', () => ({ getMoi: vi.fn() }))

import { marquerSectionLue, soumettre } from '@/lib/api'
import { getMoi } from '@/lib/session'
import { ChapterView, exercicesCorriges, type ChapitreResponse } from '@/components/chapter-view'
import { ModeChapitreProvider } from '../mode-context'
import { BandeDiapos, BasculeInteractif, CommandesScene } from '../scene'
import type { ModeChapitre } from '@/lib/diapos'

const QCM = '11111111-1111-1111-1111-111111111111'
const NUMERIQUE = '22222222-2222-2222-2222-222222222222'

const CHAPITRE: ChapitreResponse = {
  id: 'pythagore',
  title: 'Le théorème de Pythagore',
  sections: [
    {
      id: 'lecon',
      title: 'Énoncé',
      kind: 'lesson',
      blocks: [
        { id: 'def', type: 'callout', variant: 'definition', text: "L'hypoténuse." },
        {
          id: 'qcm',
          type: 'exercise',
          exerciceId: QCM,
          exerciseType: 'multiple-choice',
          prompt: "Quel côté est l'hypoténuse ?",
          choices: [
            { id: 'a', text: 'Le plus petit' },
            { id: 'b', text: "Celui en face de l'angle droit" },
            { id: 'c', text: 'Un côté de l’angle droit' },
          ],
        },
        {
          id: 'num',
          type: 'exercise',
          exerciceId: NUMERIQUE,
          exerciseType: 'numeric',
          prompt: 'Calcule BC.',
          unit: 'cm',
        },
        {
          id: 'feuille',
          type: 'exercise',
          exerciseType: 'paper',
          prompt: 'Démontre que ABC est rectangle.',
          solution: 'Réciproque de Pythagore.',
        },
      ],
    },
  ],
}

// debut · def · qcm · num · feuille · fin
const DECK = buildDeck(CHAPITRE)
const CHEMIN = '/3e/mathematiques/pythagore'

const JUSTE = {
  soumissionId: 's1',
  correct: true,
  score: 1,
  choiceFeedback: [
    { choiceId: 'a', correct: false },
    { choiceId: 'b', correct: true },
    { choiceId: 'c', correct: false },
  ],
  expectedValue: null,
  explanation: "L'hypoténuse fait face à l'angle droit.",
}

// The backend sends feedback for every choice; only the student's pick may show (T0).
const FAUX = { ...JUSTE, soumissionId: 's2', correct: false, score: 0, explanation: null }

function renderChapitre(diapo: string, mode: ModeChapitre = 'interactif') {
  return render(
    <ModeChapitreProvider
      chapitreId={CHAPITRE.id}
      deck={DECK}
      exercices={exercicesCorriges(CHAPITRE)}
      sectionTitles={{ lecon: 'Énoncé' }}
      chemin={CHEMIN}
      parcoursHref="/3e/mathematiques"
      niveau="3e"
      matiere="mathematiques"
      slug="pythagore"
      initialMode={mode}
      initialIndex={DECK.findIndex((d) => d.id === diapo)}
    >
      <BandeDiapos />
      <BasculeInteractif />
      <ChapterView chapitre={CHAPITRE} deck={DECK} />
      <CommandesScene />
    </ModeChapitreProvider>
  )
}

function visibles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-diapo]:not([hidden])')).map(
    (el) => el.dataset.diapo ?? ''
  )
}

function touche(key: string, target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

function option(marker: string) {
  return screen.getByRole('button', { name: new RegExp(`^Option ${marker}:`) })
}

beforeEach(() => {
  // Slides swap at once under reduced motion. Otherwise, once `motion` has loaded (a race with
  // the awaited submissions here), the leaving slide stays visible during its exit. Transitions
  // have their own tests (mode-interactif.spec.ts).
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  )
  window.scrollTo = vi.fn()
  window.history.replaceState(null, '', CHEMIN)
  vi.mocked(getMoi).mockResolvedValue(null)
  vi.mocked(marquerSectionLue).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('interactive mode — a full-screen exercise', () => {
  it('lists the exercises a student can check: not the paper one', () => {
    expect(exercicesCorriges(CHAPITRE)).toEqual(['qcm', 'num'])
  })

  it('puts « Vérifier » in the bottom bar, once, and offers to skip', async () => {
    renderChapitre('qcm')

    const verifier = await screen.findByRole('button', { name: 'Vérifier' })
    expect(verifier).toHaveAttribute('type', 'submit')
    expect(screen.getAllByRole('button', { name: 'Vérifier' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Passer/ })).toBeInTheDocument()
  })

  it('picks an option by its letter or its number, then checks with Entrée', async () => {
    vi.mocked(soumettre).mockResolvedValue(JUSTE)
    renderChapitre('qcm')
    await screen.findByRole('button', { name: 'Vérifier' })

    touche('1')
    expect(option('A')).toHaveAttribute('aria-pressed', 'true')
    touche('b')
    expect(option('B')).toHaveAttribute('aria-pressed', 'true')
    expect(option('A')).not.toHaveAttribute('aria-pressed')
    touche('9') // no ninth option: nothing happens
    expect(option('B')).toHaveAttribute('aria-pressed', 'true')

    touche('Enter')
    await waitFor(() => expect(soumettre).toHaveBeenCalledWith(QCM, { choiceIds: ['b'] }))
  })

  it('opens the sheet on a right answer, with « Continuer » focused, which moves on', async () => {
    vi.mocked(soumettre).mockResolvedValue(JUSTE)
    const { container } = renderChapitre('qcm')
    await screen.findByRole('button', { name: 'Vérifier' })
    touche('B')
    touche('Enter')

    const continuer = await screen.findByRole('button', { name: 'Continuer' })
    await waitFor(() => expect(continuer).toHaveFocus())
    expect(screen.getByText('Bien vu !')).toBeInTheDocument()
    expect(screen.getByText("L'hypoténuse fait face à l'angle droit.")).toBeInTheDocument()
    // The bar's own buttons step aside under the sheet.
    expect(screen.getByRole('button', { name: /Précédent/ }).closest('[inert]')).not.toBeNull()

    fireEvent.click(continuer)
    expect(visibles(container)).toEqual(['num'])
    expect(screen.queryByText('Bien vu !')).not.toBeInTheDocument()
  })

  it('never reveals the answer on a wrong one, and « Réessayer » takes Entrée', async () => {
    vi.mocked(soumettre).mockResolvedValue(FAUX)
    const { container } = renderChapitre('qcm')
    await screen.findByRole('button', { name: 'Vérifier' })
    touche('A')
    touche('Enter')

    const reessayer = await screen.findByRole('button', { name: 'Réessayer' })
    await waitFor(() => expect(reessayer).toHaveFocus())
    expect(screen.getByText('Pas tout à fait…')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Revoir : Énoncé/ })).toBeInTheDocument()
    // Only the student's pick is marked; the right option is never highlighted.
    expect(option('A').getAttribute('aria-label')).toMatch(/wrong$/)
    expect(option('B').getAttribute('aria-label')).toMatch(/muted$/)
    expect(screen.queryByText(/angle droit\.$/)).not.toBeInTheDocument()
    // Moving on stays possible.
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeInTheDocument()

    fireEvent.click(reessayer)
    expect(screen.queryByText('Pas tout à fait…')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText("Quel côté est l'hypoténuse ?")).toHaveFocus())
    expect(option('A')).not.toHaveAttribute('aria-pressed')
    expect(visibles(container)).toEqual(['qcm'])
  })

  it('leaves digits typed in a field to the field, and checks it with Entrée', async () => {
    vi.mocked(soumettre).mockResolvedValue({ ...JUSTE, choiceFeedback: [], expectedValue: 5 })
    renderChapitre('num')
    await screen.findByRole('button', { name: 'Vérifier' })

    const champ = screen.getByLabelText('Ta réponse')
    fireEvent.change(champ, { target: { value: '5' } })
    touche('1', champ)
    touche('ArrowRight', champ)
    expect(champ).toHaveValue(5)

    fireEvent.submit(champ.closest('form') as HTMLFormElement)
    await waitFor(() => expect(soumettre).toHaveBeenCalledWith(NUMERIQUE, { value: 5 }))
  })

  it('shows an answered exercise without its sheet when the student comes back', async () => {
    vi.mocked(soumettre).mockResolvedValue(FAUX)
    renderChapitre('qcm')
    await screen.findByRole('button', { name: 'Vérifier' })
    touche('A')
    touche('Enter')
    fireEvent.click(await screen.findByRole('button', { name: 'Continuer' }))
    touche('ArrowLeft')

    expect(screen.queryByText('Pas tout à fait…')).not.toBeInTheDocument()
    expect(option('A').getAttribute('aria-label')).toMatch(/wrong$/)
    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeInTheDocument()
  })

  it('marks in the strip an exercise left without an answer, and one solved', async () => {
    vi.mocked(soumettre).mockResolvedValue({ ...JUSTE, choiceFeedback: [], expectedValue: 5 })
    renderChapitre('qcm')
    await screen.findByRole('button', { name: 'Vérifier' })
    const bande = screen.getByRole('navigation', { name: 'Diapos du chapitre' })
    // Not yet: the student is still on it.
    expect(within(bande).getByRole('link', { name: /Diapo 3 sur 6/ })).not.toHaveAccessibleName(
      /Sans réponse/
    )

    fireEvent.click(screen.getByRole('button', { name: /Passer/ }))
    expect(within(bande).getByRole('link', { name: /Diapo 3 sur 6/ })).toHaveAccessibleName(
      /Sans réponse$/
    )
    // Not seen yet: says nothing.
    expect(within(bande).getByRole('link', { name: /Diapo 5 sur 6/ })).not.toHaveAccessibleName(
      /Sans réponse/
    )

    fireEvent.change(screen.getByLabelText('Ta réponse'), { target: { value: '5' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Vérifier' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continuer' }))
    expect(within(bande).getByRole('link', { name: /Diapo 4 sur 6/ })).toHaveAccessibleName(
      /Réussi$/
    )
    // A paper exercise is self-assessed: it is never marked.
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }))
    expect(within(bande).getByRole('link', { name: /Diapo 5 sur 6/ })).not.toHaveAccessibleName(
      /Sans réponse/
    )
  })

  it('keeps the reading mode as it was: inline result, no sheet', async () => {
    vi.mocked(soumettre).mockResolvedValue(FAUX)
    renderChapitre('qcm', 'lecture')

    fireEvent.click(option('A'))
    const form = option('A').closest('form') as HTMLFormElement
    fireEvent.click(within(form).getByRole('button', { name: 'Vérifier' }))

    expect(await screen.findByText('Pas tout à fait…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continuer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Passer/ })).not.toBeInTheDocument()
  })
})
