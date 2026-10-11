import {
  distance,
  duration,
  ease,
  motionS,
  particles,
  type DurationName,
} from '@/lib/motion-tokens'
import { bezier, moteur, peutAnimer, suivre, type Controls } from './animation'

/**
 * The rewards of a correct answer in interactive mode (#248, MOTION.md "What moves"): the option
 * badge pop, the check mark, the particles, the "+N XP" flight and the bump of the top-bar
 * counters. Imperative, like the slide transitions: `motion` is the one the interactive mode has
 * already loaded, and the reading mode never runs any of this.
 *
 * Every function does nothing under reduced motion or before `motion` is there: the end state is
 * the element's own, so skipping an animation never hides information (budget rule 4). Every
 * animation is tracked, so `terminer()` ends it with the others.
 */

const OUT_QUINT = bezier(ease['out-quint'].bezier)

/**
 * Shape of a burst, from the approved prototype (#241). Proportions of the spread rather than
 * design values: how far each particle travels (a share of the spread, at random), where in the
 * burst it peaks, and how far it falls after.
 */
const ECLAT = {
  porteeMin: 0.55,
  pic: 0.55,
  chute: 0.25,
  /** One particle in three is a four-point sparkle, the others round confetti. */
  etincelleTous: 3,
} as const

const COULEURS = ['bg-accent', 'bg-accent-hi', 'bg-xp'] as const

const ETINCELLE = {
  clipPath: 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)',
}

/** The letter badge of an option just picked: it scales from 0.7 to 1 (`select`). */
export function popPastille(el: Element | null | undefined, reducedMotion: boolean): void {
  const m = moteur()
  if (!m || !el || !peutAnimer(reducedMotion)) return
  suivre(
    m.animate(el, { scale: [0.7, 1] }, { duration: motionS('select', false), ease: OUT_QUINT })
  )
}

/** The check mark of the result sheet scales in, `delaiMs` after the sheet starts rising. */
export function poserCoche(el: Element | null | undefined, delaiMs: number): void {
  const m = moteur()
  if (!m || !el) return
  suivre(
    m.animate(
      el,
      { scale: [0.4, 1], opacity: [0, 1] },
      { duration: motionS('check', false), delay: delaiMs / 1000, ease: OUT_QUINT }
    )
  )
}

/**
 * Particles burst around `origine` (an empty, positioned element at the check mark's centre),
 * then fall and fade. They are created here and removed once they are gone. Returns what removes
 * them at once (the sheet closing mid-burst). `finale`: the end slide's burst, with more particles
 * spread wider (#249).
 */
export function eclater(
  origine: HTMLElement | null | undefined,
  delaiMs: number,
  finale = false
): () => void {
  const m = moteur()
  if (!m || !origine) return () => {}
  const crees: HTMLElement[] = []
  const nombre = particles.count * (finale ? particles.finaleCountFactor : 1)
  const spread = distance['particle-spread'] * (finale ? particles.finaleSpreadFactor : 1)
  for (let k = 0; k < nombre; k++) {
    const p = document.createElement('span')
    const etincelle = k % ECLAT.etincelleTous === 0
    p.className = [
      'absolute left-0 top-0',
      etincelle
        ? 'h-3.5 w-3.5 -ml-1.75 -mt-1.75'
        : 'h-2 w-2 -ml-1 -mt-1 rounded-full',
      COULEURS[k % COULEURS.length],
    ].join(' ')
    if (etincelle) Object.assign(p.style, ETINCELLE)
    p.style.opacity = '0'
    origine.appendChild(p)
    crees.push(p)

    const angle = (k / nombre) * Math.PI * 2 + Math.random() * 0.5
    const portee = spread * (ECLAT.porteeMin + Math.random() * (1 - ECLAT.porteeMin))
    const dx = Math.cos(angle) * portee
    const dy = Math.sin(angle) * portee
    const rotation = (Math.random() - 0.5) * 360
    const controls = suivre(
      m.animate(
        p,
        {
          x: [0, dx * 0.8, dx],
          y: [0, dy * 0.8, dy + spread * ECLAT.chute],
          scale: [0.4, 1, 0.6],
          rotate: [0, rotation * 0.7, rotation],
          opacity: [1, 1, 0],
        },
        {
          duration: motionS('particles', false),
          delay: delaiMs / 1000,
          ease: OUT_QUINT,
          times: [0, ECLAT.pic, 1],
        }
      )
    )
    void controls.finished.then(() => p.remove())
  }
  return () => {
    for (const p of crees) p.remove()
  }
}

/**
 * The real "+N XP" of the sheet flies to the XP counter of the top bar (`xp-flight`, `ease-in`):
 * a copy of it, in a fixed layer, so the sheet keeps its own. Resolves once the copy has landed
 * (or the flight was ended by `terminer()`).
 */
