'use client'

import {
  modifierQuestion,
  repondreQuestion,
  supprimerQuestion,
  type QuestionDetail,
} from '@brio/api-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { BoutonUtile } from '@/components/communaute/bouton-utile'
import { EditeurMessage, type MessageEcrit } from '@/components/communaute/editeur-message'
import { MessageCommunaute } from '@/components/communaute/message-communaute'
import { ReponseFil } from '@/components/communaute/reponse-fil'
import { useActualiserFil } from '@/components/communaute/use-actualiser-fil'
import { Chip } from '@/components/ui/chip'
import { apiBaseUrl } from '@/lib/api-base-url'
import { libelleMatiere } from '@/lib/communaute'

/** A thread: the question, its answers, and the composer for a new answer. */
export function FilQuestion({ question }: { question: QuestionDetail }) {
  const router = useRouter()
  const { actualiser } = useActualiserFil()
  // A new key gives an empty composer: its text lives in its own DOM.
  const [cleEditeur, setCleEditeur] = useState(0)

  async function modifier({ titre, corps }: MessageEcrit) {
    await modifierQuestion(apiBaseUrl(), question.id, { titre: titre ?? question.titre, corps })
    actualiser()
  }

  async function supprimer() {
    await supprimerQuestion(apiBaseUrl(), question.id)
    router.push('/communaute')
    router.refresh()
  }

  async function repondre({ corps }: MessageEcrit) {
    await repondreQuestion(apiBaseUrl(), question.id, corps)
    setCleEditeur((cle) => cle + 1)
    actualiser()
  }

  const nombre = question.reponses.length

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <article>
        <MessageCommunaute
          mode="question"
          auteur={question.auteur}
          createdAt={question.createdAt}
          modifie={question.modifie}
          corps={question.corps}
          estAuteur={question.estAuteur}
          titre={question.titre}
          enTete={
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Chip>{libelleMatiere(question.matiere)}</Chip>
                {question.resolue && (
                  <Chip variant="level" icon="check">
                    Résolue
                  </Chip>
                )}
              </div>
              <h1 className="break-words font-display text-3xl font-black tracking-tight text-ink">
                {question.titre}
              </h1>
            </>
          }
          avertissementSuppression={
            nombre > 0 ? 'Les réponses disparaîtront avec elle.' : undefined
          }
          onModifier={modifier}
          onSupprimer={supprimer}
          actions={
            <BoutonUtile
              cible="questions"
              id={question.id}
              nombre={question.nombreUtile}
              aVote={question.aVote}
              estAuteur={question.estAuteur}
            />
          }
        />
      </article>

      <section aria-labelledby="reponses-heading" className="flex flex-col gap-4">
        <h2 id="reponses-heading" className="font-display text-xl font-extrabold text-ink">
          {nombre === 0
            ? 'Pas encore de réponse'
            : `${nombre} ${nombre > 1 ? 'réponses' : 'réponse'}`}
        </h2>
        {nombre > 0 && (
          <ul className="flex flex-col gap-4">
            {question.reponses.map((reponse) => (
              <li key={reponse.id}>
                <ReponseFil
                  reponse={reponse}
                  questionId={question.id}
                  peutResoudre={question.estAuteur && !question.resolue}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="repondre-heading" className="flex flex-col gap-4">
        <h2 id="repondre-heading" className="font-display text-xl font-extrabold text-ink">
          Répondre
        </h2>
        <EditeurMessage key={cleEditeur} mode="reponse" onEnvoyer={repondre} />
      </section>
    </div>
  )
}
