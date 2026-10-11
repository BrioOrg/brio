import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDeck } from '@brio/content'

vi.mock('@brio/api-client', () => ({ createApiClient: vi.fn() }))
vi.mock('@/lib/api', () => ({ soumettre: vi.fn(), marquerSectionLue: vi.fn() }))
vi.mock('@/lib/session', () => ({ getMoi: vi.fn() }))
vi.mock('@/lib/progression', () => ({
  getProgression: vi.fn(),
  getSerie: vi.fn(),
  getParcours: vi.fn(async () => null),
}))
// `motion` itself: every animation lands at once.
vi.mock('../motion-animate', () => ({
  animate: vi.fn(() => ({ complete: vi.fn(), stop: vi.fn(), finished: Promise.resolve() })),
}))

import { marquerSectionLue, soumettre } from '@/lib/api'
import { getMoi } from '@/lib/session'
import { getProgression, getSerie } from '@/lib/progression'
import { ProgressionProvider } from '@/components/progression-context'
import { ChapterView, exercicesCorriges, type ChapitreResponse } from '@/components/chapter-view'
import type { ModeChapitre } from '@/lib/diapos'
import { sons, type NomSon } from '@/lib/sound-tokens'
import { ModeChapitreProvider } from '../mode-context'
import { BarreScene, BasculeInteractif, CommandesScene } from '../scene'
import { reinitialiserSons } from '../sons'

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
        },
      ],
    },
  ],
}

// debut · qcm · fin
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

// --- A fake Web Audio: what was created, and which notes each sound started. ---

/** `t` marks the start of a sound (it reads the clock once), then one entry per note. */
let journal: ('t' | readonly [string, number])[] = []
const contextesCrees = vi.fn()

