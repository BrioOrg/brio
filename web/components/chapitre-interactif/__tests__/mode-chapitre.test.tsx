import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDeck } from '@brio/content'

vi.mock('@brio/api-client', () => ({ createApiClient: vi.fn() }))
vi.mock('@/lib/api', () => ({ soumettre: vi.fn(), marquerSectionLue: vi.fn() }))
vi.mock('@/lib/session', () => ({ getMoi: vi.fn() }))
// The end slide reads the student's path (#249): nothing to read here.
vi.mock('@/lib/progression', () => ({
  getProgression: vi.fn(async () => null),
  getSerie: vi.fn(async () => null),
  getParcours: vi.fn(async () => null),
}))

import { marquerSectionLue } from '@/lib/api'
import { getMoi } from '@/lib/session'
import { ChapterView, etapesParBloc, type ChapitreResponse } from '@/components/chapter-view'
import { ModeChapitreProvider } from '../mode-context'
import { BandeDiapos, BarreScene, BasculeInteractif, CommandesScene } from '../scene'
import type { ModeChapitre } from '@/lib/diapos'

const CHAPITRE: ChapitreResponse = {
  id: 'pythagore',
  title: 'Le théorème de Pythagore',
  sections: [
    {
      id: 'lecon',
      title: 'Énoncé',
      kind: 'lesson',
      blocks: [
        { id: 'objectifs', type: 'objectives', items: ['Calculer une longueur'] },
        { id: 'p1', type: 'prose', text: 'Le théorème relie les côtés.' },
        {
          id: 'def',
          type: 'callout',
          variant: 'definition',
          text: "L'hypoténuse est le plus long.",
        },
        {
          id: 'ex1',
          type: 'exercise',
          exerciceId: '11111111-1111-1111-1111-111111111111',
          exerciseType: 'short-answer',
          prompt: 'Nomme le plus grand côté.',
        },
      ],
    },
    {
      id: 'exercices',
      title: 'Exercices',
      kind: 'exercises',
      blocks: [
        {
          id: 'ex2',
          type: 'exercise',
          exerciceId: '22222222-2222-2222-2222-222222222222',
          exerciseType: 'short-answer',
          prompt: 'Calcule BC.',
        },
      ],
    },
  ],
}

// debut (title + objectives) · p1 (prose + definition) · ex1 · ex2 · fin
const DECK = buildDeck(CHAPITRE)
const CHEMIN = '/3e/mathematiques/pythagore'

function renderChapitre(mode: ModeChapitre = 'interactif', index = 0) {
  return render(
    <ModeChapitreProvider
      chapitreId={CHAPITRE.id}
      deck={DECK}
      sectionTitles={{ lecon: 'Énoncé', exercices: 'Exercices' }}
      chemin={CHEMIN}
      parcoursHref="/3e/mathematiques"
      niveau="3e"
      matiere="mathematiques"
      slug="pythagore"
      initialMode={mode}
      initialIndex={index}
    >
      <BarreScene />
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

function touche(key: string, target: EventTarget = window, init: KeyboardEventInit = {}) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
  })
}

