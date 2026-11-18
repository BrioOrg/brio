'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  deciderModeration,
  fileContestationsCommunaute,
  fileSignalementsCommunaute,
  trancherContestationCommunaute,
  type ActionModeration,
  type ContestationModerationVue,
  type SignalementCommunauteVue,
} from '@brio/api-client'

import {
  annonceDecision,
  dateCourte,
  libelleAction,
  libelleStatut,
  messageErreur,
} from '@/components/admin/moderation-format'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { apiBaseUrl } from '@/lib/api-base-url'

/** Le serveur tronque au-delà (ModerationCommunauteService.MOTIF_MAX). */
const TEXTE_MAX = 1000

/**
 * Console de modération de la Communauté pour `admin_brio` (suivi #338, ADR 0044). Deux files :
 * les contenus signalés (décisions + révocation d'XP) et les contestations à trancher avec
 * intervention humaine. Les auteurs n'y apparaissent que par leur pseudonyme (#325). Après chaque
 * décision, le résultat est annoncé (role="status") et le focus revient sur le titre de la file.
 */
export function ConsoleModeration() {
  const [signalements, setSignalements] = useState<SignalementCommunauteVue[] | null>(null)
  const [contestations, setContestations] = useState<ContestationModerationVue[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [annonce, setAnnonce] = useState('')
  const titreSignalements = useRef<HTMLHeadingElement>(null)
  const titreContestations = useRef<HTMLHeadingElement>(null)

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

  async function apres(message: string, titre: HTMLHeadingElement | null) {
    setAnnonce(message)
    await charger()
    titre?.focus()
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 font-display text-2xl font-black tracking-tight text-ink">
          Modération de la Communauté
        </h1>
        <Button variant="ghost" size="sm" className="min-h-11" onClick={() => void charger()}>
          Actualiser
        </Button>
      </div>

      <p role="status" className="sr-only">
        {annonce}
      </p>

      {erreur && (
        <p
          role="alert"
          className="break-words rounded-lg border border-danger bg-surface-panel px-4 py-2 text-sm text-danger"
        >
          {erreur}
        </p>
      )}

      <section aria-labelledby="signalements-heading" className="flex flex-col gap-4">
        <h2
          id="signalements-heading"
          ref={titreSignalements}
          tabIndex={-1}
          className="rounded-sm font-display text-xl font-extrabold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Contenus signalés
        </h2>
        {!signalements && !erreur && (
          <p role="status" className="text-ink-muted">
            Chargement…
          </p>
        )}
        {signalements?.length === 0 && (
          <p className="rounded-lg border border-line bg-surface-panel p-4 text-ink-muted">
            Aucun contenu signalé en attente.
          </p>
        )}
        {signalements && signalements.length > 0 && (
          <ul className="flex flex-col gap-3">
            {signalements.map((s) => (
              <li key={`${s.cibleType}-${s.cibleId}`}>
                <CarteSignalement
                  signalement={s}
                  onFait={(action) => apres(annonceDecision(action), titreSignalements.current)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="contestations-heading" className="flex flex-col gap-4">
        <h2
          id="contestations-heading"
          ref={titreContestations}
          tabIndex={-1}
          className="rounded-sm font-display text-xl font-extrabold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Contestations
        </h2>
        {!contestations && !erreur && (
          <p role="status" className="text-ink-muted">
            Chargement…
          </p>
        )}
        {contestations?.length === 0 && (
          <p className="rounded-lg border border-line bg-surface-panel p-4 text-ink-muted">
            Aucune contestation en attente.
          </p>
        )}
        {contestations && contestations.length > 0 && (
          <ul className="flex flex-col gap-3">
            {contestations.map((c) => (
              <li key={c.id}>
                <CarteContestation
                  contestation={c}
                  onFait={(accepte) =>
                    apres(
                      accepte ? 'Contestation acceptée.' : 'Contestation rejetée.',
                      titreContestations.current
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

const LIBELLE_CIBLE: Record<string, string> = { question: 'Question', reponse: 'Réponse' }

/** Les actions sans retour arrière demandent une confirmation sur place. */
const A_CONFIRMER: Partial<Record<ActionModeration, string>> = {
  supprimer: 'Supprimer définitivement ce contenu ? Son texte sera effacé.',
  revoquer_xp: 'Retirer l’XP « réponse utile » à son auteur ?',
}

const LIBELLE_CONFIRMATION: Partial<Record<ActionModeration, string>> = {
  supprimer: 'Oui, supprimer',
  revoquer_xp: 'Oui, révoquer l’XP',
}

type CarteSignalementProps = {
  signalement: SignalementCommunauteVue
  onFait: (action: ActionModeration) => Promise<void>
}

function CarteSignalement({ signalement: s, onFait }: CarteSignalementProps) {
  const [motif, setMotif] = useState('')
  const [occupe, setOccupe] = useState<ActionModeration | null>(null)
  const [aConfirmer, setAConfirmer] = useState<ActionModeration | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  async function decider(action: ActionModeration) {
    if (A_CONFIRMER[action] && aConfirmer !== action) {
      setAConfirmer(action)
      return
    }
    setAConfirmer(null)
    setOccupe(action)
    setErreur(null)
    try {
      await deciderModeration(apiBaseUrl(), s.cibleType, s.cibleId, action, motif)
      await onFait(action)
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible d’appliquer la décision.'))
      setOccupe(null)
    }
  }

  const masque = s.statutContenu === 'masque'
  const editeDepuis =
    s.extraitAuSignalement != null && s.extraitAuSignalement.trim() !== s.extrait.trim()
  const bouton = (action: ActionModeration) => ({
    onClick: () => void decider(action),
    loading: occupe === action,
    disabled: occupe !== null && occupe !== action,
    className: 'min-h-11',
  })

  return (
    <article
      aria-label={`${LIBELLE_CIBLE[s.cibleType]} signalée de ${s.auteurPseudonyme}`}
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface-panel p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip>{LIBELLE_CIBLE[s.cibleType]}</Chip>
        <Chip>{libelleStatut(s.statutContenu)}</Chip>
        {s.estReponseResolue && (
          <Chip variant="level" icon="trophy">
            Réponse retenue (XP « réponse utile »)
          </Chip>
        )}
        {s.xpDejaRevoquee && <Chip>XP révoquée</Chip>}
        <span className="text-xs text-ink-muted">
          {s.nombreSignalements} signalement{s.nombreSignalements > 1 ? 's' : ''} · depuis le{' '}
          {dateCourte(s.premierSignalementAt)}
        </span>
      </div>

      <p className="break-words text-xs text-ink-muted">Auteur : {s.auteurPseudonyme}</p>

      {editeDepuis && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-ink-muted">
            Au moment du signalement (modifié depuis par son auteur) :
          </p>
          <blockquote className="whitespace-pre-line break-words rounded-md border-l-4 border-danger bg-surface-raised px-3 py-2 text-sm text-ink">
            {s.extraitAuSignalement || '(vide)'}
          </blockquote>
          <p className="text-xs font-semibold text-ink-muted">Aujourd’hui :</p>
        </div>
      )}
      <blockquote className="whitespace-pre-line break-words rounded-md border-l-4 border-warning bg-surface-raised px-3 py-2 text-sm text-ink">
        {s.extrait || '(contenu vide ou supprimé)'}
      </blockquote>

      {s.motifs.length > 0 && (
        <div className="text-sm text-ink-muted">
          Motifs :
          <ul className="list-disc pl-5">
            {s.motifs.map((m, i) => (
              <li key={i} className="break-words text-ink">
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
          maxLength={TEXTE_MAX}
          onChange={(e) => setMotif(e.target.value)}
          rows={2}
          className="rounded-md border-2 border-line bg-surface-raised px-3 py-2 font-prose text-sm text-ink focus:border-accent focus:outline-none"
        />
      </label>

      {erreur && (
        <p role="alert" className="break-words text-sm text-danger">
          {erreur}
        </p>
      )}

      {aConfirmer ? (
        <div
          role="group"
          aria-label="Confirmer la décision"
          className="flex flex-col gap-2 rounded-md border-2 border-danger p-3"
        >
          <p className="text-sm font-semibold text-ink">{A_CONFIRMER[aConfirmer]}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" size="sm" {...bouton(aConfirmer)}>
              {LIBELLE_CONFIRMATION[aConfirmer]}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => setAConfirmer(null)}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {masque ? (
            <Button variant="secondary" size="sm" {...bouton('restaurer')}>
              <Icon name="arrow-counter-clockwise" size={16} aria-hidden="true" />
              Restaurer
            </Button>
          ) : (
            <Button variant="secondary" size="sm" {...bouton('masquer')}>
              <Icon name="eye-slash" size={16} aria-hidden="true" />
              Masquer
            </Button>
          )}
          <Button variant="destructive" size="sm" {...bouton('supprimer')}>
            <Icon name="trash" size={16} aria-hidden="true" />
            Supprimer
          </Button>
          <Button variant="ghost" size="sm" {...bouton('rejeter')}>
            <Icon name="check" size={16} aria-hidden="true" />
            Rejeter le signalement
          </Button>
          {s.cibleType === 'reponse' && s.estReponseResolue && !s.xpDejaRevoquee && (
            <Button variant="destructive" size="sm" {...bouton('revoquer_xp')}>
              <Icon name="trophy" size={16} aria-hidden="true" />
              Révoquer l’XP
            </Button>
          )}
        </div>
      )}
    </article>
  )
}

type CarteContestationProps = {
  contestation: ContestationModerationVue
  onFait: (accepte: boolean) => Promise<void>
}

function CarteContestation({ contestation: c, onFait }: CarteContestationProps) {
  const [reponse, setReponse] = useState('')
  const [occupe, setOccupe] = useState<'accepter' | 'rejeter' | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  async function trancher(accepter: boolean) {
    setOccupe(accepter ? 'accepter' : 'rejeter')
    setErreur(null)
    try {
      await trancherContestationCommunaute(apiBaseUrl(), c.id, accepter, reponse)
      await onFait(accepter)
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de traiter cette contestation.'))
      setOccupe(null)
    }
  }

  // Un contenu supprimé n'est pas republié (son texte est effacé) : accepter n'y change rien.
  const restaurable = c.statutContenu === 'masque'

  return (
    <article
      aria-label={`Contestation de ${c.auteurPseudonyme}`}
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface-panel p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip>{LIBELLE_CIBLE[c.cibleType]}</Chip>
        {c.decisionAction && <Chip>Décision : {libelleAction(c.decisionAction)}</Chip>}
        <Chip>{libelleStatut(c.statutContenu)}</Chip>
        <span className="text-xs text-ink-muted">le {dateCourte(c.createdAt)}</span>
      </div>

      <p className="break-words text-xs text-ink-muted">Auteur : {c.auteurPseudonyme}</p>

      {c.extrait && (
        <blockquote className="whitespace-pre-line break-words rounded-md border-l-4 border-line bg-surface-raised px-3 py-2 text-sm text-ink">
          {c.extrait}
        </blockquote>
      )}

      <div className="break-words rounded-md border-l-4 border-accent bg-surface-raised px-3 py-2 text-sm text-ink">
        <span className="font-semibold">Contestation :</span> {c.message}
      </div>

      {c.decisionMotif && (
        <p className="break-words text-sm text-ink-muted">
          Motif de la décision : {c.decisionMotif}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-ink">Réponse au membre (facultatif)</span>
        <textarea
          value={reponse}
          maxLength={TEXTE_MAX}
          onChange={(e) => setReponse(e.target.value)}
          rows={2}
          className="rounded-md border-2 border-line bg-surface-raised px-3 py-2 font-prose text-sm text-ink focus:border-accent focus:outline-none"
        />
      </label>

      {erreur && (
        <p role="alert" className="break-words text-sm text-danger">
          {erreur}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11"
          onClick={() => void trancher(true)}
          loading={occupe === 'accepter'}
          disabled={occupe === 'rejeter'}
        >
          <Icon name="arrow-counter-clockwise" size={16} aria-hidden="true" />
          {restaurable ? 'Accepter et restaurer' : 'Accepter la contestation'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={() => void trancher(false)}
          loading={occupe === 'rejeter'}
          disabled={occupe === 'accepter'}
        >
          <Icon name="x" size={16} aria-hidden="true" />
          Rejeter la contestation
        </Button>
      </div>
    </article>
  )
}
