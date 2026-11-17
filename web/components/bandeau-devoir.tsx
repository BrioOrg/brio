'use client'

import { useEffect, useState } from 'react'

import { listerMesDevoirs, type DevoirEleveVue } from '@brio/api-client'

import { Icon } from '@/components/ui/icon'
import { apiBaseUrl } from '@/lib/api-base-url'
import { formatEcheance } from '@/lib/echeance'

/** The page the banner sits on: a catalogue chapter (by slug) or a teacher course (by id). */
type BandeauDevoirProps = { devoirId: string; slug: string } | { devoirId: string; coursId: string }

/**
 * The reminder above a chapter or a course opened from a homework (`?devoir=` on its URL).
 * Everything comes from the student's own homework list: an id that isn't theirs, or that points
 * to another chapter or course, shows nothing. A failed load shows nothing either: the page stays
 * readable.
 */
export function BandeauDevoir(props: BandeauDevoirProps) {
  const { devoirId } = props
  const [sourceType, sourceRef] =
    'coursId' in props ? ['cours', props.coursId] : ['chapitre', props.slug]
  const [devoir, setDevoir] = useState<DevoirEleveVue | null>(null)

  useEffect(() => {
    let vivant = true
    listerMesDevoirs(apiBaseUrl())
      .then((liste) => {
        const trouve = liste?.find(
          (d) => d.id === devoirId && d.sourceType === sourceType && d.sourceRef === sourceRef
        )
        if (vivant) setDevoir(trouve ?? null)
      })
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [devoirId, sourceType, sourceRef])

  if (!devoir) return null

  const qui = devoir.enseignant ? `Devoir de ${devoir.enseignant}` : 'Devoir'
  return (
    <p className="mb-4 flex items-center gap-2 rounded-lg border border-accent bg-accent-soft px-4 py-2 font-prose text-sm font-semibold text-accent-ink">
      <Icon name="check" size={16} aria-hidden="true" />
      {qui} · à rendre le {formatEcheance(devoir.echeanceAt)}
    </p>
  )
}
