'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  deciderModeration,
  fileContestationsCommunaute,
  fileSignalementsCommunaute,
  trancherContestationCommunaute,
  type ActionModeration,
  type ContestationModerationVue,
  type SignalementCommunauteVue,
} from '@brio/api-client'

import { dateCourte, libelleStatut, messageErreur } from '@/components/admin/moderation-format'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { apiBaseUrl } from '@/lib/api-base-url'

/**
 * Console de modération de la Communauté pour `admin_brio` (suivi #338, ADR 0035). Deux files :
 * les contenus signalés (décisions + révocation d'XP) et les contestations à trancher avec
 * intervention humaine. Les auteurs n'y apparaissent que par leur pseudonyme (#325).
 */
export function ConsoleModeration() {
  const [signalements, setSignalements] = useState<SignalementCommunauteVue[] | null>(null)
  const [contestations, setContestations] = useState<ContestationModerationVue[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        fileSignalementsCommunaute(apiBaseUrl()),
        fileContestationsCommunaute(apiBaseUrl()),
      ])
      setSignalements(s)
      setContestations(c)
      setErreur(null)
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de charger la modération.'))
    }
  }, [])

  useEffect(() => {
    void charger()
  }, [charger])

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 font-display text-2xl font-black tracking-tight text-ink">
          Modération de la Communauté
        </h1>
        <Button variant="ghost" size="sm" onClick={() => void charger()}>
          Actualiser
        </Button>
      </div>

      {erreur && (
        <p
          role="alert"
          className="rounded-lg border border-danger bg-surface-panel px-4 py-2 text-sm text-danger"
        >
          {erreur}
        </p>
      )}

      <section aria-labelledby="signalements-heading" className="flex flex-col gap-4">
        <h2 id="signalements-heading" className="font-display text-xl font-extrabold text-ink">
          Contenus signalés
        </h2>
        {!signalements && !erreur && <p className="text-ink-muted">Chargement…</p>}
        {signalements?.length === 0 && (
          <p className="rounded-lg border border-line bg-surface-panel p-4 text-ink-muted">
            Aucun contenu signalé en attente.
          </p>
        )}
        {signalements && signalements.length > 0 && (
          <ul className="flex flex-col gap-3">
            {signalements.map((s) => (
              <li key={`${s.cibleType}-${s.cibleId}`}>
                <CarteSignalement signalement={s} onFait={charger} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="contestations-heading" className="flex flex-col gap-4">
        <h2 id="contestations-heading" className="font-display text-xl font-extrabold text-ink">
          Contestations
        </h2>
        {!contestations && !erreur && <p className="text-ink-muted">Chargement…</p>}
        {contestations?.length === 0 && (
          <p className="rounded-lg border border-line bg-surface-panel p-4 text-ink-muted">
            Aucune contestation en attente.
          </p>
        )}
        {contestations && contestations.length > 0 && (
          <ul className="flex flex-col gap-3">
            {contestations.map((c) => (
              <li key={c.id}>
                <CarteContestation contestation={c} onFait={charger} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

const LIBELLE_CIBLE: Record<string, string> = { question: 'Question', reponse: 'Réponse' }

type CarteSignalementProps = {
  signalement: SignalementCommunauteVue
  onFait: () => Promise<void>
}

function CarteSignalement({ signalement: s, onFait }: CarteSignalementProps) {
  const [motif, setMotif] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function decider(action: ActionModeration) {
    setOccupe(true)
    setErreur(null)
    try {
      await deciderModeration(apiBaseUrl(), s.cibleType, s.cibleId, action, motif)
      await onFait()
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible d’appliquer la décision.'))
      setOccupe(false)
    }
  }

  const masque = s.statutContenu === 'masque'

  return (
    <article
      aria-label={`${LIBELLE_CIBLE[s.cibleType]} signalée de ${s.auteurPseudonyme}`}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface-panel p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip>{LIBELLE_CIBLE[s.cibleType]}</Chip>
        <Chip>{libelleStatut(s.statutContenu)}</Chip>
        {s.estReponseResolue && (
          <Chip variant="level" icon="trophy">
            Réponse utile (15 XP)
          </Chip>
        )}
        <span className="text-xs text-ink-muted">
          {s.nombreSignalements} signalement{s.nombreSignalements > 1 ? 's' : ''} · depuis le{' '}
          {dateCourte(s.premierSignalementAt)}
        </span>
      </div>

      <p className="text-xs text-ink-muted">Auteur : {s.auteurPseudonyme}</p>

      <blockquote className="whitespace-pre-line rounded-md border-l-4 border-warning bg-surface-raised px-3 py-2 text-sm text-ink">
        {s.extrait || '(contenu vide ou supprimé)'}
      </blockquote>

      {s.motifs.length > 0 && (
        <div className="text-sm text-ink-muted">
          Motifs :
          <ul className="list-disc pl-5">
            {s.motifs.map((m, i) => (
              <li key={i} className="text-ink">
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-ink">Motif de la décision (facultatif)</span>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={2}
          className="rounded-md border-2 border-line bg-surface-raised px-3 py-2 font-prose text-sm text-ink focus:border-accent focus:outline-none"
        />
      </label>

      {erreur && (
        <p role="alert" className="text-sm text-danger">
          {erreur}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {masque ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void decider('restaurer')}
            loading={occupe}
          >
            <Icon name="arrow-counter-clockwise" size={16} aria-hidden="true" />
            Restaurer
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void decider('masquer')}
            loading={occupe}
          >
            <Icon name="eye-slash" size={16} aria-hidden="true" />
            Masquer
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => void decider('supprimer')}
          loading={occupe}
        >
          <Icon name="trash" size={16} aria-hidden="true" />
          Supprimer
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void decider('rejeter')} loading={occupe}>
          <Icon name="check" size={16} aria-hidden="true" />
          Rejeter le signalement
        </Button>
        {s.cibleType === 'reponse' && s.estReponseResolue && !s.xpDejaRevoquee && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void decider('revoquer_xp')}
            loading={occupe}
          >
            <Icon name="trophy" size={16} aria-hidden="true" />
            Révoquer l’XP
          </Button>
        )}
      </div>
    </article>
  )
}

type CarteContestationProps = {
  contestation: ContestationModerationVue
  onFait: () => Promise<void>
}

function CarteContestation({ contestation: c, onFait }: CarteContestationProps) {
  const [reponse, setReponse] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function trancher(accepter: boolean) {
    setOccupe(true)
    setErreur(null)
    try {
      await trancherContestationCommunaute(apiBaseUrl(), c.id, accepter, reponse)
      await onFait()
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de traiter cette contestation.'))
      setOccupe(false)
    }
  }

  return (
    <article
      aria-label={`Contestation de ${c.auteurPseudonyme}`}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface-panel p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip>{LIBELLE_CIBLE[c.cibleType]}</Chip>
        {c.decisionAction && <Chip>Décision : {c.decisionAction}</Chip>}
        <Chip>{libelleStatut(c.statutContenu)}</Chip>
        <span className="text-xs text-ink-muted">le {dateCourte(c.createdAt)}</span>
      </div>

      <p className="text-xs text-ink-muted">Auteur : {c.auteurPseudonyme}</p>

      {c.extrait && (
        <blockquote className="whitespace-pre-line rounded-md border-l-4 border-line bg-surface-raised px-3 py-2 text-sm text-ink">
          {c.extrait}
        </blockquote>
      )}

      <div className="rounded-md border-l-4 border-accent bg-surface-raised px-3 py-2 text-sm text-ink">
        <span className="font-semibold">Contestation :</span> {c.message}
      </div>

      {c.decisionMotif && (
        <p className="text-sm text-ink-muted">Motif de la décision : {c.decisionMotif}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-ink">Réponse au membre (facultatif)</span>
        <textarea
          value={reponse}
          onChange={(e) => setReponse(e.target.value)}
          rows={2}
          className="rounded-md border-2 border-line bg-surface-raised px-3 py-2 font-prose text-sm text-ink focus:border-accent focus:outline-none"
        />
      </label>

      {erreur && (
        <p role="alert" className="text-sm text-danger">
          {erreur}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => void trancher(true)} loading={occupe}>
          <Icon name="arrow-counter-clockwise" size={16} aria-hidden="true" />
          Accepter (restaurer)
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void trancher(false)} loading={occupe}>
          <Icon name="x" size={16} aria-hidden="true" />
          Rejeter
        </Button>
      </div>
    </article>
  )
}
