'use client'

import { useEffect, useState } from 'react'
import { getParcours } from '@/lib/progression'
import { getMoi } from '@/lib/session'

type Props = {
  niveau: string
  matiere: string
  slug: string
}

/**
 * Slim progress gauge above the chapter, showing the student's real completion of
 * this chapter (fr.brio.progression — sections read + exercises solved). Shown only
 * to a logged-in student whose path includes this chapter: a teacher or a logged-out
 * visitor sees nothing. Never a fabricated value (CLAUDE.md "Never display data the
 * backend does not have"). No lives/hearts — progress encourages, it doesn't punish.
 */
export function ChapterProgress({ niveau, matiere, slug }: Props) {
  const [pourcentage, setPourcentage] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const moi = await getMoi()
        if (!alive || !moi || moi.role !== 'eleve') return // only students have a path
        const parcours = await getParcours(niveau, matiere)
        if (!alive || !parcours) return // null = logged out → nothing
        const chapitre = parcours.find((c) => c.chapitreId === slug)
        if (chapitre) {
          setPourcentage(Math.max(0, Math.min(100, Math.round(chapitre.pourcentage))))
        }
      } catch {
        // Réseau / parse : on n'affiche pas de jauge plutôt que d'inventer un chiffre.
      }
    })()
    return () => {
      alive = false
    }
  }, [niveau, matiere, slug])

  if (pourcentage === null) return null

  const termine = pourcentage >= 100

  return (
    <div className="mb-6">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
          {termine ? 'Chapitre terminé' : 'Ta progression'}
        </span>
        <span className="font-display text-xs font-extrabold tabular-nums text-accent">
          {`${pourcentage} %`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pourcentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progression du chapitre : ${pourcentage} %`}
        className="h-2 overflow-hidden rounded-pill bg-surface-raised"
      >
        <div
          className="h-full rounded-pill bg-accent transition-all duration-500 motion-reduce:transition-none"
          style={{ width: `${pourcentage}%` }}
        />
      </div>
    </div>
  )
}
