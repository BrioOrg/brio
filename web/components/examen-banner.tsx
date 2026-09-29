'use client'

import { useEffect, useState } from 'react'
import { examenActif, rendreExamen, type ExamenActif } from '@brio/api-client'
import { apiBaseUrl } from '@/lib/api-base-url'

/**
 * Bandeau du mode examen (F7, ADR 0027) : pendant un examen d'annale ouvert, il rappelle le chrono
 * et permet de rendre. Le tuteur est déjà coupé côté serveur ; ce bandeau est le repère visuel.
 * Ne rend rien s'il n'y a pas d'examen en cours (ou si la vérification échoue).
 */
function formatReste(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function ExamenBanner() {
  const [examen, setExamen] = useState<ExamenActif | null>(null)
  const [reste, setReste] = useState(0)
  const [rendu, setRendu] = useState(false)

  useEffect(() => {
    let vivant = true
    examenActif(apiBaseUrl())
      .then((e) => {
        if (vivant && e.enExamen) setExamen(e)
      })
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [])

  useEffect(() => {
    if (!examen?.endsAt) return
    const fin = new Date(examen.endsAt).getTime()
    const tick = () => setReste(fin - Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [examen])

  if (!examen || rendu) return null

  async function rendre() {
    if (!examen?.sessionId) return
    try {
      await rendreExamen(apiBaseUrl(), examen.sessionId)
    } catch {
      // On masque quand même le bandeau : le serveur clôt à l'échéance de toute façon.
    }
    setRendu(true)
  }

  const tempsEcoule = reste <= 0

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-accent bg-accent px-4 py-2 font-display text-sm font-extrabold text-surface-panel"
    >
      <span>🔒 Examen en cours{examen.titre ? ` · ${examen.titre}` : ''}</span>
      <span className="ml-auto tabular-nums">
        {tempsEcoule ? 'Temps écoulé' : `⏱ ${formatReste(reste)}`}
      </span>
      <button
        type="button"
        onClick={rendre}
        className="rounded-md bg-surface-panel px-3 py-1 font-display text-sm font-extrabold text-accent-ink"
      >
        Rendre
      </button>
    </div>
  )
}