class FauxAudioContext {
  state = 'running'
  destination = {}
  constructor() {
    contextesCrees()
  }
  get currentTime() {
    journal.push('t')
    return 0
  }
  createGain() {
    const param = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
    return { gain: param, connect: vi.fn(), disconnect: vi.fn() }
  }
  createOscillator() {
    const osc = {
      type: '',
      frequency: {
        setValueAtTime: (f: number) => journal.push([osc.type, f]),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    }
    return osc
  }
  resume = vi.fn(async () => {})
  suspend = vi.fn(async () => {})
}

/** The sounds played so far, recognised by their wave and their notes. */
function joues(): NomSon[] {
  const groupes: (readonly [string, number])[][] = []
  for (const entree of journal) {
    if (entree === 't') groupes.push([])
    else groupes[groupes.length - 1].push(entree)
  }
  return groupes.map((notes) => {
    const nom = (Object.keys(sons) as NomSon[]).find(
      (n) =>
        sons[n].notes.length === notes.length &&
        sons[n].notes.every((note, i) => notes[i][0] === sons[n].wave && notes[i][1] === note.freq)
    )
    if (!nom) throw new Error(`unknown sound: ${JSON.stringify(notes)}`)
    return nom
  })
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

function compteurXp(): string {
  return document.querySelector('[data-compteur-xp]')?.textContent ?? ''
}

async function ouvrir(mode: ModeChapitre = 'interactif') {
  render(
    <ProgressionProvider>
      <ModeChapitreProvider
        chapitreId={CHAPITRE.id}
        deck={DECK}
        exercices={exercicesCorriges(CHAPITRE)}
        sectionTitles={{ lecon: 'Énoncé' }}
        chemin="/3e/mathematiques/pythagore"
        parcoursHref="/3e/mathematiques"
        niveau="3e"
        matiere="mathematiques"
        slug="pythagore"
        initialMode={mode}
        initialIndex={DECK.findIndex((d) => d.id === 'qcm')}
      >
        <BarreScene />
        <BasculeInteractif />
        <ChapterView chapitre={CHAPITRE} deck={DECK} />
        <CommandesScene />
      </ModeChapitreProvider>
    </ProgressionProvider>
  )
  if (mode === 'lecture') return
  await screen.findByRole('button', { name: 'Vérifier' })
  await waitFor(() => expect(compteurXp()).toContain('100'))
}

/** Picks B, checks it (right, 10 XP), waits for the gain to land, then « Continuer ». */
async function reussirEtContinuer() {
  vi.mocked(getProgression).mockResolvedValue({ xpTotal: 110, niveau: 1 })
  vi.mocked(soumettre).mockResolvedValue(JUSTE)
  fireEvent.click(screen.getByRole('button', { name: /^Option B:/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))
  await screen.findByText('Bien vu !')
  await waitFor(() => expect(compteurXp()).toContain('110'), { timeout: 2000 })
  fireEvent.click(await screen.findByRole('button', { name: 'Continuer' }))
  await screen.findByText('Tous les exercices réussis !')
}

/** Turns sound on, then lets its confirmation tick pass: the same sound twice in a row is one. */
async function activer() {
  fireEvent.click(bouton())
  await act(() => new Promise((r) => setTimeout(r, 120)))
}

function bouton(): HTMLElement {
  return screen.getByRole('button', { name: 'Sons' })
}

function touche(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

beforeEach(() => {
  journal = []
  reducedMotion(false)
  vi.stubGlobal('AudioContext', FauxAudioContext)
  window.scrollTo = vi.fn()
  window.history.replaceState(null, '', '/3e/mathematiques/pythagore')
  vi.mocked(getMoi).mockResolvedValue({ role: 'eleve' } as never)
  vi.mocked(marquerSectionLue).mockResolvedValue(undefined)
  vi.mocked(getProgression).mockResolvedValue({ xpTotal: 100, niveau: 1 })
  vi.mocked(getSerie).mockResolvedValue({ joursConsecutifs: 3 } as never)
})

afterEach(() => {
  reinitialiserSons()
  window.localStorage.clear()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('interactive mode — sounds (#251)', () => {
  it('is silent by default: no audio is even created, whatever the student does', async () => {
    await ouvrir()
    expect(bouton()).toHaveAttribute('aria-pressed', 'false')

    await reussirEtContinuer()
    await act(() => new Promise((r) => setTimeout(r, 1500))) // past the end slide's count
    fireEvent.click(screen.getByRole('button', { name: /Précédent/ }))

    expect(contextesCrees).not.toHaveBeenCalled()
    expect(journal).toEqual([])
  })

  it('once on, plays each moment: press, pick, right answer, real XP, end of chapter', async () => {
    await ouvrir()
    await activer()
    expect(bouton()).toHaveAttribute('aria-pressed', 'true')
    expect(joues()).toEqual(['appui']) // the switch confirms itself

    await reussirEtContinuer()
    // The end slide's sound lands with its burst, after the count.
    await waitFor(() => expect(joues()).toContain('fin-complet'), { timeout: 3000 })
    expect(joues()).toEqual([
      'appui',
      'selection',
      'appui', // « Vérifier »
      'juste',
      'xp',
      'appui', // « Continuer » and the slide change it causes: one press, one sound
      'fin-complet',
    ])
    expect(contextesCrees).toHaveBeenCalledTimes(1)
  })

  it('has no failure sound', async () => {
    await ouvrir()
    await activer()
    vi.mocked(soumettre).mockResolvedValue(FAUX)
    fireEvent.click(screen.getByRole('button', { name: /^Option A:/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    await screen.findByText('Pas tout à fait…')
    await act(() => new Promise((r) => setTimeout(r, 1200)))
    expect(joues()).toEqual(['appui', 'selection', 'appui'])
  })

  it('still plays the right answer and the XP under reduced motion: sound is its own choice', async () => {
    reducedMotion(true)
    await ouvrir()
    await activer()
    vi.mocked(getProgression).mockResolvedValue({ xpTotal: 110, niveau: 1 })
    vi.mocked(soumettre).mockResolvedValue(JUSTE)
    fireEvent.click(screen.getByRole('button', { name: /^Option B:/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    await waitFor(() => expect(joues()).toContain('xp'), { timeout: 2000 })
    expect(joues()).toEqual(['appui', 'selection', 'appui', 'juste', 'xp'])
  })

  it('is remembered on the device, and M turns it off and on', async () => {
    window.localStorage.setItem('brio_sons', '1')
    await ouvrir()
    expect(bouton()).toHaveAttribute('aria-pressed', 'true')

    touche('m')
    expect(bouton()).toHaveAttribute('aria-pressed', 'false')
    expect(window.localStorage.getItem('brio_sons')).toBeNull()
    touche('M')
    expect(bouton()).toHaveAttribute('aria-pressed', 'true')
    expect(window.localStorage.getItem('brio_sons')).toBe('1')
  })

  it('stays silent in a hidden tab', async () => {
    window.localStorage.setItem('brio_sons', '1')
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    await ouvrir()
    fireEvent.click(screen.getByRole('button', { name: /^Option B:/ }))
    expect(contextesCrees).not.toHaveBeenCalled()
  })

  it('plays nothing before the student has interacted with the page', async () => {
    window.localStorage.setItem('brio_sons', '1')
    vi.stubGlobal('navigator', { ...navigator, userActivation: { hasBeenActive: false } })
    await ouvrir()
    fireEvent.click(screen.getByRole('button', { name: /^Option B:/ }))
    expect(contextesCrees).not.toHaveBeenCalled()
  })

  it('leaves the reading mode silent, with no switch', async () => {
    window.localStorage.setItem('brio_sons', '1')
    await ouvrir('lecture')
    expect(screen.queryByRole('button', { name: 'Sons' })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: /^Option B:/ }))
    expect(contextesCrees).not.toHaveBeenCalled()
  })
})
