'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import {
  fileSignalementsSalon,
  masquerMessageSalon,
  type SalonSignalementVue,
} from '@brio/api-client'

import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { horodatage, messageErreur } from '@/components/messagerie/messagerie-format'
import { apiBaseUrl } from '@/lib/api-base-url'

// The teacher's moderation queue for the class salons (F6b, ADR 0033): open reports, oldest
// first. The one action the server offers here is to hide the message, which also closes its
// reports. Sanctions are applied from the entraide queue, where the class is known.

export function FileSignalementsSalon() {
  const [file, setFile] = useState<SalonSignalementVue[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      setFile(await fileSignalementsSalon(apiBaseUrl()))
      setErreur(null)
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de charger les signalements.'))
    }
  }, [])

  useEffect(() => {
    void charger()
  }, [charger])

  return (
    <div data-theme="light" className="min-h-screen bg-surface-page font-prose text-ink">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-panel px-4 py-3">
        <Link
          href="/prof"
          aria-label="Retour à l'espace enseignant"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line text-ink-muted hover:text-ink"
        >
          <Icon name="arrow-left" size={16} aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 font-display text-lg font-extrabold text-ink">
          Signalements du salon
        </h1>
        <Button variant="ghost" size="sm" onClick={() => void charger()}>
          Actualiser
        </Button>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <p className="text-sm text-ink-muted">
          Les messages du salon de classe que tes élèves t’ont signalés. Masquer retire le message
          de la vue des élèves et clôt ses signalements.
        </p>

        {erreur && (
          <p
            role="alert"
            className="rounded-lg border border-danger bg-surface-panel px-4 py-2 text-sm text-danger"
          >
            {erreur}
          </p>
        )}
        {!file && !erreur && <p className="text-ink-muted">Chargement…</p>}

        {file?.length === 0 && (
          <p className="rounded-lg border border-line bg-surface-panel p-4 text-ink-muted">
            Aucun signalement en attente.
          </p>
        )}

        {file && file.length > 0 && (
          <ul className="flex flex-col gap-3">
            {file.map((s) => (
              <li key={s.id}>
                <Signalement signalement={s} onTraite={charger} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

type SignalementProps = {
  signalement: SalonSignalementVue
  onTraite: () => Promise<void>
}

function Signalement({ signalement: s, onTraite }: SignalementProps) {
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function masquer() {
    setOccupe(true)
    setErreur(null)
    try {
      await masquerMessageSalon(apiBaseUrl(), s.messageId)
      await onTraite()
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de masquer ce message.'))
      setOccupe(false)
    }
  }

  return (
    <article
      aria-label={`Signalement dans « ${s.salonTitre} »`}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface-panel p-4"
    >
      <div className="flex flex-col gap-0.5">
        <p className="font-display text-sm font-extrabold text-ink">{s.salonTitre}</p>
        <p className="text-xs text-ink-muted">
          Message de {s.auteurMessageNom} · signalé le {horodatage(s.createdAt)}
        </p>
      </div>

      <blockquote className="whitespace-pre-line rounded-md border-l-4 border-warning bg-surface-raised px-3 py-2 text-sm text-ink">
        {s.extraitMessage}
      </blockquote>

      <p className="text-sm text-ink-muted">
        Motif : {s.motif ? <span className="text-ink">{s.motif}</span> : 'non précisé'}
      </p>

      {erreur && (
        <p role="alert" className="text-sm text-danger">
          {erreur}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => void masquer()} loading={occupe}>
          <Icon name="eye-slash" size={16} aria-hidden="true" />
          Masquer le message
        </Button>
      </div>
    </article>
  )
}
