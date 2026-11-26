'use client'

import { useId, useRef, useState } from 'react'

import { RichTextRenderer } from '@/components/blocs/rich-text'
import { ApercuKatex } from '@/components/maths/apercu-katex'
import { ChampFormule } from '@/components/maths/champ-formule'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import {
  formatExerciseDeadline,
  getWrittenExercise,
  submitWrittenExercise,
  WrittenExerciseApiError,
  writtenExerciseErrorMessage,
  type WrittenExercise,
} from '@/lib/exercices-rediges'

const inputStyle =
  'w-full min-h-11 rounded-md border border-line bg-surface-raised px-3 py-2 font-mono text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function WrittenExerciseReader({
  initialExercise,
  preview = false,
}: {
  initialExercise: WrittenExercise
  preview?: boolean
}) {
  const [exercise, setExercise] = useState(initialExercise)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const helpId = useId()
  const errorId = useId()

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (preview || pending.current || exercise.soumission || exercise.cloture || !answer.trim()) {
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      setExercise(await submitWrittenExercise(exercise.id, exercise.version, answer))
    } catch (cause) {
      if (cause instanceof WrittenExerciseApiError && cause.status === 409) {
        try {
          const current = await getWrittenExercise(exercise.id)
          setExercise(current)
          if (current.cloture || current.soumission) return
        } catch {
          // Keep the current answer available if a second request also fails.
        }
      }
      setError(writtenExerciseErrorMessage(cause, 'Impossible de remettre ta réponse. Réessaie.'))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <Panel className="space-y-3">
        {exercise.echeance && (
          <p className="font-prose text-sm text-ink-muted">
            {exercise.cloture ? 'Exercice clôturé le ' : 'À remettre avant le '}
            <time dateTime={exercise.echeance}>{formatExerciseDeadline(exercise.echeance)}</time>
          </p>
        )}
        <h2 className="font-display text-lg font-extrabold text-ink">Énoncé</h2>
        <p className="whitespace-pre-wrap break-words font-prose text-base leading-relaxed text-ink">
          <RichTextRenderer text={exercise.enonce} />
        </p>
      </Panel>

      {!exercise.soumission && !exercise.cloture && (
        <Panel>
          <form className="space-y-3" onSubmit={submit}>
            <h2 className="font-display text-lg font-extrabold text-ink">Ta réponse</h2>
            <p id={helpId} className="font-prose text-sm text-ink-muted">
              Écris une expression en x avec des nombres, des parenthèses et des puissances entières
              positives ou nulles.
            </p>
            <ChampFormule
              ariaLabel="Ta réponse"
              value={answer}
              onChange={(value) => {
                setAnswer(value)
                setError('')
              }}
              placeholder="Par exemple, 2(x + 1)"
              inputClassName={inputStyle}
              keyboard="polynomial"
              maxLength={512}
              champ={{ 'aria-describedby': error ? `${helpId} ${errorId}` : helpId }}
            />
            {error && (
              <p id={errorId} role="alert" className="font-prose text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" disabled={preview || !answer.trim()} loading={busy}>
              Remettre ma réponse
            </Button>
          </form>
        </Panel>
      )}

      {exercise.soumission && (
        <Panel className="space-y-3">
          <h2 className="font-display text-lg font-extrabold text-ink">Ta réponse</h2>
          <p role="status" className="font-prose text-sm font-semibold text-ink">
            {exercise.soumission.correct ? 'Réponse correcte' : 'Réponse incorrecte'}
          </p>
          <ApercuKatex latex={exercise.soumission.reponse} />
          <p className="break-words font-mono text-sm text-ink-muted">
            {exercise.soumission.reponse}
          </p>
        </Panel>
      )}

      {exercise.cloture && !exercise.soumission && (
        <p role="status" className="font-prose text-sm text-ink-muted">
          Tu n’as pas remis de réponse.
        </p>
      )}

      {exercise.corrige && (
        <Panel className="space-y-3">
          <h2 className="font-display text-lg font-extrabold text-ink">Corrigé</h2>
          <p className="whitespace-pre-wrap break-words font-prose text-base leading-relaxed text-ink">
            <RichTextRenderer text={exercise.corrige} />
          </p>
        </Panel>
      )}
    </div>
  )
}
