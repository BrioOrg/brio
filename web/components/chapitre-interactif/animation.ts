import { distance, ease, motionS, type Bezier } from '@/lib/motion-tokens'

/**
 * Slide transitions of the interactive mode (MOTION.md "What moves", ADR 0032 §7).
 *
 * `motion` is imported dynamically: only the interactive mode loads it, the reading mode pays
 * nothing. The frames stay mounted across modes (so exercise state survives a switch), which rules
 * out `AnimatePresence` and `m.*` wrappers: changing a wrapper's type would remount the blocks.
 * Frames are animated imperatively with `animate()` instead.
 *
 * Only `transform` and `opacity` animate. Every animation can be skipped: `terminer()` jumps all
 * running ones to their end state before the next action (budget rule 4).
 */

type Motion = typeof import('motion')
type Controls = ReturnType<Motion['animate']>

let chargement: Promise<Motion> | null = null
let motion: Motion | null = null

/** Starts loading `motion`; slides swap instantly until it is there. */
export function chargerMotion(): void {
  chargement ??= import('motion').then((m) => (motion = m))
}

const enCours = new Set<Controls>()
let finirSortie: (() => void) | null = null

/** Ends every running slide animation at once, at its end state. */
export function terminer(): void {
  for (const controls of enCours) controls.complete()
  enCours.clear()
  finirSortie?.()
}

function bezier(curve: Bezier): [number, number, number, number] {
  return [...curve]
}

/** Whether a transition can animate now: `motion` loaded and no reduced motion asked. */
export function peutAnimer(reducedMotion: boolean): boolean {
  return motion !== null && !reducedMotion
}

/**
 * Takes the frames of the slide being left out of the flow, where they are, so the next slide
 * enters in their place while they leave on top of it. Call it before the new slide renders.
 * `decalageX` is how far a swipe has moved them.
 */
export function detacher(frames: HTMLElement[], conteneur: HTMLElement, decalageX: number): void {
  const origine = conteneur.getBoundingClientRect()
  for (const frame of frames) {
    const r = frame.getBoundingClientRect()
    Object.assign(frame.style, {
      position: 'absolute',
      top: `${r.top - origine.top}px`,
      // Measured where a swipe left it: the transform is not part of its place in the flow.
      left: `${r.left - origine.left - decalageX}px`,
      width: `${r.width}px`,
      pointerEvents: 'none',
    })
  }
}

function rattacher(frames: HTMLElement[]): void {
  for (const frame of frames) {
    for (const p of ['position', 'top', 'left', 'width', 'pointerEvents', 'transform', 'opacity']) {
      frame.style.removeProperty(p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`))
    }
  }
}

function suivre(controls: Controls): Controls {
  enCours.add(controls)
  void controls.finished.then(() => enCours.delete(controls))
  return controls
}

/**
 * Slide exit and entry, run together: the old slide fades out and slides `shift` px against the
 * direction of travel, the new one fades in and slides `shift` px in that direction. `depuisX` is
 * where a swipe left the old slide. `fin` runs once the old slide is gone, animated or skipped.
 */
export function transition(
  sortants: HTMLElement[],
  entrants: HTMLElement[],
  direction: 1 | -1,
  depuisX: number,
  fin: () => void
): void {
  const shift = distance['slide-shift']
  let fini = false
  finirSortie = () => {
    if (fini) return
    fini = true
    finirSortie = null
    rattacher(sortants)
    fin()
  }
  if (motion === null) {
    finirSortie()
    return
  }
  const sortie = suivre(
    motion.animate(
      sortants,
      { x: [depuisX, -direction * shift], opacity: [1, 0] },
      { duration: motionS('slide-out', false), ease: bezier(ease.in.bezier) }
    )
  )
  void sortie.finished.then(() => finirSortie?.())
  suivre(
    motion.animate(
      entrants,
      { x: [direction * shift, 0], opacity: [0, 1] },
      { duration: motionS('slide-in', false), ease: bezier(ease.in.bezier) }
    )
  )
}

/** A swipe let go short of the threshold: the slide returns under the finger's start. */
export function revenir(frames: HTMLElement[], depuisX: number, reducedMotion: boolean): void {
  if (motion === null || reducedMotion) {
    for (const frame of frames) frame.style.removeProperty('transform')
    return
  }
  suivre(
    motion.animate(
      frames,
      { x: [depuisX, 0] },
      { duration: motionS('slide-in', false), ease: bezier(ease.standard.bezier) }
    )
  )
}
