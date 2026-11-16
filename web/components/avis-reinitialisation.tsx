'use client'

import { useEffect, useState } from 'react'
import type { CompteInfo } from '@brio/api-client'
import { Icon } from '@/components/ui/icon'
import { getMoi } from '@/lib/session'

type Avis = NonNullable<CompteInfo['accesReinitialise']>

/** Per-device memory of a closed notice, keyed by the reset's date: a new reset shows again. */
const CLE = 'brio.avis-reinitialisation.ferme'

function dejaFerme(le: string): boolean {
  try {
    return window.localStorage.getItem(CLE) === le
  } catch {
    return false
  }
}

function retenirFermeture(le: string) {
  try {
    window.localStorage.setItem(CLE, le)
  } catch {
    // Storage refused (private mode): the notice simply closes for this page view.
  }
}

function dateLongue(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

/**
 * Tells a student their access was reset (ADR 0036 §8), on the first pages after they chose their
 * own password. Everything shown comes from the server (`accesReinitialise`: when, and which kind
 * of adult); nothing is shown otherwise. Closing it is remembered on this device only — the
 * server keeps telling for its horizon, so an adult who chose the password in the student's place
 * cannot hide the notice from the student's own device.
 */
export function AvisReinitialisation() {
  const [avis, setAvis] = useState<Avis | null>(null)

  useEffect(() => {
    let vivant = true
    getMoi()
      .then((moi) => {
        const a = moi?.accesReinitialise
        if (vivant && a && !dejaFerme(a.le)) setAvis(a)
      })
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [])

  if (!avis) return null

  const par = avis.par === 'admin_brio' ? 'par l’équipe brio' : 'par ton prof'

  return (
    <div
      role="status"
      className="flex items-start gap-3 border-b border-line bg-surface-raised px-4 py-3 font-prose text-sm text-ink"
    >
      <Icon name="warning-circle" weight="bold" size={18} className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1">
        Ton accès a été réinitialisé le {dateLongue(avis.le)} {par}. Si ce n’est pas toi qui as
        choisi ton mot de passe, préviens ton prof.
      </p>
      <button
        type="button"
        aria-label="Fermer ce message"
        onClick={() => {
          retenirFermeture(avis.le)
          setAvis(null)
        }}
        className="shrink-0 rounded-sm text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Icon name="x" weight="bold" size={18} />
      </button>
    </div>
  )
}
