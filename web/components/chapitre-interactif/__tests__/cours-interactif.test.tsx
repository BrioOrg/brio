import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDeck } from '@brio/content'

vi.mock('@brio/api-client', () => ({ createApiClient: vi.fn() }))
vi.mock('@/lib/api', () => ({
  soumettre: vi.fn(),
  marquerSectionLue: vi.fn(),
  marquerSectionCoursLue: vi.fn(),
}))
vi.mock('@/lib/session', () => ({ getMoi: vi.fn() }))
vi.mock('@/lib/progression', () => ({
  getProgression: vi.fn(),
  getSerie: vi.fn(),
  getParcours: vi.fn(),
  getProgressionCours: vi.fn(),
}))
vi.mock('../motion-animate', () => ({
  animate: vi.fn(() => ({ complete: vi.fn(), stop: vi.fn(), finished: Promise.resolve() })),
}))

import { marquerSectionCoursLue, marquerSectionLue } from '@/lib/api'
import { getMoi } from '@/lib/session'
import { getParcours, getProgression, getProgressionCours, getSerie } from '@/lib/progression'
import { ProgressionProvider } from '@/components/progression-context'
import { ChapterProgress } from '@/components/chapter-progress'
import { ChapterView, exercicesCorriges, type ChapitreResponse } from '@/components/chapter-view'
import { ModeChapitreProvider } from '../mode-context'
import { BandeDiapos, BarreScene, CommandesScene } from '../scene'

// A teacher course in the interactive mode (ADR 0050 §7): its « section lue » goes to the course
// endpoint, its end slide reads the course gauge, says « cours » and has no next one.

const COURS_ID = 'c0ffee00-0000-4000-8000-000000000001'

const COURS: ChapitreResponse = {
  id: 'cours-enseignant',
  title: 'Pythagore en pratique',
  sections: [
    {
      id: 's1',
      title: 'Leçon',
      kind: 'lesson',
      blocks: [{ id: 'p1', type: 'prose', text: 'Dans un triangle rectangle…' }],
    },
    {
      id: 's2',
      title: 'Exemple',
      kind: 'lesson',
      blocks: [{ id: 'p2', type: 'prose', text: 'Un exemple.' }],
    },
  ],
} as ChapitreResponse

const DECK = buildDeck(COURS)
const FIN = DECK.length - 1

function jauge(pourcentage: number) {
  return {
    coursId: COURS_ID,
    pourcentage,
    termine: pourcentage >= 100,
    sectionsLues: 1,
    sectionsTotal: 2,
  }
}

function ouvrir(index: number) {
  return render(
    <ProgressionProvider>
      <ModeChapitreProvider
        coursId={COURS_ID}
        deck={DECK}
        exercices={exercicesCorriges(COURS)}
        sectionTitles={{ s1: 'Leçon', s2: 'Exemple' }}
        chemin={`/cours/${COURS_ID}`}
        parcoursHref="/ma-classe"
        initialMode="interactif"
        initialIndex={index}
      >
        <BarreScene />
        <ChapterView chapitre={COURS} deck={DECK} />
        <CommandesScene />
      </ModeChapitreProvider>
    </ProgressionProvider>
  )
}

function fin(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-diapo="fin"]')!
}

