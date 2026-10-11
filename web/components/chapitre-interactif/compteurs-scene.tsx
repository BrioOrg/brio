'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Icon } from '@/components/ui/icon'
import { useProgression } from '@/components/progression-context'
import { duration } from '@/lib/motion-tokens'
import { peutAnimer } from './animation'
import { abonnerCompteurs, compter, lireCompteurs, rebondir } from './celebration'
import { useModeChapitre } from './mode-context'

/**
 * The student's real XP and day streak in the interactive top bar (#248): the site header, which
 * shows them in reading mode, is hidden there. A correct answer's XP flies here.
 *
 * Same rules as the header badges: nothing without a student session and a known value, and no
 * flame for a streak of 0. While a reward is on its way the counters keep the values from before
 * the answer; when it lands the XP bumps and counts up, then the flame bumps if the streak moved.
 * A streak that moved without any flight bumps at once. Nothing moves under reduced motion.
 */
export function CompteursScene() {
  const ctx = useModeChapitre()
  const reduit = ctx?.reducedMotion ?? true
  const { info, serie, serieChange } = useProgression()
  const { retenue, atterrissage } = useSyncExternalStore(
    abonnerCompteurs,
    lireCompteurs,
    lireCompteurs
  )
  const xpRef = useRef<HTMLSpanElement>(null)
  const flammeRef = useRef<HTMLSpanElement>(null)
  const [enCompte, setEnCompte] = useState<number | null>(null)

  // Only what happens while the bar is there: a landing or a change seen before does not replay.
  const atterrissageVu = useRef(atterrissage?.id ?? 0)
  const serieVue = useRef(serieChange?.id ?? 0)

  const total = info?.xpTotal
  useEffect(() => {
    if (!atterrissage || atterrissage.id <= atterrissageVu.current) return
    atterrissageVu.current = atterrissage.id
    if (total === undefined || !peutAnimer(reduit)) return
    rebondir(xpRef.current)
    const controls = compter(atterrissage.xpDe, total, setEnCompte)
    if (controls) void controls.finished.then(() => setEnCompte(null))
    // The flame comes after the count, never with it: one moment at a time.
    if (atterrissage.serieDe !== null) rebondir(flammeRef.current, duration.count)
  }, [atterrissage, total, reduit])

  useEffect(() => {
    if (!serieChange || serieChange.id <= serieVue.current) return
    serieVue.current = serieChange.id
    // Held for a flight: it bumps when the flight lands.
    if (lireCompteurs().retenue?.serie != null) return
    if (peutAnimer(reduit)) rebondir(flammeRef.current)
  }, [serieChange, reduit])

  if (!info) return null
  const xp = retenue?.xp ?? enCompte ?? info.xpTotal
  const jours = retenue?.serie ?? serie?.joursConsecutifs ?? 0

  return (
    <div className="flex shrink-0 items-center gap-3 font-display text-sm font-extrabold tabular-nums">
      {serie && jours > 0 && (
        <span
          ref={flammeRef}
          data-compteur-serie
          className="flex items-center gap-1 text-ink"
          title={`Série de ${jours} jour${jours > 1 ? 's' : ''}`}
        >
          <Icon name="flame" weight="bold" size={16} className="text-streak" />
          <span>{jours}</span>
          <span className="sr-only">jour{jours > 1 ? 's' : ''} de série</span>
        </span>
      )}
      <span ref={xpRef} data-compteur-xp className="flex items-center gap-1 text-ink">
        <Icon name="star" weight="bold" size={15} className="text-xp" />
        <span>{xp}</span>
        <span className="sr-only">points d&apos;expérience (XP)</span>
      </span>
    </div>
  )
}
