'use client'

import { useState } from 'react'

import { ModerationError, signalerContenu, type CibleType } from '@brio/api-client'

import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { apiBaseUrl } from '@/lib/api-base-url'

type Props = {
  cible: CibleType
  id: string
  /** On ne signale pas son propre contenu : le bouton ne s'affiche alors pas. */
  estAuteur: boolean
}

/**
 * Signaler une question ou une réponse à la modération (suivi #338). Deux temps : le bouton ouvre
 * un motif facultatif, puis l'envoi. Une fois signalé, l'état reste affiché (idempotent côté
 * serveur par membre).
 */
export function BoutonSignaler({ cible, id, estAuteur }: Props) {
  const [ouvert, setOuvert] = useState(false)
  const [motif, setMotif] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [signale, setSignale] = useState(false)
  const [erreur, setErreur] = useState<string>()

  if (estAuteur) return null

  if (signale) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
        <Icon name="flag" size={16} aria-hidden="true" />
        Signalé
      </span>
    )
  }

  async function envoyer() {
    setEnvoi(true)
    setErreur(undefined)
    try {
      await signalerContenu(apiBaseUrl(), cible, id, motif)
      setSignale(true)
      setOuvert(false)
    } catch (e) {
      setErreur(e instanceof ModerationError ? e.message : 'Impossible de signaler ce contenu.')
    } finally {
      setEnvoi(false)
    }
  }

  if (!ouvert) {
    return (
      <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setOuvert(true)}>
        <Icon name="flag" size={16} aria-hidden="true" />
        Signaler
      </Button>
    )
  }

  return (
    <div role="group" aria-label="Signaler ce contenu" className="flex w-full flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-ink">Pourquoi signaler ? (facultatif)</span>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={2}
          className="rounded-md border-2 border-line bg-surface-raised px-3 py-2 font-prose text-sm text-ink focus:border-accent focus:outline-none"
        />
      </label>
      {erreur && (
        <p role="alert" className="font-prose text-sm text-feedback-incorrect">
          {erreur}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="min-h-11"
          loading={envoi}
          onClick={envoyer}
        >
          Envoyer le signalement
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="min-h-11"
          onClick={() => {
            setOuvert(false)
            setErreur(undefined)
          }}
        >
          Annuler
        </Button>
      </div>
    </div>
  )
}
