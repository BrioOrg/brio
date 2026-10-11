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

type Motion = typeof import('./motion-animate')
export type Controls = ReturnType<Motion['animate']>

let chargement: Promise<Motion> | null = null
let motion: Motion | null = null

/** Starts loading `motion`; slides swap instantly until it is there. */
export function chargerMotion(): Promise<unknown> {
  chargement ??= import('./motion-animate').then((m) => (motion = m))
  return chargement
}

/** `motion`, once loaded; null until then (and in the reading mode, which never loads it). */
export function moteur(): Motion | null {
  return motion
}

const enCours = new Set<Controls>()
const aTerminer = new Set<() => void>()
let finirSortie: (() => void) | null = null

/** Ends every running animation of the interactive mode at once, at its end state. */
export function terminer(): void {
  for (const controls of enCours) controls.complete()
  enCours.clear()
  finirSortie?.()
  for (const fin of Array.from(aTerminer)) fin()
}

/**
 * Something that is not a `motion` animation but must end with them (a pending timer, the
 * exercise rewards of #248). Returns what unregisters it.
 */
export function surTerminer(fin: () => void): () => void {
  aTerminer.add(fin)
  return () => {
    aTerminer.delete(fin)
  }
}

export function bezier(curve: Bezier): [number, number, number, number] {
  return [...curve]
}

/** Whether a transition can animate now: `motion` loaded and no reduced motion asked. */
export function peutAnimer(reducedMotion: boolean): boolean {
  return motion !== null && !reducedMotion
}

/**
 * Takes the frames of the slide being left out of the flow, where they are, so the next slide
 * enters in their place while they leave on top of it. Call it before the new slide renders.
 * `decalageX` is how far a swipe has moved them. The container keeps its height meanwhile, so
 * what follows the slide (the previous / next controls) does not jump over the leaving slide.
 * Returns what puts everything back.
 */
export function detacher(
  frames: HTMLElement[],
  conteneur: HTMLElement,
  decalageX: number
): () => void {
  const origine = conteneur.getBoundingClientRect()
  conteneur.style.minHeight = `${origine.height}px`
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
  return () => {
    conteneur.style.removeProperty('min-height')
    for (const frame of frames) {
      for (const p of [
        'position',
        'top',
        'left',
        'width',
        'pointer-events',
        'transform',
        'opacity',
      ]) {
        frame.style.removeProperty(p)
      }
    }
  }
}

/** Tracks an animation so that `terminer()` can end it. */
export function suivre(controls: Controls): Controls {
  enCours.add(controls)
  void controls.finished.then(() => enCours.delete(controls))
  return controls
}

/**
 * Slide exit and entry, run together: the old slide fades out and slides `shift` px against the
 * direction of travel, the new one fades in and slides `shift` px in that direction. `depuisX` is
 * where a swipe left the old slide. `rattacher` (from `detacher`) and then `fin` run once the old
 * slide is gone, animated or skipped.
 */
export function transition(
  sortants: HTMLElement[],
  rattacher: () => void,
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
    rattacher()
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

/** Puts back what a beat leaves inline once it has landed: the end state is the element's own. */
function nettoyer(controls: Controls, elements: HTMLElement[]): void {
  // A frame later: `motion` writes the final values inline after `finished` settles.
  void controls.finished.then(() =>
    requestAnimationFrame(() => {
      for (const el of elements) {
        el.style.removeProperty('transform')
        el.style.removeProperty('opacity')
      }
    })
  )
}

/**
 * The beats of a slide entering (MOTION.md "Staggered beats"): each block of its frames, the kicker
 * first, rises `beat-rise` px and fades in, one `stagger` after the other. `entreeSection` (a new
 * section, or the opening) gives the first beat, the section title, its own entry: it rises
 * `slide-shift` px over `slide-in`. It adds no delay to the beats after it, so an exercise opening a
 * section still has its answers in place at 290 ms (budget rule 3).
 */
export function temps(frames: HTMLElement[], entreeSection: boolean): void {
  const m = motion
  if (m === null) return
  const beats = frames.flatMap((frame) =>
    Array.from(frame.children).filter((el): el is HTMLElement => el instanceof HTMLElement)
  )
  beats.forEach((el, i) => {
    const titre = i === 0 && entreeSection
    // Hidden before the first frame: a delayed beat must not show, then vanish, then rise.
    el.style.opacity = '0'
    const controls = suivre(
      m.animate(
        el,
        {
          y: [titre ? distance['slide-shift'] : distance['beat-rise'], 0],
          opacity: [0, 1],
        },
        {
          duration: motionS(titre ? 'slide-in' : 'beat', false),
          delay: motionS('stagger', false) * i,
          ease: bezier(ease.standard.bezier),
        }
      )
    )
    nettoyer(controls, [el])
  })
}

/** A step of a `steps` block revealed (MOTION.md "Step reveal"): it arrives as one more beat. */
export function reveler(el: HTMLElement, reducedMotion: boolean): void {
  const m = motion
  if (m === null || reducedMotion) return
  const controls = suivre(
    m.animate(
      el,
      { y: [distance['beat-rise'], 0], opacity: [0, 1] },
      { duration: motionS('beat', false), ease: bezier(ease.standard.bezier) }
    )
  )
  nettoyer(controls, [el])
}
