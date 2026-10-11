import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDeck } from '@brio/content'

vi.mock('@brio/api-client', () => ({ createApiClient: vi.fn() }))
vi.mock('@/lib/api', () => ({ soumettre: vi.fn(), marquerSectionLue: vi.fn() }))
vi.mock('@/lib/session', () => ({ getMoi: vi.fn() }))
vi.mock('@/lib/progression', () => ({ getProgression: vi.fn(), getSerie: vi.fn() }))
// `motion` itself: every animation is recorded and lands at once.
vi.mock('../motion-animate', () => ({
  animate: vi.fn(() => ({ complete: vi.fn(), stop: vi.fn(), finished: Promise.resolve() })),
}))

import { marquerSectionLue, soumettre } from '@/lib/api'
import { getMoi } from '@/lib/session'
import { getProgression, getSerie } from '@/lib/progression'
import { ProgressionProvider } from '@/components/progression-context'
import { ChapterView, exercicesCorriges, type ChapitreResponse } from '@/components/chapter-view'
import { ModeChapitreProvider } from '../mode-context'
import { BarreScene, CommandesScene } from '../scene'
import { animate } from '../motion-animate'

const QCM = '11111111-1111-1111-1111-111111111111'

const CHAPITRE: ChapitreResponse = {
  id: 'pythagore',
  title: 'Le théorème de Pythagore',
  sections: [
    {
      id: 'lecon',
      title: 'Énoncé',
      kind: 'lesson',
      blocks: [
        {
          id: 'qcm',
          type: 'exercise',
          exerciceId: QCM,
          exerciseType: 'multiple-choice',
          prompt: "Quel côté est l'hypoténuse ?",
          choices: [
            { id: 'a', text: 'Le plus petit' },
            { id: 'b', text: "Celui en face de l'angle droit" },
          ],
          explanation: "L'hypoténuse fait face à l'angle droit.",
        },
      ],
    },
  ],
}

const DECK = buildDeck(CHAPITRE)

const JUSTE = {
  soumissionId: 's1',
  correct: true,
  score: 1,
  choiceFeedback: [
    { choiceId: 'a', correct: false },
    { choiceId: 'b', correct: true },
  ],
  expectedValue: null,
  explanation: "L'hypoténuse fait face à l'angle droit.",
}
const FAUX = { ...JUSTE, soumissionId: 's2', correct: false, score: 0, explanation: null }

const animer = vi.mocked(animate)

/** Every element `motion` was asked to animate (numbers, for the count-up, left out). */
function cibles(): Element[] {
  return animer.mock.calls.map((c) => c[0]).filter((c): c is Element => c instanceof Element)
}

/** The "+N XP" copies that flew to the top bar. */
function envols(): Element[] {
  return cibles().filter(
    (el) => el.closest('[data-feuille-resultat]') === null && /XP/.test(el.textContent ?? '')
  )
}

function compteurXp(): string {
  return document.querySelector('[data-compteur-xp]')?.textContent ?? ''
}

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

async function ouvrir() {
  render(
    <ProgressionProvider>
      <ModeChapitreProvider
        chapitreId={CHAPITRE.id}
        deck={DECK}
        exercices={exercicesCorriges(CHAPITRE)}
        sectionTitles={{ lecon: 'Énoncé' }}
        chemin="/3e/mathematiques/pythagore"
        parcoursHref="/3e/mathematiques"
        initialMode="interactif"
        initialIndex={DECK.findIndex((d) => d.id === 'qcm')}
      >
        <BarreScene />
        <ChapterView chapitre={CHAPITRE} deck={DECK} />
        <CommandesScene />
      </ModeChapitreProvider>
    </ProgressionProvider>
  )
  await screen.findByRole('button', { name: 'Vérifier' })
  // The student's counters are there, and `motion` has loaded.
  await waitFor(() => expect(compteurXp()).toContain('100'))
  await waitFor(() => expect(document.querySelector('[data-transitions="pretes"]')).not.toBeNull())
  animer.mockClear()
}

