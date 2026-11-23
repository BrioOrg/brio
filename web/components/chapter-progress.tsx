'use client'

import { useEffect, useState } from 'react'
import { useModeChapitre } from '@/components/chapitre-interactif/mode-context'
import { getParcours, getProgressionCours } from '@/lib/progression'
import { getMoi } from '@/lib/session'

/** A catalogue chapter, found on the student's path, or a teacher course and its gauge (ADR 0050). */
type Props =
  | { niveau: string; matiere: string; slug: string; coursId?: undefined }
  | { coursId: string; niveau?: undefined; matiere?: undefined; slug?: undefined }

/**
 * Slim progress gauge above the chapter, showing the student's real completion of
 * this chapter (fr.brio.progression — sections read + exercises solved). Shown only
 * to a logged-in student whose path includes this chapter: a teacher or a logged-out
 * visitor sees nothing. Never a fabricated value (CLAUDE.md "Never display data the
 * backend does not have"). No lives/hearts — progress encourages, it doesn't punish.
 * Reloads when a section read has been counted (#252), so the gauge moves while reading.
 */
export function ChapterProgress({ niveau, matiere, slug, coursId }: Props) {
  const [pourcentage, setPourcentage] = useState<number | null>(null)
  const revision = useModeChapitre()?.revisionProgression ?? 0

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const moi = await getMoi()
        if (!alive || !moi || moi.role !== 'eleve') return // only students have a path
        const lu =
          coursId !== undefined
            ? // 204 (never opened, or unknown to progression) → null → no gauge, never 0 %.
              ((await getProgressionCours(coursId))?.pourcentage ?? null)
            : ((await getParcours(niveau!, matiere!))?.find((c) => c.chapitreId === slug)
                ?.pourcentage ?? null)
        if (!alive || lu === null) return // logged out, or no value → nothing
        setPourcentage(Math.max(0, Math.min(100, Math.round(lu))))
      } catch {
        // Réseau / parse : on n'affiche pas de jauge plutôt que d'inventer un chiffre.
      }
    })()
    return () => {
      alive = false
    }
  }, [niveau, matiere, slug, coursId, revision])

  if (pourcentage === null) return null

  const termine = pourcentage >= 100

  return (
    <div className="mb-6">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
          {termine
            ? coursId !== undefined
              ? 'Cours terminé'
              : 'Chapitre terminé'
            : 'Ta progression'}
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
        aria-label={`Progression du ${coursId !== undefined ? 'cours' : 'chapitre'} : ${pourcentage} %`}
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
