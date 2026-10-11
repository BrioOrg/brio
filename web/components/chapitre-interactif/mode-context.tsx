'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { Diapo } from '@brio/content'
import { marquerSectionLue } from '@/lib/api'
import { getMoi } from '@/lib/session'
import {
  MODE_COOKIE,
  indexDiapo,
  sectionTerminee,
  urlAvecDiapo,
  type ModeChapitre,
} from '@/lib/diapos'
import { chargerMotion, detacher, peutAnimer, revenir, terminer, transition } from './animation'

/**
 * The chapter's two modes (ADR 0032): reading, today's long page, and interactive, one slide at a
 * time. Both render the same tree: each slide's blocks sit in a `DiapoFrame` that is invisible in
 * reading mode (`display: contents`) and shown only when current in interactive mode. Nothing is
 * remounted when switching, so an answered exercise stays answered.
 *
 * Holds the current slide and keeps it in the URL (`?diapo=<id>`, one history entry per slide),
 * the keyboard, the swipe, and the "section read" signal.
 */

type ModeChapitreContext = {
  mode: ModeChapitre
  deck: readonly Diapo[]
  index: number
  /** The slide still leaving during a transition: its frames stay visible until it is gone. */
  sortante: string | null
  sectionTitles: Readonly<Record<string, string>>
  /** The chapter's path, without query: each slide's link is `<chemin>?diapo=<id>`. */
  chemin: string
  parcoursHref: string
  aller: (index: number) => void
  suivante: () => void
  precedente: () => void
  basculer: () => void
  bandeRepliee: boolean
  setBandeRepliee: (repliee: boolean) => void
  tiroirOuvert: boolean
  setTiroirOuvert: (ouvert: boolean) => void
  /** This session's exercises, by block id. Never persisted (ADR 0032 §1). */
  exercices: Readonly<Record<string, EtatExercice>>
  /** The slides opened in this session, so a skipped exercise can be told apart. */
  vues: ReadonlySet<string>
  signalerExercice: (blockId: string, etat: 'tente' | 'resolu') => void
  /** Where the current exercise draws « Vérifier », in the bottom bar (#246). */
  piedExercice: HTMLElement | null
  setPiedExercice: (el: HTMLElement | null) => void
  /** Where it draws its result sheet, over the bottom bar. */
  feuilleExercice: HTMLElement | null
  setFeuilleExercice: (el: HTMLElement | null) => void
  /** The exercise whose result sheet is open: the bar's own buttons step aside. */
  feuilleOuverte: string | null
  setFeuilleOuverte: (blockId: string | null) => void
}

/** `a-faire`: never checked; `tente`: checked, not right yet; `resolu`: right once. */
export type EtatExercice = 'a-faire' | 'tente' | 'resolu'

const Context = createContext<ModeChapitreContext | null>(null)

/** Outside a provider (teacher courses, the editor), everything reads as reading mode. */
export function useModeChapitre(): ModeChapitreContext | null {
  return useContext(Context)
}

const UN_AN = 60 * 60 * 24 * 365

function ecrireCookie(mode: ModeChapitre) {
  document.cookie = `${MODE_COOKIE}=${mode}; path=/; max-age=${UN_AN}; samesite=lax`
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function abonnerReducedMotion(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/**
 * `prefers-reduced-motion`, read without `motion`'s `useReducedMotion()`: that hook would pull
 * `motion` into the bundle the reading mode loads too.
 */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    abonnerReducedMotion,
    () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches,
    () => false
  )
}

/** An attribute value quoted for a selector (block ids are author-written). */
function attr(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}

/** Keys typed into a field belong to the field, never to the slide navigation. */
function estSaisie(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return (
    target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !==
    null
  )
}

/** Space already presses a button or follows a link: it does not change slide there. */
function estActivable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('button, a[href], summary, [role="button"], [role="option"]') !== null
}

