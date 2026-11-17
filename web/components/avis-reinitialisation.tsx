'use client'

import { useEffect, useState } from 'react'
import type { CompteInfo } from '@brio/api-client'
import { Icon } from '@/components/ui/icon'
import { getMoi } from '@/lib/session'

type Avis = NonNullable<CompteInfo['accesReinitialise']>

/**
 * Per-device memory of a closed notice, one key per account (a shared computer serves several
 * students), holding the reset's date: a new reset shows again.
 */
function cle(compteId: string): string {
  return `brio.avis-reinitialisation.ferme.${compteId}`
}

function dejaFerme(compteId: string, le: string): boolean {
  try {
    return window.localStorage.getItem(cle(compteId)) === le
  } catch {
    return false
  }
}

function retenirFermeture(compteId: string, le: string) {
  try {
    window.localStorage.setItem(cle(compteId), le)
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
  const [avis, setAvis] = useState<(Avis & { compteId: string }) | null>(null)

  useEffect(() => {
    let vivant = true
    getMoi()
      .then((moi) => {
        const a = moi?.accesReinitialise
        if (vivant && moi && a && !dejaFerme(moi.id, a.le)) setAvis({ ...a, compteId: moi.id })
      })
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [])

  if (!avis) return null

  // Whole sentences per case (ready for i18n): a student reset by the brio team may have no
  // class, hence no teacher to warn.
  const message =
    avis.par === 'admin_brio'
      ? `Ton accès a été réinitialisé le ${dateLongue(avis.le)} par l’équipe brio. Si ce n’est pas toi qui as choisi ton mot de passe, préviens un adulte de confiance : un parent ou un prof.`
      : `Ton accès a été réinitialisé le ${dateLongue(avis.le)} par ton prof. Si ce n’est pas toi qui as choisi ton mot de passe, préviens ton prof.`

  return (
    <div
      role="status"
      className="flex items-start gap-3 border-b border-line bg-surface-raised px-4 py-3 font-prose text-sm text-ink"
    >
      {/* Information, not an alarm: the reset was most likely the student's own request. */}
      <Icon name="info" weight="bold" size={18} className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1">{message}</p>
      <button
        type="button"
        aria-label="Fermer ce message"
        onClick={() => {
          retenirFermeture(avis.compteId, avis.le)
          setAvis(null)
        }}
        // At least 24 × 24 px to tap (WCAG 2.5.8); the negative margin keeps the row's height.
        className="-my-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Icon name="x" weight="bold" size={18} />
      </button>
    </div>
  )
}
