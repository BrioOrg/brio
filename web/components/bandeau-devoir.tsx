'use client'

import { useEffect, useState } from 'react'

import { listerMesDevoirs, type DevoirEleveVue } from '@brio/api-client'

import { Icon } from '@/components/ui/icon'
import { apiBaseUrl } from '@/lib/api-base-url'
import { formatEcheance } from '@/lib/echeance'

/**
 * The reminder above a chapter opened from a homework (`?devoir=` on its URL). Everything comes
 * from the student's own homework list: an id that isn't theirs, or that points to another
 * chapter, shows nothing. A failed load shows nothing either: the chapter stays readable.
 */
export function BandeauDevoir({ devoirId, slug }: { devoirId: string; slug: string }) {
  const [devoir, setDevoir] = useState<DevoirEleveVue | null>(null)

  useEffect(() => {
    let vivant = true
    listerMesDevoirs(apiBaseUrl())
      .then((liste) => {
        const trouve = liste?.find(
          (d) => d.id === devoirId && d.sourceType === 'chapitre' && d.sourceRef === slug
        )
        if (vivant) setDevoir(trouve ?? null)
      })
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [devoirId, slug])

  if (!devoir) return null

  const qui = devoir.enseignant ? `Devoir de ${devoir.enseignant}` : 'Devoir'
  return (
    <p className="mb-4 flex items-center gap-2 rounded-lg border border-accent bg-accent-soft px-4 py-2 font-prose text-sm font-semibold text-accent-ink">
      <Icon name="check" size={16} aria-hidden="true" />
      {qui} · à rendre le {formatEcheance(devoir.echeanceAt)}
    </p>
  )
}
