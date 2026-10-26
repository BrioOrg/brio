import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDeck } from '@brio/content'

vi.mock('@brio/api-client', () => ({ createApiClient: vi.fn() }))
vi.mock('@/lib/api', () => ({ soumettre: vi.fn(), marquerSectionLue: vi.fn() }))
vi.mock('@/lib/session', () => ({ getMoi: vi.fn() }))
vi.mock('@/lib/progression', () => ({
  getProgression: vi.fn(),
  getSerie: vi.fn(),
  getParcours: vi.fn(),
}))
// `motion` itself: every animation is recorded and lands at once.
vi.mock('../motion-animate', () => ({
  animate: vi.fn(() => ({ complete: vi.fn(), stop: vi.fn(), finished: Promise.resolve() })),
}))

import { marquerSectionLue, soumettre } from '@/lib/api'
import { getMoi } from '@/lib/session'
import { getParcours, getProgression, getSerie } from '@/lib/progression'
import { ProgressionProvider } from '@/components/progression-context'
import { ChapterView, exercicesCorriges, type ChapitreResponse } from '@/components/chapter-view'
import { ModeChapitreProvider } from '../mode-context'
import { BarreScene, CommandesScene } from '../scene'
import { animate } from '../motion-animate'

function qcm(id: string, exerciceId: string) {
  return {
    id,
    type: 'exercise' as const,
    exerciceId,
    exerciseType: 'multiple-choice' as const,
    prompt: "Quel côté est l'hypoténuse ?",
    choices: [
      { id: 'a', text: 'Le plus petit' },
      { id: 'b', text: "Celui en face de l'angle droit" },
    ],
  }
}

const CHAPITRE: ChapitreResponse = {
  id: 'pythagore',
  title: 'Le théorème de Pythagore',
  sections: [
    {
      id: 'lecon',
      title: 'Énoncé',
      kind: 'lesson',
      blocks: [qcm('qcm1', '11111111-1111-1111-1111-111111111111')],
    },
    {
      id: 'entrainement',
      title: "S'entraîner",
      kind: 'exercises',
      blocks: [qcm('qcm2', '22222222-2222-2222-2222-222222222222')],
    },
  ],
}

// debut · qcm1 · qcm2 · fin
const DECK = buildDeck(CHAPITRE)
const FIN = DECK.length - 1
const SUIVANT = { slug: 'fractions', titre: 'Les fractions', href: '/3e/mathematiques/fractions' }

const JUSTE = {
  soumissionId: 's1',
  correct: true,
  score: 1,
  choiceFeedback: [
    { choiceId: 'a', correct: false },
    { choiceId: 'b', correct: true },
  ],
  expectedValue: null,
  explanation: null,
}

const animer = vi.mocked(animate)

function reducedMotion(reduit: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduit && query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  )
}

function parcours(pourcentage: number, etatSuivant = 'en_cours') {
  return [
    { chapitreId: 'pythagore', ordre: 1, etat: 'en_cours', pourcentage },
    { chapitreId: 'fractions', ordre: 2, etat: etatSuivant, pourcentage: 0 },
  ]
}

function ouvrir(index: number, suivant: typeof SUIVANT | null = SUIVANT) {
  return render(
    <ProgressionProvider>
      <ModeChapitreProvider
        chapitreId={CHAPITRE.id}
        deck={DECK}
        exercices={exercicesCorriges(CHAPITRE)}
        sectionTitles={{ lecon: 'Énoncé', entrainement: "S'entraîner" }}
        chemin="/3e/mathematiques/pythagore"
        parcoursHref="/3e/mathematiques"
        niveau="3e"
        matiere="mathematiques"
        slug="pythagore"
        suivant={suivant}
        initialMode="interactif"
        initialIndex={index}
      >
        <BarreScene />
        <ChapterView chapitre={CHAPITRE} deck={DECK} />
        <CommandesScene />
      </ModeChapitreProvider>
    </ProgressionProvider>
  )
}

function fin(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-diapo="fin"]')!
}

