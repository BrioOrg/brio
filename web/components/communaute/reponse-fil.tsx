'use client'

import {
  commenterReponse,
  modifierReponse,
  resoudreQuestion,
  supprimerReponse,
  type ReponseCommunaute,
} from '@brio/api-client'
import { useState } from 'react'

import { BoutonUtile } from '@/components/communaute/bouton-utile'
import { EditeurMessage, type MessageEcrit } from '@/components/communaute/editeur-message'
import { MessageCommunaute } from '@/components/communaute/message-communaute'
import { useActualiserFil } from '@/components/communaute/use-actualiser-fil'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Panel } from '@/components/ui/panel'
import { apiBaseUrl } from '@/lib/api-base-url'
import { messageErreur } from '@/lib/communaute'

type Props = {
  reponse: ReponseCommunaute
  questionId: string
  /** The reader wrote the question and it is still open: they may keep an answer. */
  peutResoudre: boolean
}

/** An answer and the single level of comments under it (ADR 0035 §4). */
export function ReponseFil({ reponse, questionId, peutResoudre }: Props) {
  const { actualiser, enCours } = useActualiserFil()
  const [ecrit, setEcrit] = useState(false)
  const [resolution, setResolution] = useState(false)
  const [erreur, setErreur] = useState<string>()

  async function modifier(id: string, { corps }: MessageEcrit) {
    await modifierReponse(apiBaseUrl(), id, corps)
    actualiser()
  }

  async function supprimer(id: string) {
    await supprimerReponse(apiBaseUrl(), id)
    actualiser()
  }

  async function commenter({ corps }: MessageEcrit) {
    await commenterReponse(apiBaseUrl(), reponse.id, corps)
    setEcrit(false)
    actualiser()
  }

  async function resoudre() {
    setResolution(true)
    setErreur(undefined)
    try {
      await resoudreQuestion(apiBaseUrl(), questionId, reponse.id)
      actualiser()
    } catch (e) {
      setErreur(messageErreur(e, 'La question n’a pas pu être marquée comme résolue.'))
    } finally {
      setResolution(false)
    }
  }

  return (
    <Panel className="flex flex-col gap-4">
      <MessageCommunaute
        mode="reponse"
        auteur={reponse.auteur}
        createdAt={reponse.createdAt}
        modifie={reponse.modifie}
        corps={reponse.corps}
        estAuteur={reponse.estAuteur}
        enTete={
          reponse.aResolu && (
            <div>
              <Chip variant="level" icon="check">
                A résolu la question
              </Chip>
            </div>
          )
        }
        avertissementSuppression={
          reponse.aResolu ? 'La question redeviendra non résolue.' : undefined
        }
        onModifier={(message) => modifier(reponse.id, message)}
        onSupprimer={() => supprimer(reponse.id)}
        actions={
          <>
            <BoutonUtile
              cible="reponses"
              id={reponse.id}
              nombre={reponse.nombreUtile}
              aVote={reponse.aVote}
              estAuteur={reponse.estAuteur}
            />
            {peutResoudre && !reponse.estAuteur && (
              <Button
                size="sm"
                className="min-h-11"
                loading={resolution || enCours}
                onClick={resoudre}
              >
                Marquer comme résolue
              </Button>
            )}
            {!ecrit && (
              <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setEcrit(true)}>
                Commenter
              </Button>
            )}
          </>
        }
      />

      {erreur && (
        <p role="alert" className="font-prose text-sm text-feedback-incorrect">
          {erreur}
        </p>
      )}

      {ecrit && (
        <EditeurMessage
          mode="commentaire"
          onEnvoyer={commenter}
          onAnnuler={() => setEcrit(false)}
        />
      )}

      {reponse.commentaires.length > 0 && (
        <ul aria-label="Commentaires" className="flex flex-col gap-4 border-l-2 border-line pl-4">
          {reponse.commentaires.map((commentaire) => (
            <li key={commentaire.id}>
              <MessageCommunaute
                mode="commentaire"
                auteur={commentaire.auteur}
                createdAt={commentaire.createdAt}
                modifie={commentaire.modifie}
                corps={commentaire.corps}
                estAuteur={commentaire.estAuteur}
                onModifier={(message) => modifier(commentaire.id, message)}
                onSupprimer={() => supprimer(commentaire.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
