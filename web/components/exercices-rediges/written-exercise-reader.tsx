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
  studentWrittenPhotoHref,
  submitWrittenExercise,
  WRITTEN_PHOTO_MAX_BYTES,
  WrittenExerciseApiError,
  writtenExerciseErrorMessage,
  type WrittenExercise,
} from '@/lib/exercices-rediges'

const inputStyle =
  'w-full min-h-11 rounded-md border border-line bg-surface-raised px-3 py-2 font-mono text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const fileStyle =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 font-prose text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function WrittenExerciseReader({
  initialExercise,
  preview = false,
}: {
  initialExercise: WrittenExercise
  preview?: boolean
}) {
  const [exercise, setExercise] = useState(initialExercise)
  const [answer, setAnswer] = useState('')
  const [photo, setPhoto] = useState<File>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const pending = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const helpId = useId()
  const errorId = useId()
  const photoHelpId = useId()
  const photoErrorId = useId()
  const reviewedByTeacher = exercise.modeCorrection === 'enseignant'
  const acceptsPhoto = reviewedByTeacher && exercise.photoAutorisee
  const readyToSubmit = !photoError && (answer.trim() || (acceptsPhoto && photo))

  function changePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setError('')
    if (
      file &&
      (!['image/jpeg', 'image/png'].includes(file.type) ||
        file.size === 0 ||
        file.size > WRITTEN_PHOTO_MAX_BYTES)
    ) {
      event.target.value = ''
      setPhoto(undefined)
      setPhotoError('Choisis une photo JPEG ou PNG de 5 Mo maximum.')
      return
    }
    setPhoto(file)
    setPhotoError('')
  }

  function removePhoto() {
    if (fileInput.current) fileInput.current.value = ''
    setPhoto(undefined)
    setPhotoError('')
    setError('')
    fileInput.current?.focus()
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (preview || pending.current || exercise.soumission || exercise.cloture || !readyToSubmit) {
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      setExercise(
        await submitWrittenExercise(
          exercise.id,
          exercise.version,
          answer,
          acceptsPhoto ? photo : undefined
        )
      )
      setPhoto(undefined)
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
            {reviewedByTeacher ? (
              <textarea
                aria-label="Ta réponse"
                aria-describedby={error ? errorId : undefined}
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value)
                  setError('')
                }}
                className={fileStyle}
                rows={8}
                maxLength={12000}
                disabled={busy}
              />
            ) : (
              <>
                <p id={helpId} className="font-prose text-sm text-ink-muted">
                  Écris une expression en x avec des nombres, des parenthèses et des puissances
                  entières positives ou nulles.
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
              </>
            )}
            {acceptsPhoto && (
              <div className="space-y-2">
                <label className="block space-y-1">
                  <span className="block font-prose text-sm font-semibold">
                    Photo de ta copie (facultative)
                  </span>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png"
                    className={fileStyle}
                    aria-describedby={photoError ? `${photoHelpId} ${photoErrorId}` : photoHelpId}
                    aria-invalid={!!photoError}
                    disabled={busy}
                    onChange={changePhoto}
                  />
                </label>
                <p id={photoHelpId} className="font-prose text-sm text-ink-muted">
                  Tu peux remettre une photo JPEG ou PNG de 5 Mo maximum, seule ou avec ton texte.
                </p>
                {photoError && (
                  <p id={photoErrorId} role="alert" className="font-prose text-sm text-danger">
                    {photoError}
                  </p>
                )}
                {(photo || photoError) && (
                  <Button type="button" variant="secondary" disabled={busy} onClick={removePhoto}>
                    Retirer la photo
                  </Button>
                )}
              </div>
            )}
            {error && (
              <p id={errorId} role="alert" className="font-prose text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" disabled={preview || !readyToSubmit} loading={busy}>
              Remettre ma réponse
            </Button>
          </form>
        </Panel>
      )}

      {exercise.soumission && (
        <Panel className="space-y-3">
          <h2 className="font-display text-lg font-extrabold text-ink">Ta réponse</h2>
          {reviewedByTeacher ? (
            <>
              {exercise.soumission.reponse && (
                <p className="whitespace-pre-wrap break-words font-prose text-base text-ink">
                  {exercise.soumission.reponse}
                </p>
              )}
              {exercise.soumission.photo && (
                <a
                  href={studentWrittenPhotoHref(exercise.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-prose text-sm font-semibold text-accent-ink underline"
                >
                  Ouvrir la photo de ta copie
                </a>
              )}
            </>
          ) : (
            <>
              {typeof exercise.soumission.correct === 'boolean' && (
                <p role="status" className="font-prose text-sm font-semibold text-ink">
                  {exercise.soumission.correct ? 'Réponse correcte' : 'Réponse incorrecte'}
                </p>
              )}
              <ApercuKatex latex={exercise.soumission.reponse} />
              <p className="break-words font-mono text-sm text-ink-muted">
                {exercise.soumission.reponse}
              </p>
            </>
          )}
        </Panel>
      )}

      {exercise.cloture && !exercise.soumission && (
        <p role="status" className="font-prose text-sm text-ink-muted">
          Tu n’as pas remis de réponse.
        </p>
      )}

      {exercise.corrige && (
        <Panel className="space-y-3">
          <h2 className="font-display text-lg font-extrabold text-ink">
            {reviewedByTeacher ? 'Grille de correction' : 'Corrigé'}
          </h2>
          <p className="whitespace-pre-wrap break-words font-prose text-base leading-relaxed text-ink">
            <RichTextRenderer text={exercise.corrige} />
          </p>
          {reviewedByTeacher && exercise.copieModele && (
            <>
              <h3 className="font-display text-base font-extrabold text-ink">Copie modèle</h3>
              <p className="whitespace-pre-wrap break-words font-prose text-base leading-relaxed text-ink">
                <RichTextRenderer text={exercise.copieModele} />
              </p>
            </>
          )}
        </Panel>
      )}

      {reviewedByTeacher && exercise.soumission && (
        <Panel className="space-y-3">
          <h2 className="font-display text-lg font-extrabold text-ink">Retour de l’enseignant</h2>
          {exercise.soumission.retour ? (
            <p className="whitespace-pre-wrap break-words font-prose text-base text-ink">
              {exercise.soumission.retour.commentaire}
            </p>
          ) : (
            <p role="status" className="font-prose text-sm text-ink-muted">
              En attente du retour de ton enseignant.
            </p>
          )}
        </Panel>
      )}
    </div>
  )
}