beforeEach(() => {
  // jsdom has no layout: scrolling is a no-op here.
  window.scrollTo = vi.fn()
  window.history.replaceState(null, '', CHEMIN)
  document.cookie = 'brio_mode_chapitre=; max-age=0; path=/'
  vi.mocked(getMoi).mockResolvedValue({ role: 'eleve' } as never)
  vi.mocked(marquerSectionLue).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('interactive mode — slides', () => {
  it('shows only the current slide and puts it in the URL without adding an entry', () => {
    const before = window.history.length
    const { container } = renderChapitre()

    expect(visibles(container)).toEqual(['debut', 'debut'])
    expect(window.location.search).toBe('?diapo=debut')
    expect(window.history.length).toBe(before)
  })

  it('moves with the arrows and space, one history entry per slide', () => {
    const before = window.history.length
    const { container } = renderChapitre()

    touche('ArrowRight')
    expect(visibles(container)).toEqual(['p1'])
    touche(' ')
    expect(visibles(container)).toEqual(['ex1'])
    touche('ArrowLeft')
    expect(visibles(container)).toEqual(['p1'])

    expect(window.location.search).toBe('?diapo=p1')
    expect(window.history.length).toBe(before + 3)
  })

  it('moves two slides for two presses in a row', () => {
    const { container } = renderChapitre()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    })
    expect(visibles(container)).toEqual(['ex1'])
  })

  it('moves focus to the new slide title and announces its position', () => {
    renderChapitre()
    touche('ArrowRight')

    expect(document.activeElement).toHaveTextContent('Énoncé')
    expect(document.activeElement).toHaveAttribute('data-diapo-titre')
    expect(screen.getByText('Diapo 2 sur 5', { selector: '[aria-live]' })).toBeInTheDocument()
  })

  it('shows the position in the deck, never a completion', () => {
    renderChapitre('interactif', 2)
    expect(screen.getByText('3 / 5')).toBeInTheDocument()
  })

  it('leaves the keys typed into an answer to the answer', () => {
    const { container } = renderChapitre('interactif', 2)
    const input = container.querySelector<HTMLInputElement>('#ex1 input')!

    touche('ArrowRight', input)
    touche(' ', input)
    touche('Escape', input)

    expect(visibles(container)).toEqual(['ex1'])
  })

  it('lets space press a focused button instead of changing slide', () => {
    const { container } = renderChapitre('interactif', 1)
    touche(' ', screen.getByRole('button', { name: /Suivant/ }))
    expect(visibles(container)).toEqual(['p1'])
  })

  it('follows the back button', () => {
    const { container } = renderChapitre()
    touche('ArrowRight')
    touche('ArrowRight')

    act(() => {
      window.history.replaceState(null, '', `${CHEMIN}?diapo=p1`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(visibles(container)).toEqual(['p1'])
  })

  it('opens the slide holding a block named by an in-page link', () => {
    const { container } = renderChapitre('interactif', 3)
    const lien = document.createElement('a')
    lien.href = '#def'
    container.querySelector('#ex2')!.appendChild(lien)

    fireEvent.click(lien)
    expect(visibles(container)).toEqual(['p1'])
  })
})

describe('interactive mode — side strip', () => {
  it('marks the current slide and names each marker', () => {
    renderChapitre('interactif', 2)
    const nav = screen.getByRole('navigation', { name: 'Diapos du chapitre' })
    const liens = within(nav).getAllByRole('link')

    expect(liens).toHaveLength(5)
    expect(liens[2]).toHaveAttribute('aria-current', 'step')
    expect(liens[2]).toHaveAccessibleName('Diapo 3 sur 5 · Exercice · Énoncé')
    expect(liens[3]).toHaveAttribute('href', `${CHEMIN}?diapo=ex2`)
  })

  it('opens the slide a marker leads to', () => {
    const { container } = renderChapitre()
    fireEvent.click(screen.getByRole('link', { name: /Diapo 4 sur 5/ }))
    expect(visibles(container)).toEqual(['ex2'])
  })

  it('folds away', () => {
    renderChapitre()
    fireEvent.click(screen.getByRole('button', { name: 'Replier les diapos' }))
    expect(screen.queryByRole('navigation', { name: 'Diapos du chapitre' })).toBeNull()
  })
})

describe('switching modes (ADR 0032 §6)', () => {
  it('Escape returns to reading, remembers it and drops ?diapo', () => {
    const { container } = renderChapitre('interactif', 2)
    touche('Escape')

    expect(container.querySelector('[data-chapitre-mode]')).toHaveAttribute(
      'data-chapitre-mode',
      'lecture'
    )
    expect(window.location.search).toBe('')
    expect(document.cookie).toContain('brio_mode_chapitre=lecture')
    expect(screen.getByRole('button', { name: /Mode interactif/ })).toHaveFocus()
  })

  it('keeps an answer being typed across a round trip', () => {
    const { container } = renderChapitre('interactif', 2)
    const input = container.querySelector<HTMLInputElement>('#ex1 input')!
    fireEvent.change(input, { target: { value: 'hypoténuse' } })

    touche('Escape')
    fireEvent.click(screen.getByRole('button', { name: /Mode interactif/ }))

    expect(container.querySelector<HTMLInputElement>('#ex1 input')).toBe(input)
    expect(input.value).toBe('hypoténuse')
    expect(document.cookie).toContain('brio_mode_chapitre=interactif')
  })

  it('renders every block in reading mode, and the end slide not at all', () => {
    const { container } = renderChapitre('lecture')
    expect(screen.queryByText('Fin du chapitre')).toBeNull()
    expect(container.querySelectorAll('[data-diapo]:not([hidden])')).toHaveLength(5)
    expect(screen.queryByRole('navigation', { name: 'Diapos du chapitre' })).toBeNull()
  })
})

describe('sections read (#252)', () => {
  async function flush() {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it('marks a section read when its last slide is left forward, once', async () => {
    renderChapitre('interactif', 2)
    touche('ArrowRight')
    touche('ArrowLeft')
    touche('ArrowRight')
    await flush()

    expect(marquerSectionLue).toHaveBeenCalledTimes(1)
    expect(marquerSectionLue).toHaveBeenCalledWith('pythagore', 'lecon')
  })

  it('marks an exercises section too: the backend counts every section', async () => {
    renderChapitre('interactif', 3)
    touche('ArrowRight')
    await flush()
    expect(marquerSectionLue).toHaveBeenCalledWith('pythagore', 'exercices')
  })

  it('does not mark a section left backward or mid-section', async () => {
    renderChapitre('interactif', 3)
    touche('ArrowLeft')
    touche('ArrowLeft')
    await flush()
    expect(marquerSectionLue).not.toHaveBeenCalled()
  })

  it('marks nothing for a visitor who is not a student', async () => {
    vi.mocked(getMoi).mockResolvedValue(null)
    renderChapitre('interactif', 2)
    touche('ArrowRight')
    await flush()
    expect(marquerSectionLue).not.toHaveBeenCalled()
  })
})

describe('steps revealed one at a time (MOTION.md "Step reveal")', () => {
  const AVEC_ETAPES: ChapitreResponse = {
    id: 'substituer',
    title: 'Substituer',
    sections: [
      {
        id: 'methode',
        title: 'Méthode',
        kind: 'lesson',
        blocks: [
          { id: 'def', type: 'callout', variant: 'definition', text: 'Une expression.' },
          {
            id: 'etapes',
            type: 'steps',
            title: 'Calculer 3x + 2 pour x = 4',
            steps: [{ text: 'On remplace x.' }, { text: 'On multiplie.' }, { text: 'On ajoute.' }],
          },
          { id: 'p-fin', type: 'prose', text: 'Et voilà.' },
        ],
      },
    ],
  }
  // debut · def · etapes · p-fin · fin
  const deck = buildDeck(AVEC_ETAPES)

  // Slides swap at once under reduced motion. Otherwise, once `motion` has loaded (a race with the
  // awaited tests above), the leaving slide stays visible during its exit. Beats and transitions
  // have their own tests (mode-interactif.spec.ts); steps come one at a time either way.
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
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function renderEtapes(index: number, mode: ModeChapitre = 'interactif') {
    return render(
      <ModeChapitreProvider
        chapitreId={AVEC_ETAPES.id}
        deck={deck}
        etapes={etapesParBloc(AVEC_ETAPES)}
        sectionTitles={{ methode: 'Méthode' }}
        chemin={CHEMIN}
        parcoursHref="/3e/mathematiques"
        niveau="3e"
        matiere="mathematiques"
        slug="pythagore"
        initialMode={mode}
        initialIndex={index}
      >
        <BandeDiapos />
        <BasculeInteractif />
        <ChapterView chapitre={AVEC_ETAPES} deck={deck} />
        <CommandesScene />
      </ModeChapitreProvider>
    )
  }

  function etapesVisibles(): string[] {
    return screen
      .getAllByRole('listitem')
      .filter((li) => !li.hidden && li.hasAttribute('data-etape'))
      .map((li) => li.textContent ?? '')
  }

  it('shows the first step on a slide entered forward; each press reveals one more', () => {
    const { container } = renderEtapes(1)
    touche('ArrowRight')
    expect(visibles(container)).toEqual(['etapes'])
    expect(etapesVisibles()).toEqual(['1On remplace x.'])
    expect(screen.getByRole('button', { name: /Étape suivante/ })).toBeInTheDocument()

    touche(' ')
    expect(etapesVisibles()).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /Étape suivante/ }))
    expect(etapesVisibles()).toHaveLength(3)
    expect(visibles(container)).toEqual(['etapes'])

    // Every step is there: « Suivant » moves on again.
    fireEvent.click(screen.getByRole('button', { name: /^Suivant/ }))
    expect(visibles(container)).toEqual(['p-fin'])
  })

  it('shows every step on a slide reached backward', () => {
    renderEtapes(3)
    touche('ArrowLeft')
    expect(etapesVisibles()).toHaveLength(3)
    expect(screen.getByRole('button', { name: /^Suivant/ })).toBeInTheDocument()
  })

  it('shows every step from a direct link, and in reading mode', () => {
    const { unmount } = renderEtapes(2)
    expect(etapesVisibles()).toHaveLength(3)
    unmount()
    renderEtapes(0, 'lecture')
    expect(etapesVisibles()).toHaveLength(3)
  })

  it('shows every step after a jump from the strip of slides', () => {
    const { container } = renderEtapes(0)
    const bande = screen.getByRole('navigation', { name: 'Diapos du chapitre' })
    fireEvent.click(within(bande).getAllByRole('link')[2])
    expect(visibles(container)).toEqual(['etapes'])
    expect(etapesVisibles()).toHaveLength(3)
  })
})

describe('full screen (#250)', () => {
  let element: Element | null = null

  function changer(el: Element | null) {
    element = el
    document.dispatchEvent(new Event('fullscreenchange'))
  }

  function installer(enabled: boolean) {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: enabled })
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => element,
    })
    document.documentElement.requestFullscreen = vi.fn(async () => changer(document.documentElement))
    document.exitFullscreen = vi.fn(async () => changer(null))
  }

  afterEach(() => {
    element = null
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: undefined })
  })

  it('has no button where the API is missing', () => {
    installer(false)
    renderChapitre()
    expect(screen.queryByRole('button', { name: 'Plein écran' })).toBeNull()
  })

  it('goes full screen with the button and comes back with F', async () => {
    installer(true)
    renderChapitre()

    await act(async () => screen.getByRole('button', { name: 'Plein écran' }).click())
    expect(document.documentElement.requestFullscreen).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Quitter le plein écran' })).toBeInTheDocument()

    await act(async () => touche('f'))
    expect(document.exitFullscreen).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Plein écran' })).toBeInTheDocument()
  })

  it('leaves F typed into an answer to the answer', () => {
    installer(true)
    renderChapitre('interactif', 2)
    touche('f', screen.getByRole('textbox'))
    expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled()
  })

  it('leaves Escape to the browser in full screen: the mode stays interactive', async () => {
    installer(true)
    const { container } = renderChapitre()
    await act(async () => touche('F'))

    touche('Escape')
    expect(container.firstElementChild).toHaveAttribute('data-chapitre-mode', 'interactif')
  })

  it('leaves full screen when going back to reading', async () => {
    installer(true)
    const { container } = renderChapitre()
    await act(async () => touche('f'))

    act(() => screen.getByRole('button', { name: 'Revenir au mode lecture' }).click())
    expect(container.firstElementChild).toHaveAttribute('data-chapitre-mode', 'lecture')
    expect(document.exitFullscreen).toHaveBeenCalled()
  })

  it('does nothing in reading mode', () => {
    installer(true)
    renderChapitre('lecture')
    touche('f')
    expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled()
  })
})
