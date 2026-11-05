import type { QuestionResume } from '@brio/api-client'

import { CarteLien } from '@/components/carte-lien'
import { Chip } from '@/components/ui/chip'
import { dateMessage, libelleAuteur, libelleMatiere } from '@/lib/communaute'

/** A question in the list. The counters come from the server, zero included. */
export function CarteQuestion({ question }: { question: QuestionResume }) {
  const reponses = question.nombreReponses
  const utiles = question.nombreUtile
  return (
    <CarteLien href={`/communaute/${question.id}`}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{libelleMatiere(question.matiere)}</Chip>
          {question.resolue && (
            <Chip variant="level" icon="check">
              Résolue
            </Chip>
          )}
        </div>
        <h2 className="break-words font-display text-lg font-extrabold tracking-tight text-ink">
          {question.titre}
        </h2>
        <p className="font-prose text-sm text-ink-muted">
          {libelleAuteur(question.auteur)} · {dateMessage(question.createdAt)}
          {question.modifie && ' · modifié'}
        </p>
        <p className="font-prose text-sm text-ink-muted">
          {reponses} {reponses > 1 ? 'réponses' : 'réponse'} · {utiles}{' '}
          {utiles > 1 ? 'votes « Utile »' : 'vote « Utile »'}
        </p>
      </div>
    </CarteLien>
  )
}
