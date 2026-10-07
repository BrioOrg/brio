'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  consulterFil,
  marquerUtile,
  repondre,
  signaler,
  type FilDetail,
  type MessageVue,
} from '@brio/api-client'
import { apiBaseUrl } from '@/lib/api-base-url'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { dateCourte, messageErreur } from '@/components/entraide/entraide-format'

const LONGUEUR_MAX = 2000

type FilEntraideProps = {
  filId: string
  onRetour: () => void
}

/**
 * One entraide thread: the question, the answers the server lets this reader see, and the
 * reply form. On an exercise thread the reader has not submitted, the server leaves the other
 * answers out (`verrouille`); the UI only says so (ADR 0023).
 */
export function FilEntraide({ filId, onRetour }: FilEntraideProps) {
  const [fil, setFil] = useState<FilDetail | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [reponse, setReponse] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      setFil(await consulterFil(apiBaseUrl(), filId))
      setErreur(null)
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de charger cette question.'))
    }
  }, [filId])

  useEffect(() => {
    void charger()
  }, [charger])

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    if (reponse.trim() === '' || envoi) return
    setEnvoi(true)
    setErreurEnvoi(null)
    try {
      await repondre(apiBaseUrl(), filId, reponse)
      setReponse('')
      await charger()
    } catch (err) {
      setErreurEnvoi(messageErreur(err, "Impossible d'envoyer ta réponse."))
    } finally {
      setEnvoi(false)
    }
  }

  const [question, ...reponses] = fil?.messages ?? []

  return (
    <section aria-label="Question de la classe" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onRetour} className="-ml-3">
          <Icon name="arrow-left" size={16} aria-hidden="true" />
          Toutes les questions
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void charger()}>
          Actualiser
        </Button>
      </div>

      {erreur && (
        <p role="alert" className="font-prose text-sm text-danger">
          {erreur}
        </p>
      )}

      {!fil && !erreur && <Skeleton className="h-24 w-full" />}

      {fil && (
        <>
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-base font-extrabold text-ink">{fil.titre}</h3>
            <p className="font-prose text-xs text-ink-muted">
              {fil.estAuteur ? 'Ta question' : `Question de ${fil.auteurNom}`} ·{' '}
              {dateCourte(fil.createdAt)}
            </p>
          </div>

          {question && (
            <p className="font-prose text-sm leading-relaxed text-ink">{question.corps}</p>
          )}

          {fil.verrouille && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-md border border-line bg-surface-raised p-3 font-prose text-sm text-ink"
            >
              <Icon name="lock-simple" size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {fil.reponsesMasquees > 0
                  ? `${fil.reponsesMasquees} réponse${fil.reponsesMasquees > 1 ? 's' : ''} masquée${fil.reponsesMasquees > 1 ? 's' : ''}. `
                  : ''}
                Réponds d’abord à l’exercice : tu verras ensuite ce que la classe a écrit.
              </span>
            </p>
          )}

          <ol aria-label="Réponses" className="flex flex-col gap-2">
            {reponses.map((m) => (
              <li key={m.id}>
                <MessageEntraide
                  message={m}
                  filId={fil.id}
                  peutRetenir={fil.estAuteur && !m.estMoi && !m.utile}
                  onChange={charger}
                />
              </li>
            ))}
          </ol>

          {!fil.verrouille && reponses.length === 0 && (
            <p className="font-prose text-sm text-ink-muted">Personne n’a encore répondu.</p>
          )}

          <form onSubmit={envoyer} className="flex flex-col gap-2">
            <label htmlFor={`reponse-${fil.id}`} className="sr-only">
              Ta réponse
            </label>
            <textarea
              id={`reponse-${fil.id}`}
              value={reponse}
              onChange={(e) => setReponse(e.target.value)}
              maxLength={LONGUEUR_MAX}
              rows={3}
              placeholder="Explique ton raisonnement, sans donner la réponse toute faite…"
              disabled={envoi}
              className="w-full resize-none rounded-md border border-line bg-surface-page px-3 py-2 font-prose text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            />
            {erreurEnvoi && (
              <p role="alert" className="font-prose text-sm text-danger">
                {erreurEnvoi}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={envoi} disabled={reponse.trim() === ''}>
                Répondre
              </Button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}

type MessageEntraideProps = {
  message: MessageVue
  filId: string
  peutRetenir: boolean
  onChange: () => Promise<void>
}

function MessageEntraide({ message, filId, peutRetenir, onChange }: MessageEntraideProps) {
  const [signalement, setSignalement] = useState<'ferme' | 'ouvert' | 'envoye'>('ferme')
  const [motif, setMotif] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function retenir() {
    setOccupe(true)
    setErreur(null)
    try {
      await marquerUtile(apiBaseUrl(), filId, message.id)
      await onChange()
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de retenir cette réponse.'))
    } finally {
      setOccupe(false)
    }
  }

  async function envoyerSignalement(e: React.FormEvent) {
    e.preventDefault()
    setOccupe(true)
    setErreur(null)
    try {
      await signaler(apiBaseUrl(), message.id, motif)
      setSignalement('envoye')
    } catch (err) {
      setErreur(messageErreur(err, 'Impossible de signaler ce message.'))
    } finally {
      setOccupe(false)
    }
  }

  const masque = message.statut !== 'publie'

  return (
    <article
      aria-label={`Réponse de ${message.estMoi ? 'toi' : message.auteurNom}`}
      className={[
        'rounded-lg border p-3',
        message.utile ? 'border-success/40 bg-success/10' : 'border-line bg-surface-raised',
      ].join(' ')}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="font-display text-xs font-extrabold text-ink">
          {message.estMoi ? 'Toi' : message.auteurNom}
        </span>
        <span className="font-prose text-xs text-ink-muted">{dateCourte(message.createdAt)}</span>
        {message.utile && (
          <Chip variant="status" icon="star" className="text-success">
            Réponse utile
          </Chip>
        )}
        {masque && (
          <Chip variant="status" icon="eye-slash">
            Masqué
          </Chip>
        )}
      </div>

      <p className="whitespace-pre-line font-prose text-sm leading-relaxed text-ink">
        {message.corps}
      </p>

      {erreur && (
        <p role="alert" className="mt-2 font-prose text-sm text-danger">
          {erreur}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {peutRetenir && (
          <Button variant="ghost" size="sm" onClick={() => void retenir()} disabled={occupe}>
            <Icon name="star" size={16} aria-hidden="true" />
            Ça m’a aidé
          </Button>
        )}
        {!message.estMoi && !masque && signalement === 'ferme' && (
          <Button variant="ghost" size="sm" onClick={() => setSignalement('ouvert')}>
            <Icon name="warning-circle" size={16} aria-hidden="true" />
            Signaler
          </Button>
        )}
        {signalement === 'envoye' && (
          <p role="status" className="font-prose text-xs text-ink-muted">
            Merci, ton professeur va regarder ce message.
          </p>
        )}
      </div>

      {signalement === 'ouvert' && (
        <form onSubmit={envoyerSignalement} className="mt-2 flex flex-col gap-2">
          <label htmlFor={`motif-${message.id}`} className="font-prose text-xs text-ink-muted">
            Pourquoi ce message pose problème ? (facultatif)
          </label>
          <input
            id={`motif-${message.id}`}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            maxLength={200}
            className="rounded-md border border-line bg-surface-page px-3 py-2 font-prose text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setSignalement('ferme')}>
              Annuler
            </Button>
            <Button variant="destructive" size="sm" type="submit" loading={occupe}>
              Signaler au professeur
            </Button>
          </div>
        </form>
      )}
    </article>
  )
}