function repondre(marker: 'A' | 'B') {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Option ${marker}:`) }))
  fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))
}

beforeEach(() => {
  reducedMotion(false)
  window.scrollTo = vi.fn()
  window.history.replaceState(null, '', '/3e/mathematiques/pythagore')
  vi.mocked(getMoi).mockResolvedValue({ role: 'eleve' } as never)
  vi.mocked(marquerSectionLue).mockResolvedValue(undefined)
  vi.mocked(getProgression).mockResolvedValue({ xpTotal: 100, niveau: 1 })
  vi.mocked(getSerie).mockResolvedValue({ joursConsecutifs: 3 } as never)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('interactive mode — the rewards of an exercise (#248)', () => {
  it('pops the badge of the option being picked, and only that one', async () => {
    await ouvrir()
    fireEvent.click(screen.getByRole('button', { name: /^Option B:/ }))

    const pastille = screen
      .getByRole('button', { name: /^Option B:/ })
      .querySelector('[data-pastille]')
    expect(cibles()).toEqual([pastille])
    expect(animer.mock.calls[0][1]).toEqual({ scale: [0.7, 1] })
  })

  it('celebrates a right answer: check mark, particles, then the real XP flies and counts up', async () => {
    await ouvrir()
    vi.mocked(getProgression).mockResolvedValue({ xpTotal: 110, niveau: 1 })
    vi.mocked(soumettre).mockResolvedValue(JUSTE)
    repondre('B')

    await screen.findByText('Bien vu !')
    const icone = document.querySelector('[data-icone-resultat]')
    expect(cibles()).toContain(icone)
    // The particles: each one spins (and is removed once it has landed).
    const particules = animer.mock.calls.filter((c) => 'rotate' in (c[1] as object))
    expect(particules).toHaveLength(21)

    // The gain is known, but the counter keeps the old total until the flight lands.
    await screen.findByText(/\+10/)
    expect(compteurXp()).toContain('100')
    expect(envols()).toHaveLength(0)

    await waitFor(() => expect(envols()).toHaveLength(1), { timeout: 2000 })
    await waitFor(() => expect(compteurXp()).toContain('110'))
    expect(cibles()).toContain(document.querySelector('[data-compteur-xp]'))
  })

  it('flies nothing when the answer earned no XP', async () => {
    await ouvrir()
    vi.mocked(soumettre).mockResolvedValue(JUSTE) // total unchanged: cap reached
    repondre('B')

    await screen.findByText('Bien vu !')
    await waitFor(() => expect(getSerie).toHaveBeenCalledTimes(2), { timeout: 2000 })
    await act(() => new Promise((r) => setTimeout(r, 900)))
    expect(envols()).toHaveLength(0)
    expect(screen.queryByText(/\+\d+/)).toBeNull()
    expect(cibles()).not.toContain(document.querySelector('[data-compteur-xp]'))
    expect(compteurXp()).toContain('100')
  })

  it('animates nothing on a wrong answer: the amber sheet is simply there', async () => {
    await ouvrir()
    vi.mocked(soumettre).mockResolvedValue(FAUX)
    fireEvent.click(screen.getByRole('button', { name: /^Option A:/ }))
    animer.mockClear() // the pick's own pop
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    await screen.findByText('Pas tout à fait…')
    await act(() => new Promise((r) => setTimeout(r, 900)))
    expect(cibles()).toEqual([])
    expect(document.querySelector('[data-feuille-resultat]')?.className).not.toMatch(/animate-/)
    expect(getProgression).toHaveBeenCalledTimes(1) // mount only: no re-read, no gain
  })

  it('moves nothing under reduced motion, and the counter shows the real total at once', async () => {
    reducedMotion(true)
    await ouvrir()
    vi.mocked(getProgression).mockResolvedValue({ xpTotal: 110, niveau: 1 })
    vi.mocked(soumettre).mockResolvedValue(JUSTE)
    fireEvent.click(screen.getByRole('button', { name: /^Option B:/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    await screen.findByText(/\+10/)
    expect(compteurXp()).toContain('110')
    await act(() => new Promise((r) => setTimeout(r, 900)))
    expect(cibles()).toEqual([])
  })

  it('ends the sequence on any key: no flight, the real total at once', async () => {
    await ouvrir()
    vi.mocked(getProgression).mockResolvedValue({ xpTotal: 110, niveau: 1 })
    vi.mocked(soumettre).mockResolvedValue(JUSTE)
    repondre('B')

    await screen.findByText(/\+10/)
    expect(compteurXp()).toContain('100')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    })
    expect(compteurXp()).toContain('110')
    await act(() => new Promise((r) => setTimeout(r, 900)))
    expect(envols()).toHaveLength(0)
  })

  it('bumps the flame after the XP when the streak moved, and holds it until then', async () => {
    vi.mocked(getSerie).mockResolvedValueOnce({ joursConsecutifs: 0 } as never)
    await ouvrir()
    expect(document.querySelector('[data-compteur-serie]')).toBeNull() // never "0 jour"
    vi.mocked(getProgression).mockResolvedValue({ xpTotal: 110, niveau: 1 })
    vi.mocked(getSerie).mockResolvedValue({ joursConsecutifs: 1 } as never)
    vi.mocked(soumettre).mockResolvedValue(JUSTE)
    repondre('B')

    await screen.findByText(/\+10/)
    expect(document.querySelector('[data-compteur-serie]')).toBeNull()

    await waitFor(() => expect(document.querySelector('[data-compteur-serie]')).not.toBeNull(), {
      timeout: 2000,
    })
    const flamme = document.querySelector('[data-compteur-serie]')
    await waitFor(() => expect(cibles()).toContain(flamme))
    expect(flamme?.textContent).toContain('1')
  })

  it('leaves the flame still when the streak did not move', async () => {
    await ouvrir()
    vi.mocked(getProgression).mockResolvedValue({ xpTotal: 110, niveau: 1 })
    vi.mocked(soumettre).mockResolvedValue(JUSTE)
    repondre('B')

    await waitFor(() => expect(compteurXp()).toContain('110'), { timeout: 2000 })
    expect(cibles()).not.toContain(document.querySelector('[data-compteur-serie]'))
  })
})