export function envolerXp(source: HTMLElement, cible: HTMLElement): Promise<void> {
  const m = moteur()
  if (!m) return Promise.resolve()
  const a = source.getBoundingClientRect()
  const b = cible.getBoundingClientRect()

  const couche = document.createElement('div')
  couche.setAttribute('aria-hidden', 'true')
  couche.setAttribute('data-envol-xp', '')
  couche.className = 'pointer-events-none fixed inset-0 z-50'
  const copie = source.cloneNode(true) as HTMLElement
  copie.removeAttribute('role')
  copie.removeAttribute('data-gain-xp')
  copie.classList.add('absolute', 'm-0')
  Object.assign(copie.style, { left: `${a.left}px`, top: `${a.top}px` })
  couche.appendChild(copie)
  document.body.appendChild(couche)

  const dx = b.left + b.width / 2 - (a.left + a.width / 2)
  const dy = b.top + b.height / 2 - (a.top + a.height / 2)
  // It lifts a little before heading up: twice a beat's rise, as in the prototype.
  const elan = distance['beat-rise'] * 2
  const controls = suivre(
    m.animate(
      copie,
      {
        x: [0, dx * 0.15, dx],
        y: [0, dy * 0.15 - elan, dy],
        scale: [1, 1.15, 0.6],
        opacity: [1, 1, 0.2],
      },
      {
        duration: motionS('xp-flight', false),
        ease: bezier(ease.in.bezier),
        times: [0, 0.25, 1],
      }
    )
  )
  return controls.finished.then(() => couche.remove())
}

/** A counter of the top bar bumps as a reward lands on it (`check`, `out-quint`). */
export function rebondir(el: Element | null | undefined, delaiMs = 0): void {
  const m = moteur()
  if (!m || !el) return
  suivre(
    m.animate(
      el,
      { scale: [1, 1.3, 1] },
      {
        duration: motionS('check', false),
        delay: delaiMs / 1000,
        ease: OUT_QUINT,
        times: [0, 0.35, 1],
      }
    )
  )
}

/**
 * Counts from `de` up to `a` over `count` (`out-quint`), or over `finale` at a linear pace for the
 * end slide; `terminer()` jumps to `a`.
 */
export function compter(
  de: number,
  a: number,
  surValeur: (v: number) => void,
  options: { duree?: DurationName; delaiMs?: number } = {}
): Controls | null {
  const m = moteur()
  if (!m) return null
  const duree = options.duree ?? 'count'
  return suivre(
    m.animate(de, a, {
      duration: motionS(duree, false),
      delay: (options.delaiMs ?? 0) / 1000,
      ease: duree === 'finale' ? 'linear' : OUT_QUINT,
      onUpdate: (v: number) => surValeur(Math.round(v)),
    })
  )
}

/** When the check mark and the particles start: at 60 % of the sheet's rise (MOTION.md). */
export const DELAI_COCHE_MS = duration.sheet * 0.6

/** When the XP flight starts at the earliest, from the moment the sheet starts rising. */
export const DELAI_ENVOL_MS = duration.sheet + duration['xp-delay']

// --- The top-bar counters, held while a reward is on its way to them. ---

/** The values the counters keep showing until the flight lands: the ones before the answer. */
export type Retenue = { xp: number; serie: number | null }

/** A flight just landed: the counters count up from these values. */
export type Atterrissage = { id: number; xpDe: number; serieDe: number | null }

export type EtatCompteurs = { retenue: Retenue | null; atterrissage: Atterrissage | null }

let etat: EtatCompteurs = { retenue: null, atterrissage: null }
const abonnes = new Set<() => void>()

function ecrire(suivant: EtatCompteurs) {
  etat = suivant
  for (const abonne of Array.from(abonnes)) abonne()
}

export function abonnerCompteurs(abonne: () => void): () => void {
  abonnes.add(abonne)
  return () => {
    abonnes.delete(abonne)
  }
}

export function lireCompteurs(): EtatCompteurs {
  return etat
}

/** A flight is coming: the counters keep the values from before the answer. */
export function retenir(retenue: Retenue): void {
  ecrire({ ...etat, retenue })
}

/** The flight landed: the counters bump and count up to the real values. */
export function atterrir(): void {
  if (!etat.retenue) return
  ecrire({
    retenue: null,
    atterrissage: {
      id: (etat.atterrissage?.id ?? 0) + 1,
      xpDe: etat.retenue.xp,
      serieDe: etat.retenue.serie,
    },
  })
}

/** The reward was cut short: the counters show the real values at once, without a bump. */
export function relacher(): void {
  if (etat.retenue) ecrire({ ...etat, retenue: null })
}
