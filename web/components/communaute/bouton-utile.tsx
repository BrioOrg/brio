'use client'

import { voterUtile } from '@brio/api-client'
import { useState } from 'react'

import { useActualiserFil } from '@/components/communaute/use-actualiser-fil'
import { Button } from '@/components/ui/button'
import { apiBaseUrl } from '@/lib/api-base-url'
import { messageErreur } from '@/lib/communaute'

type Props = {
  cible: 'questions' | 'reponses'
  id: string
  nombre: number
  aVote: boolean
  /** One's own message: the count shows, but one does not vote for oneself (ADR 0035 §5). */
  estAuteur: boolean
}

/** The single, positive vote. The count only changes once the server has it. */
export function BoutonUtile({ cible, id, nombre, aVote, estAuteur }: Props) {
  const { actualiser, enCours } = useActualiserFil()
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string>()

  if (estAuteur) {
    return (
      <span className="font-prose text-sm text-ink-muted">
        {nombre} {nombre > 1 ? 'votes « Utile »' : 'vote « Utile »'}
      </span>
    )
  }

  async function basculer() {
    setEnvoi(true)
    setErreur(undefined)
    try {
      await voterUtile(apiBaseUrl(), cible, id, !aVote)
      actualiser()
    } catch (e) {
      setErreur(messageErreur(e, 'Ton vote n’a pas pu être enregistré.'))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant={aVote ? 'primary' : 'secondary'}
        aria-pressed={aVote}
        loading={envoi || enCours}
        onClick={basculer}
        className="min-h-11"
      >
        Utile · {nombre}
      </Button>
      {erreur && (
        <p role="alert" className="w-full font-prose text-sm text-feedback-incorrect">
          {erreur}
        </p>
      )}
    </>
  )
}
