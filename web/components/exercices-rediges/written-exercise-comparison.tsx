'use client'

import { useId, useState } from 'react'

import { RichTextRenderer } from '@/components/blocs/rich-text'
import { ApercuKatex } from '@/components/maths/apercu-katex'
import { Panel } from '@/components/ui/panel'
import {
  studentWrittenPhotoHref,
  type WrittenExercise,
  type WrittenCriterionFeedback,
} from '@/lib/exercices-rediges'

const heading = 'font-display text-lg font-extrabold text-ink'
const body = 'whitespace-pre-wrap break-words font-prose text-base leading-relaxed text-ink'

export function WrittenExerciseComparison({ exercise }: { exercise: WrittenExercise }) {
  const answerId = useId()
  const solutionId = useId()
  const { soumission, corrige } = exercise
  const reviewed = exercise.modeCorrection === 'enseignant'

  const textAnswer = reviewed || exercise.modeCorrection === 'ia'

  if (!soumission && !exercise.cloture) return null

  return (
    <div className="space-y-4">
      {!soumission && (
        <p role="status" className="font-prose text-sm text-ink-muted">
          Tu n’as pas remis de réponse.
        </p>
      )}

      <div
        role={soumission && corrige ? 'region' : undefined}
        aria-label={soumission && corrige ? 'Ta réponse et le corrigé' : undefined}
        className={
          soumission && corrige ? 'grid grid-cols-1 items-start gap-4 lg:grid-cols-2' : undefined
        }
      >
        {soumission && (
          <section aria-labelledby={answerId} className="min-w-0">
            <Panel className="space-y-3">
              <h2 id={answerId} className={heading}>
                Ta réponse
              </h2>
              {textAnswer ? (
                <>
                  {soumission.reponse && <p className={body}>{soumission.reponse}</p>}
                  {soumission.photo && <SubmissionPhoto key={exercise.id} id={exercise.id} />}
                </>
              ) : (
                <>
                  {typeof soumission.correct === 'boolean' && (
                    <p role="status" className="font-prose text-sm font-semibold text-ink">
                      {soumission.correct ? 'Réponse correcte' : 'Réponse incorrecte'}
                    </p>
                  )}
                  <ApercuKatex latex={soumission.reponse} />
                  <p className="break-words font-mono text-sm text-ink-muted">
                    {soumission.reponse}
                  </p>
                </>
              )}
            </Panel>
          </section>
        )}

        {corrige && (
          <section aria-labelledby={solutionId} className="min-w-0">
            <Panel className="space-y-3">
              <h2 id={solutionId} className={heading}>
                Corrigé
              </h2>
              {!reviewed && soumission?.correct === false && (
                <p className="font-prose text-sm font-semibold text-ink">
                  Ton résultat diffère du résultat attendu.
                </p>
              )}
              {reviewed && (
                <h3 className="font-display text-base font-extrabold text-ink">
                  Grille de correction
                </h3>
              )}
              <p className={`${body} overflow-x-auto`}>
                <RichTextRenderer text={corrige} />
              </p>
              {soumission?.retourIa && <CriterionFeedback feedback={soumission.retourIa} />}
              {reviewed && exercise.copieModele && (
                <>
                  <h3 className="font-display text-base font-extrabold text-ink">Copie modèle</h3>
                  <p className={`${body} overflow-x-auto`}>
                    <RichTextRenderer text={exercise.copieModele} />
                  </p>
                </>
              )}
              {reviewed && soumission && (
                <>
                  <h3 className="font-display text-base font-extrabold text-ink">
                    Retour de l’enseignant
                  </h3>
                  {soumission.retour ? (
                    <p className={body}>{soumission.retour.commentaire}</p>
                  ) : (
                    <p role="status" className="font-prose text-sm text-ink-muted">
                      En attente du retour de ton enseignant.
                    </p>
                  )}
                </>
              )}
            </Panel>
          </section>
        )}
      </div>
    </div>
  )
}

const criterionLabels = {
  present: 'Repéré',
  manquant: 'Manquant',
  incertain: 'À vérifier',
} as const

function CriterionFeedback({ feedback }: { feedback: WrittenCriterionFeedback }) {
  return (
    <div className="space-y-2">
      <h3 className="font-display text-base font-extrabold text-ink">Retour par critères</h3>
      {feedback.etat === 'disponible' ? (
        <>
          <p className="font-prose text-sm text-ink-muted">
            Nombre minimum de critères attendus : {feedback.minimum}.
          </p>
          <ul className="space-y-2">
            {feedback.criteres.map((criterion, index) => (
              <li key={index} className="rounded-md border border-line p-2">
                <p className="break-words font-prose text-sm font-semibold text-ink">
                  {criterion.attendu} · {criterionLabels[criterion.etat]}
                </p>
                {criterion.extrait && <blockquote className={body}>{criterion.extrait}</blockquote>}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p role="status" className="font-prose text-sm text-ink-muted">
          {feedback.etat === 'en_attente'
            ? 'Le retour par critères est en cours.'
            : 'Le retour par critères est indisponible. Ta réponse est bien remise.'}
        </p>
      )}
    </div>
  )
}

function SubmissionPhoto({ id }: { id: string }) {
  const [failed, setFailed] = useState(false)
  const href = studentWrittenPhotoHref(id)
  return (
    <div className="space-y-2">
      {failed ? (
        <p role="status" className="font-prose text-sm text-ink-muted">
          Impossible d’afficher la photo ici.
        </p>
      ) : (
        // This session-protected image must load directly in the student's browser.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={href}
          alt="Photo de ta copie"
          className="block h-auto max-w-full rounded-md border border-line"
          onError={() => setFailed(true)}
        />
      )}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center font-prose text-sm font-semibold text-accent-ink underline"
      >
        Ouvrir la photo de ta copie
      </a>
    </div>
  )
}