/** Solves qcm1 (+10 XP, really), then leaves qcm2 with no answer and reaches the end. */
async function resoudrePuisPasser() {
  ouvrir(DECK.findIndex((d) => d.id === 'qcm1'))
  await waitFor(() => expect(document.querySelector('[data-compteur-xp]')).not.toBeNull())
  vi.mocked(getProgression).mockResolvedValue({ xpTotal: 110, niveau: 1 })
  vi.mocked(soumettre).mockResolvedValue(JUSTE)
  fireEvent.click(screen.getByRole('button', { name: /^Option B:/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))
  await screen.findByText(/\+10/, { selector: '[data-feuille-resultat] *' })
  fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
  // Entering the end records the last section; progression has the new completion.
  vi.mocked(getParcours).mockResolvedValue(parcours(70))
  fireEvent.click(await screen.findByRole('button', { name: 'Passer' }))
  await waitFor(() => expect(fin().hidden).toBe(false))
}

beforeEach(() => {
  reducedMotion(true)
  window.scrollTo = vi.fn()
  window.history.replaceState(null, '', '/3e/mathematiques/pythagore')
  vi.mocked(getMoi).mockResolvedValue({ role: 'eleve' } as never)
  vi.mocked(marquerSectionLue).mockResolvedValue(undefined)
  vi.mocked(getProgression).mockResolvedValue({ xpTotal: 100, niveau: 1 })
  vi.mocked(getSerie).mockResolvedValue({ joursConsecutifs: 3 } as never)
  vi.mocked(getParcours).mockResolvedValue(parcours(40))
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('the end slide — a summary made of real data (#249)', () => {
  it('sums up the session: solved, real XP, completion moved, the exercise left aside', async () => {
    await resoudrePuisPasser()
    const slide = within(fin())

    expect(slide.getByRole('heading', { name: 'Beau travail !' })).toBeTruthy()
    expect(slide.getByText('1 exercice réussi')).toBeTruthy()
    expect(slide.getByText('+10 XP', { selector: '.sr-only' })).toBeTruthy()
    await waitFor(() =>
      expect(slide.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('70')
    )
    expect(slide.getByRole('link', { name: "Exercice 2 · S'entraîner" })).toBeTruthy()
    expect(slide.getByRole('link', { name: /Chapitre suivant : Les fractions/ })).toBeTruthy()
    expect(slide.getByRole('button', { name: 'Relire en mode lecture' })).toBeTruthy()
  })

  it('opens the exercise left with no answer from its link', async () => {
    await resoudrePuisPasser()
    fireEvent.click(within(fin()).getByRole('link', { name: "Exercice 2 · S'entraîner" }))
    await waitFor(() =>
      expect(document.querySelector<HTMLElement>('[data-diapo="qcm2"]')!.hidden).toBe(false)
    )
    expect(window.location.search).toBe('?diapo=qcm2')
  })

  it('given a teacher, then no XP and no completion line: nothing the backend did not give', async () => {
    vi.mocked(getMoi).mockResolvedValue({ role: 'enseignant' } as never)
    ouvrir(FIN)
    const slide = within(fin())
    expect(slide.getByRole('heading', { name: 'Fin du chapitre' })).toBeTruthy()
    await act(async () => {})
    expect(fin().querySelector('[data-bilan="xp"]')).toBeNull()
    expect(fin().querySelector('[data-bilan="completion"]')).toBeNull()
    expect(fin().querySelector('[data-bilan="reussis"]')).toBeNull()
    expect(getParcours).not.toHaveBeenCalled()
    // No path to lock it: the next chapter is offered, as the neutral atlas does.
    expect(slide.getByRole('link', { name: /Chapitre suivant/ })).toBeTruthy()
  })

  it('given a failed read of the path, then no completion line rather than a 0', async () => {
    vi.mocked(getParcours).mockRejectedValue(new Error('réseau'))
    ouvrir(FIN)
    await act(async () => {})
    expect(fin().querySelector('[data-bilan="completion"]')).toBeNull()
  })

  it('given the next chapter still locked on the path, then it is offered all the same', async () => {
    // Every chapter is open (#278): the backend's `verrouille` no longer hides it.
    vi.mocked(getParcours).mockResolvedValue(parcours(40, 'verrouille'))
    ouvrir(FIN)
    const slide = within(fin())
    await waitFor(() => expect(getParcours).toHaveBeenCalled())
    await act(async () => {})
    expect(slide.getByRole('link', { name: /Chapitre suivant : Les fractions/ })).toBeTruthy()
  })

  it('given the last chapter of the track, then the main action is the path', () => {
    ouvrir(FIN, null)
    expect(within(fin()).getByRole('link', { name: 'Revenir au parcours' })).toBeTruthy()
  })

  it('shows the completion still when it did not move, and « Chapitre terminé » at 100 %', async () => {
    vi.mocked(getParcours).mockResolvedValue(parcours(100))
    ouvrir(FIN)
    await within(fin()).findByText('Chapitre terminé')
    expect(within(fin()).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
  })

  it('celebrates every exercise solved with the double burst, after the count', async () => {
    reducedMotion(false)
    ouvrir(DECK.findIndex((d) => d.id === 'qcm1'))
    await waitFor(() =>
      expect(document.querySelector('[data-transitions="pretes"]')).not.toBeNull()
    )
    vi.mocked(soumettre).mockResolvedValue(JUSTE)
    for (const n of [1, 2]) {
      vi.mocked(getProgression).mockResolvedValue({ xpTotal: 100 + 10 * n, niveau: 1 })
      fireEvent.click(screen.getByRole('button', { name: /^Option B:/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))
      await screen.findByText(/\+10/, { selector: '[data-feuille-resultat] *' })
      animer.mockClear()
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
      if (n === 1)
        await waitFor(() =>
          expect(screen.getAllByRole('button', { name: /^Option B:/ })).toHaveLength(1)
        )
    }
    await waitFor(() => expect(fin().hidden).toBe(false))

    expect(
      within(fin()).getByRole('heading', { name: 'Tous les exercices réussis !' })
    ).toBeTruthy()
    expect(within(fin()).getByText('2 exercices réussis')).toBeTruthy()
    // The session XP counts from 0, at a linear pace over `finale`.
    const compte = animer.mock.calls.find(
      (c) => (c[0] as unknown) === 0 && (c[1] as unknown) === 20
    )
    expect(compte?.[2]).toMatchObject({ duration: 0.9, ease: 'linear' })
    // Twice the particles, starting once the count is done.
    const particules = animer.mock.calls.filter((c) => typeof c[1] === 'object' && 'rotate' in c[1])
    expect(particules).toHaveLength(42)
    expect((particules[0][2] as { delay: number }).delay).toBeGreaterThan(0.9)
  })

  it('given reduced motion, then the values are there at once: no count, no burst', async () => {
    await resoudrePuisPasser()
    expect(within(fin()).getByText('+10 XP', { selector: '[aria-hidden="true"]' })).toBeTruthy()
    expect(animer.mock.calls.filter((c) => typeof c[0] === 'number')).toHaveLength(0)
    expect(
      animer.mock.calls.filter((c) => typeof c[1] === 'object' && 'rotate' in c[1])
    ).toHaveLength(0)
  })
})