/** Arrows already move inside these widgets. */
function gereLesFleches(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('[role="radiogroup"], [role="listbox"], [role="slider"]') !== null
}

/** A swipe that starts in a block wider than the screen scrolls that block, not the slides. */
function defileEnLargeur(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null
  while (el && el !== document.body) {
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') {
      return true
    }
    el = el.parentElement
  }
  return false
}

/** Below the sticky site header: what counts as the top of the page. */
const HAUT_DE_PAGE = 88

const SEUIL_DECISION = 10 // px before a touch counts as a horizontal swipe
const SEUIL_DISTANCE = 0.2 // share of the width that changes slide
const SEUIL_VITESSE = 0.5 // px/ms that changes slide, however short the swipe

type Props = {
  children: React.ReactNode
  chapitreId: string
  deck: readonly Diapo[]
  /** The block ids of the exercises a student can check (`exercicesCorriges`). */
  exercices?: readonly string[]
  sectionTitles: Readonly<Record<string, string>>
  chemin: string
  parcoursHref: string
  initialMode: ModeChapitre
  initialIndex: number
}

export function ModeChapitreProvider({
  children,
  chapitreId,
  deck,
  exercices: corriges = [],
  sectionTitles,
  chemin,
  parcoursHref,
  initialMode,
  initialIndex,
}: Props) {
  const [mode, setMode] = useState<ModeChapitre>(initialMode)
  const [index, setIndex] = useState(initialIndex)
  const [sortante, setSortante] = useState<string | null>(null)
  const [bandeRepliee, setBandeRepliee] = useState(false)
  const [tiroirOuvert, setTiroirOuvert] = useState(false)
  const [transitionsPretes, setTransitionsPretes] = useState(false)
  const [exercices, setExercices] = useState<Readonly<Record<string, EtatExercice>>>(() =>
    Object.fromEntries(corriges.map((id) => [id, 'a-faire' as const]))
  )
  const [vues, setVues] = useState<ReadonlySet<string>>(() => new Set())
  const [piedExercice, setPiedExercice] = useState<HTMLElement | null>(null)
  const [feuilleExercice, setFeuilleExercice] = useState<HTMLElement | null>(null)
  const [feuilleOuverte, setFeuilleOuverte] = useState<string | null>(null)
  const reducedMotion = useReducedMotion()
  const racine = useRef<HTMLDivElement>(null)

  // Latest values for the window listeners, which are bound once per mode.
  const etat = useRef({ mode, index, tiroirOuvert, reducedMotion })
  etat.current = { mode, index, tiroirOuvert, reducedMotion }

  /** What the next render must do once the new slide is in the DOM. */
  const apres = useRef<{
    focus: boolean
    transition: {
      sortants: HTMLElement[]
      rattacher: () => void
      direction: 1 | -1
      depuisX: number
    } | null
  }>({ focus: false, transition: null })

  const frames = useCallback(
    (id: string) =>
      Array.from(racine.current?.querySelectorAll<HTMLElement>(`[data-diapo="${attr(id)}"]`) ?? []),
    []
  )

  // --- Sections read (#252): leaving a section's last slide forward, for a student only. ---

  const marquees = useRef(new Set<string>())
  const eleve = useRef<Promise<boolean> | null>(null)
  const signalerSection = useCallback(
    (sectionId: string) => {
      if (marquees.current.has(sectionId)) return
      marquees.current.add(sectionId)
      eleve.current ??= getMoi()
        .then((moi) => moi?.role === 'eleve')
        .catch(() => false)
      void eleve.current.then((estEleve) => {
        // A lost signal costs a section of the gauge, never the slide: it fails silently.
        if (estEleve) marquerSectionLue(chapitreId, sectionId).catch(() => {})
      })
    },
    [chapitreId]
  )

  // --- Exercises of the session (#246): what the strip marks, what the bar offers. ---

  const signalerExercice = useCallback((blockId: string, etat: 'tente' | 'resolu') => {
    // Solved once stays solved for the session, even after « Réessayer ».
    setExercices((prev) => (prev[blockId] === 'resolu' ? prev : { ...prev, [blockId]: etat }))
  }, [])

  // A result sheet belongs to the moment after « Vérifier »: leaving the slide closes it, and a
  // student coming back finds the answered exercise with its bar, not the sheet.
  useEffect(() => {
    setFeuilleOuverte(null)
    if (mode !== 'interactif') return
    const id = deck[index]?.id
    if (id) setVues((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  }, [mode, index, deck])

  // --- Moving between slides. ---

  const naviguer = useCallback(
    (cible: number, options: { historique: 'push' | 'aucun'; depuisX?: number }) => {
      const { index: depart, mode: modeCourant, reducedMotion: reduit } = etat.current
      if (modeCourant !== 'interactif' || cible === depart || cible < 0 || cible >= deck.length) {
        return
      }
      terminer()
      const direction = cible > depart ? 1 : -1
      if (direction === 1) {
        const section = sectionTerminee(deck, depart)
        if (section) signalerSection(section)
      }
      if (options.historique === 'push') {
        window.history.pushState(null, '', urlAvecDiapo(window.location.href, deck[cible].id))
      }

      const article = racine.current?.querySelector<HTMLElement>('[data-chapitre-article]')
      const sortants = frames(deck[depart].id)
      if (peutAnimer(reduit) && article) {
        const rattacher = detacher(sortants, article, options.depuisX ?? 0)
        apres.current = {
          focus: true,
          transition: { sortants, rattacher, direction, depuisX: options.depuisX ?? 0 },
        }
        setSortante(deck[depart].id)
      } else {
        for (const frame of sortants) frame.style.removeProperty('transform')
        apres.current = { focus: true, transition: null }
      }
      // Read by the next key press before React re-renders: two quick presses move two slides.
      etat.current = { ...etat.current, index: cible }
      setIndex(cible)
    },
    [deck, frames, signalerSection]
  )

  const aller = useCallback((cible: number) => naviguer(cible, { historique: 'push' }), [naviguer])
  const suivante = useCallback(() => aller(etat.current.index + 1), [aller])
  const precedente = useCallback(() => aller(etat.current.index - 1), [aller])

  // Once the new slide is in the DOM: run the transition, then move focus to its title.
  useLayoutEffect(() => {
    const { transition: t, focus } = apres.current
    apres.current = { focus: false, transition: null }
    if (t) {
      transition(t.sortants, t.rattacher, frames(deck[index].id), t.direction, t.depuisX, () =>
        setSortante(null)
      )
    }
    if (focus) {
      const titre = frames(deck[index].id)
        .map((f) => f.querySelector<HTMLElement>('[data-diapo-titre]'))
        .find((el) => el !== null)
      titre?.focus({ preventScroll: true })
      const article = racine.current?.querySelector<HTMLElement>('[data-chapitre-article]')
      if (article && article.getBoundingClientRect().top < 0) {
        window.scrollTo({ top: window.scrollY + article.getBoundingClientRect().top })
      }
    }
  }, [index, mode, deck, frames])

  // --- Switching modes (ADR 0032 §6): client-side, no navigation, nothing remounted. ---

  const versLecture = useRef<number | null>(null)

  const basculer = useCallback(() => {
    terminer()
    if (etat.current.mode === 'interactif') {
      ecrireCookie('lecture')
      window.history.replaceState(null, '', urlAvecDiapo(window.location.href, null))
      versLecture.current = etat.current.index
      setTiroirOuvert(false)
      setMode('lecture')
      return
    }
    // Reading → interactive opens the slide holding the block at the top of the screen.
    const blocs = Array.from(
      racine.current?.querySelectorAll<HTMLElement>('[data-diapo] > *') ?? []
    )
    const enHaut = blocs.find((b) => b.getBoundingClientRect().bottom > HAUT_DE_PAGE)
    const id = window.scrollY < HAUT_DE_PAGE ? null : enHaut?.closest('[data-diapo]')
    const cible = indexDiapo(deck, id instanceof HTMLElement ? id.dataset.diapo : null)
    ecrireCookie('interactif')
    window.history.replaceState(null, '', urlAvecDiapo(window.location.href, deck[cible].id))
    apres.current = { focus: true, transition: null }
    setIndex(cible)
    setMode('interactif')
  }, [deck])

  // Interactive → reading lands on the first block of the slide that was open.
  useLayoutEffect(() => {
    const depuis = versLecture.current
    if (mode !== 'lecture' || depuis === null) return
    versLecture.current = null
    const diapo = deck[depuis]
    if (diapo.kind === 'debut') {
      window.scrollTo({ top: 0 })
    } else if (diapo.kind === 'fin') {
      const article = racine.current?.querySelector<HTMLElement>('[data-chapitre-article]')
      if (article) {
        window.scrollTo({ top: window.scrollY + article.getBoundingClientRect().bottom })
      }
    } else {
      const premier = document.getElementById(diapo.blockIds[0])
      if (premier) {
        const top = window.scrollY + premier.getBoundingClientRect().top - HAUT_DE_PAGE
        window.scrollTo({ top: Math.max(0, top) })
      }
    }
    racine.current
      ?.querySelector<HTMLElement>('[data-bascule-interactif]')
      ?.focus({ preventScroll: true })
  }, [mode, deck])

  // --- URL: a shared link, the back button. ---

  useEffect(() => {
    if (mode !== 'interactif') return
    let actif = true
    void chargerMotion()
      .then(() => actif && setTransitionsPretes(true))
      .catch(() => {}) // a failed chunk load only costs the transitions

    // `?diapo` absent (first visit) or naming a block that moved: replace, never push.
    const actuel = new URLSearchParams(window.location.search).get('diapo')
    if (actuel !== deck[etat.current.index].id) {
      window.history.replaceState(
        null,
        '',
        urlAvecDiapo(window.location.href, deck[etat.current.index].id)
      )
    }
    return () => {
      actif = false
    }
  }, [mode, deck])

  useEffect(() => {
    const onPopState = () => {
      const id = new URLSearchParams(window.location.search).get('diapo')
      if (id === null) {
        // Not written by this page's switch (which replaces): leave the cookie alone.
        if (etat.current.mode === 'interactif') {
          terminer()
          versLecture.current = etat.current.index
          setMode('lecture')
        }
        return
      }
      const cible = indexDiapo(deck, id)
      if (etat.current.mode !== 'interactif') {
        apres.current = { focus: true, transition: null }
        setIndex(cible)
        setMode('interactif')
        return
      }
      naviguer(cible, { historique: 'aucun' })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [deck, naviguer])

  // --- Keyboard: ← → space, Escape back to reading. ---

  useEffect(() => {
    if (mode !== 'interactif') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      if (etat.current.tiroirOuvert || estSaisie(e.target)) return
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowLeft':
          if (gereLesFleches(e.target)) return
          e.preventDefault()
          if (e.key === 'ArrowRight') suivante()
          else precedente()
          return
        case ' ':
          if (estActivable(e.target)) return
          e.preventDefault()
          if (e.shiftKey) precedente()
          else suivante()
          return
        case 'Escape':
          e.preventDefault()
          basculer()
          return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, suivante, precedente, basculer])

  // --- Swipe: the slide follows the finger, then changes or comes back. ---

  useEffect(() => {
    const el = racine.current?.querySelector<HTMLElement>('[data-chapitre-article]')
    if (mode !== 'interactif' || !el) return
    let geste: {
      id: number
      x: number
      y: number
      t: number
      dx: number
      horizontal: boolean | null
    } | null = null

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !e.isPrimary) return
      if (estSaisie(e.target) || defileEnLargeur(e.target)) return
      geste = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        t: e.timeStamp,
        dx: 0,
        horizontal: null,
      }
    }
    const onMove = (e: PointerEvent) => {
      if (!geste || e.pointerId !== geste.id) return
      const dx = e.clientX - geste.x
      const dy = e.clientY - geste.y
      if (geste.horizontal === null) {
        if (Math.abs(dy) > SEUIL_DECISION && Math.abs(dy) >= Math.abs(dx)) {
          geste = null // a vertical scroll
          return
        }
        if (Math.abs(dx) <= SEUIL_DECISION) return
        terminer()
        geste.horizontal = true
      }
      geste.dx = dx
      // Under reduced motion the slide does not move with the finger; the swipe still works.
      if (!etat.current.reducedMotion) {
        for (const frame of frames(deck[etat.current.index].id)) {
          frame.style.transform = `translateX(${dx}px)`
        }
      }
    }
    const onUp = (e: PointerEvent) => {
      if (!geste || e.pointerId !== geste.id) return
      const { dx, t, horizontal } = geste
      geste = null
      if (!horizontal) return
      const vitesse = dx / Math.max(1, e.timeStamp - t)
      const largeur = el.getBoundingClientRect().width
      const courant = etat.current.index
      const loin = Math.abs(dx) > largeur * SEUIL_DISTANCE || Math.abs(vitesse) > SEUIL_VITESSE
      const cible = dx < 0 ? courant + 1 : courant - 1
      if (loin && cible >= 0 && cible < deck.length) {
        naviguer(cible, { historique: 'push', depuisX: etat.current.reducedMotion ? 0 : dx })
      } else {
        revenir(frames(deck[courant].id), dx, etat.current.reducedMotion)
      }
    }
    const onCancel = (e: PointerEvent) => {
      if (!geste || e.pointerId !== geste.id) return
      geste = null
      revenir(frames(deck[etat.current.index].id), 0, true)
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
    }
  }, [mode, deck, frames, naviguer])

  // --- In-page links (« Revoir : <section> » after a wrong answer) open the slide they target. ---

  const onClickCapture = useCallback(
    (e: React.MouseEvent) => {
      if (etat.current.mode !== 'interactif' || !(e.target instanceof Element)) return
      const lien = e.target.closest<HTMLAnchorElement>('a[href^="#"]')
      const id = lien?.getAttribute('href')?.slice(1)
      if (!id || !racine.current?.querySelector(`[id="${attr(id)}"]`)) return
      e.preventDefault()
      aller(indexDiapo(deck, id))
    },
    [aller, deck]
  )

  const value = useMemo<ModeChapitreContext>(
    () => ({
      mode,
      deck,
      index,
      sortante,
      sectionTitles,
      chemin,
      parcoursHref,
      aller,
      suivante,
      precedente,
      basculer,
      bandeRepliee,
      setBandeRepliee,
      tiroirOuvert,
      setTiroirOuvert,
      exercices,
      vues,
      signalerExercice,
      piedExercice,
      setPiedExercice,
      feuilleExercice,
      setFeuilleExercice,
      feuilleOuverte,
      setFeuilleOuverte,
    }),
    [
      mode,
      deck,
      index,
      sortante,
      sectionTitles,
      chemin,
      parcoursHref,
      aller,
      suivante,
      precedente,
      basculer,
      bandeRepliee,
      tiroirOuvert,
      exercices,
      vues,
      signalerExercice,
      piedExercice,
      feuilleExercice,
      feuilleOuverte,
    ]
  )

  return (
    <Context.Provider value={value}>
      <div
        ref={racine}
        data-chapitre-mode={mode}
        // Slides animate once `motion` has loaded; e2e tests wait for it.
        data-transitions={transitionsPretes ? 'pretes' : undefined}
        className="group/mode min-h-screen bg-surface-page font-prose text-ink data-[chapitre-mode=interactif]:flex data-[chapitre-mode=interactif]:flex-col"
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </Context.Provider>
  )
}