beforeEach(() => {
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
  window.history.replaceState(null, '', `/cours/${COURS_ID}`)
  vi.mocked(getMoi).mockResolvedValue({ role: 'eleve' } as never)
  vi.mocked(marquerSectionCoursLue).mockResolvedValue(undefined)
  vi.mocked(getProgression).mockResolvedValue({ xpTotal: 100, niveau: 1 })
  vi.mocked(getSerie).mockResolvedValue({ joursConsecutifs: 3 } as never)
  vi.mocked(getProgressionCours).mockResolvedValue(jauge(50))
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('a teacher course in the interactive mode (ADR 0050 §7)', () => {
  it('records a section read on the course, never on a chapter', async () => {
    ouvrir(DECK.findIndex((d) => d.sectionId === 's1'))
    fireEvent.click(await screen.findByRole('button', { name: 'Suivant' }))

    await waitFor(() => expect(marquerSectionCoursLue).toHaveBeenCalledWith(COURS_ID, 's1'))
    expect(marquerSectionLue).not.toHaveBeenCalled()
  })

  it('ends on the course: its own words, its gauge, no next one, back to the courses', async () => {
    ouvrir(FIN)
    const slide = within(fin())

    expect(slide.getByRole('heading', { name: 'Fin du cours' })).toBeTruthy()
    expect(slide.getByText('Tu as parcouru toutes les diapos de ce cours.')).toBeTruthy()
    await waitFor(() =>
      expect(slide.getByRole('progressbar', { name: 'Progression du cours : 50 %' })).toBeTruthy()
    )
    expect(slide.getByText('Ton avancée dans le cours')).toBeTruthy()
    expect(slide.queryByText(/chapitre/i)).toBeNull()
    expect(slide.queryByRole('link', { name: /suivant/i })).toBeNull()
    expect(
      slide.getByRole('link', { name: 'Revenir aux cours de ta classe' }).getAttribute('href')
    ).toBe('/ma-classe')
    expect(getParcours).not.toHaveBeenCalled()
  })

  it('says « Cours terminé » at 100 %, and announces no bonus', async () => {
    vi.mocked(getProgressionCours).mockResolvedValue(jauge(100))
    ouvrir(FIN)
    await within(fin()).findByText('Cours terminé')
    expect(within(fin()).queryByText(/bonus/i)).toBeNull()
  })

  it('given no gauge (never opened), then no completion line rather than a 0', async () => {
    vi.mocked(getProgressionCours).mockResolvedValue(null)
    ouvrir(FIN)
    await act(async () => {})
    expect(fin().querySelector('[data-bilan="completion"]')).toBeNull()
  })
})

describe('ChapterProgress on a teacher course', () => {
  it('shows the course gauge, and « Cours terminé » once done', async () => {
    vi.mocked(getProgressionCours).mockResolvedValue(jauge(100))
    render(<ChapterProgress coursId={COURS_ID} />)

    expect(await screen.findByText('Cours terminé')).toBeTruthy()
    expect(
      screen
        .getByRole('progressbar', { name: 'Progression du cours : 100 %' })
        .getAttribute('aria-valuenow')
    ).toBe('100')
    expect(getParcours).not.toHaveBeenCalled()
  })

  it('draws nothing when progression has no gauge for the student', async () => {
    vi.mocked(getProgressionCours).mockResolvedValue(null)
    const { container } = render(<ChapterProgress coursId={COURS_ID} />)
    await act(async () => {})
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
  })

  it('draws nothing for a teacher, without asking for a gauge', async () => {
    vi.mocked(getMoi).mockResolvedValue({ role: 'enseignant' } as never)
    const { container } = render(<ChapterProgress coursId={COURS_ID} />)
    await act(async () => {})
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
    expect(getProgressionCours).not.toHaveBeenCalled()
  })
})

describe('nothing on a teacher course says « chapitre » (ADR 0050 §7, S2)', () => {
  it('names the slide strip and the end slide after the course', async () => {
    render(
      <ProgressionProvider>
        <ModeChapitreProvider
          coursId={COURS_ID}
          deck={DECK}
          sectionTitles={{ s1: 'Leçon', s2: 'Exemple' }}
          chemin={`/cours/${COURS_ID}`}
          parcoursHref="/ma-classe/cours"
          initialMode="interactif"
          initialIndex={FIN}
        >
          <BandeDiapos />
          <ChapterView chapitre={COURS} deck={DECK} />
        </ModeChapitreProvider>
      </ProgressionProvider>
    )
    await act(async () => {})
    expect(screen.getAllByRole('navigation', { name: 'Diapos du cours' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('navigation', { name: 'Diapos du chapitre' })).toBeNull()
    expect(screen.getAllByRole('link', { name: /Fin du cours/ }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /Fin du chapitre/ })).toBeNull()
  })
})
