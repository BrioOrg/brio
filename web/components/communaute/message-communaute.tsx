'use client'

import type { AuteurCommunaute } from '@brio/api-client'
import { useState, type ReactNode } from 'react'

import { BlocsCommunaute } from '@/components/blocs/blocs-communaute'
import { EditeurMessage, type MessageEcrit } from '@/components/communaute/editeur-message'
import { Button } from '@/components/ui/button'
import { dateMessage, libelleAuteur, messageErreur } from '@/lib/communaute'

type Mode = 'question' | 'reponse' | 'commentaire'

const NOM: Record<Mode, string> = {
  question: 'ma question',
  reponse: 'ma réponse',
  commentaire: 'mon commentaire',
}

type Props = {
  mode: Mode
  auteur: AuteurCommunaute
  createdAt: string
  modifie: boolean
  corps: readonly unknown[]
  estAuteur: boolean
  /** A question's title, which its composer edits too. */
  titre?: string
  /** Above the body, hidden while editing. */
  enTete?: ReactNode
  /** Next to the author's own edit and delete buttons: vote, resolution, comment. */
  actions?: ReactNode
  /** What deleting also does, when it is more than removing the message. */
  avertissementSuppression?: string
  onModifier: (message: MessageEcrit) => Promise<void>
  onSupprimer: () => Promise<void>
}

/**
 * One message of a thread, whatever its level: who wrote it, its body, and what its author can do to
 * it (ADR 0035 §11). Deleting asks first, on the spot: a browser dialog does not fit a phone flow.
 */
export function MessageCommunaute({
  mode,
  auteur,
  createdAt,
  modifie,
  corps,
  estAuteur,
  titre,
  enTete,
  actions,
  avertissementSuppression,
  onModifier,
  onSupprimer,
}: Props) {
  const [edition, setEdition] = useState(false)
  const [suppression, setSuppression] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string>()

  async function enregistrer(message: MessageEcrit) {
    await onModifier(message)
    setEdition(false)
  }

  async function supprimer() {
    setEnvoi(true)
    setErreur(undefined)
    try {
      await onSupprimer()
    } catch (e) {
      setErreur(messageErreur(e, 'Ton message n’a pas pu être supprimé.'))
      setEnvoi(false)
    }
  }

  if (edition) {
    return (
      <EditeurMessage
        mode={mode}
        valeurInitiale={{ titre, corps }}
        libelleEnvoyer="Enregistrer"
        onEnvoyer={enregistrer}
        onAnnuler={() => setEdition(false)}
      />
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {enTete}
      <p className="font-prose text-sm text-ink-muted">
        <span className="font-semibold text-ink">{libelleAuteur(auteur)}</span> ·{' '}
        {dateMessage(createdAt)}
        {modifie && ' · modifié'}
      </p>
      <BlocsCommunaute blocs={corps} />

      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {estAuteur && !suppression && (
          <>
            <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setEdition(true)}>
              Modifier {NOM[mode]}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11"
              onClick={() => setSuppression(true)}
            >
              Supprimer {NOM[mode]}
            </Button>
          </>
        )}
      </div>

      {suppression && (
        <div role="group" aria-label="Confirmer la suppression" className="flex flex-col gap-2">
          <p className="font-prose text-sm text-ink">
            Supprimer {NOM[mode]} ? {avertissementSuppression}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="min-h-11"
              loading={envoi}
              onClick={supprimer}
            >
              Oui, supprimer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setSuppression(false)
                setErreur(undefined)
              }}
            >
              Garder
            </Button>
          </div>
        </div>
      )}

      {erreur && (
        <p role="alert" className="font-prose text-sm text-feedback-incorrect">
          {erreur}
        </p>
      )}
    </div>
  )
}
