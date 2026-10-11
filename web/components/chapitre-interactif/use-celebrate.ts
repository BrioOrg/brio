'use client'

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useProgression } from '@/components/progression-context'
import { peutAnimer, surTerminer } from './animation'
import {
  DELAI_COCHE_MS,
  DELAI_ENVOL_MS,
  atterrir,
  eclater,
  envolerXp,
  poserCoche,
  relacher,
  retenir,
} from './celebration'
import { useModeChapitre } from './mode-context'

/**
 * The last gain and streak change already reported when the student checked their answer (their
 * ids, 0 for none): only a later one belongs to this answer. Taken at submission, not when the
 * sheet opens, since the gain can be known before the sheet renders.
 */
export type AvantReponse = { gain: number; serie: number }

/**
 * The sequence of a correct answer in interactive mode (MOTION.md, "Timeline of a correct
 * answer"): the sheet rises, the check mark and the particles start at 60 % of it, then the real
 * XP gain flies to the top-bar counter, which bumps and counts up. One moment after the other.
 *
 * Only the real gain flies (ADR 0022). `refresh()` learns it a little after the answer, since XP
 * is awarded asynchronously: the flight leaves at `sheet + xp-delay`, or as soon as the gain is
 * known if later. No gain, no flight. Any press ends it all at its end state (budget rule 4), and
 * a gain learned after that, or after the sheet closed, simply updates the counter.
 *
 * A wrong answer gets nothing from here: `juste` false makes this hook inert.
 */
export function useCelebrate(
  juste: boolean,
  feuille: RefObject<HTMLElement | null>,
  avant: AvantReponse
): void {
  const ctx = useModeChapitre()
  const reduit = ctx?.reducedMotion ?? true
  const { info, gain, serieChange } = useProgression()

  // When the sheet opened, and what was known before the answer.
  const depart = useRef<({ t: number } & AvantReponse) | null>(null)
  const fini = useRef(false)
  const envol = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    depart.current = { t: performance.now(), ...avant }
    fini.current = false
    if (!juste || !peutAnimer(reduit)) return
    const el = feuille.current
    poserCoche(el?.querySelector('[data-icone-resultat]'), DELAI_COCHE_MS)
    const effacer = eclater(el?.querySelector<HTMLElement>('[data-eclats]'), DELAI_COCHE_MS)

    const couper = () => {
      fini.current = true
      if (envol.current !== null) clearTimeout(envol.current)
      envol.current = null
      relacher()
    }
    const desinscrire = surTerminer(couper)
    return () => {
      desinscrire()
      couper()
      effacer()
    }
    // Once per sheet: the sheet remounts for each answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A layout effect: the counters must keep the old values from the very render that brought the
  // gain, or they would show the new total for a frame before the flight.
  useLayoutEffect(() => {
    const d = depart.current
    if (!juste || !d || fini.current || envol.current !== null) return
    if (!gain || gain.id <= d.gain || !info || !peutAnimer(reduit)) return
    const cible = document.querySelector<HTMLElement>('[data-compteur-xp]')
    if (!cible) return

    const serieAvant = serieChange && serieChange.id > d.serie ? serieChange.avant : null
    retenir({ xp: info.xpTotal - gain.amount, serie: serieAvant })
    envol.current = setTimeout(
      () => {
        const source =
          feuille.current?.querySelector<HTMLElement>('[data-gain-xp]') ??
          feuille.current?.querySelector<HTMLElement>('[data-icone-resultat]')
        if (!source || fini.current) {
          relacher()
          return
        }
        void envolerXp(source, cible).then(() => {
          if (!fini.current) atterrir()
        })
      },
      Math.max(0, d.t + DELAI_ENVOL_MS - performance.now())
    )
  }, [juste, gain, info, serieChange, reduit, feuille])

  // Reduced motion switched on mid-sequence: nothing is held any more.
  useEffect(() => {
    if (reduit) relacher()
  }, [reduit])
}
