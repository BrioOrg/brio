'use client'

import { useEffect, useRef, useState } from 'react'

import { ModerationError, signalerContenu, type CibleType } from '@brio/api-client'

import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { apiBaseUrl } from '@/lib/api-base-url'

/** Le serveur tronque le motif au-delà (ModerationCommunauteService.MOTIF_MAX). */
const MOTIF_MAX = 1000

type Props = {
  cible: CibleType
  id: string
  /** On ne signale pas son propre contenu : le bouton ne s'affiche alors pas. */
  estAuteur: boolean
}

type Etat = 'ferme' | 'ouvert' | 'signale'

/**
 * Signaler une question ou une réponse à la modération (suivi #338). Deux temps : le bouton ouvre
 * un motif facultatif, puis l'envoi. Une fois signalé, un message de remerciement est annoncé
 * (role="status") et reçoit le focus ; « Annuler » rend le focus au bouton (WCAG 2.4.3, 4.1.3).
 */
export function BoutonSignaler({ cible, id, estAuteur }: Props) {
  const [etat, setEtat] = useState<Etat>('ferme')
  const [motif, setMotif] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string>()
  // Ne déplace le focus qu'après une action de l'élève, jamais au premier rendu.
  const aAgi = useRef(false)
  const boutonRef = useRef<HTMLButtonElement>(null)
  const merciRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!aAgi.current) return
    if (etat === 'ferme') boutonRef.current?.focus()
    if (etat === 'signale') merciRef.current?.focus()
  }, [etat])

  if (estAuteur) return null

  if (etat === 'signale') {
    return (
      <p
        ref={merciRef}
        role="status"
        tabIndex={-1}
        className="inline-flex items-center gap-1 rounded-sm text-sm text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Icon name="flag" size={16} aria-hidden="true" />
        Merci, l’équipe brio va regarder ce message.
      </p>
    )
  }

  function fermer() {
    aAgi.current = true
    setEtat('ferme')
    setErreur(undefined)
  }

  async function envoyer() {
    setEnvoi(true)
    setErreur(undefined)
    try {
      await signalerContenu(apiBaseUrl(), cible, id, motif)
      aAgi.current = true
      setEtat('signale')
    } catch (e) {
      setErreur(
        e instanceof ModerationError ? e.message : 'Ton signalement n’a pas pu être envoyé.'
      )
    } finally {
      setEnvoi(false)
    }
  }

  if (etat === 'ferme') {
    return (
      <Button
        ref={boutonRef}
        size="sm"
        variant="ghost"
        className="min-h-11"
        onClick={() => setEtat('ouvert')}
      >
        <Icon name="flag" size={16} aria-hidden="true" />
        Signaler
      </Button>
    )
  }

  return (
    <div
      role="group"
      aria-label="Signaler ce contenu"
      className="flex w-full flex-col gap-2"
      onKeyDown={(e) => {
        if (e.key === 'Escape') fermer()
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-ink">Pourquoi signaler ? (facultatif)</span>
        <textarea
          // Le champ vient d'être ouvert par l'élève : le focus y va (WCAG 2.4.3).
          autoFocus
          value={motif}
          maxLength={MOTIF_MAX}
          onChange={(e) => setMotif(e.target.value)}
          rows={2}
          className="rounded-md border-2 border-line bg-surface-raised px-3 py-2 font-prose text-sm text-ink focus:border-accent focus:outline-none"
        />
      </label>
      {erreur && (
        <p role="alert" className="font-prose text-sm text-danger">
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
        <Button size="sm" variant="ghost" className="min-h-11" onClick={fermer}>
          Annuler
        </Button>
      </div>
    </div>
  )
}
