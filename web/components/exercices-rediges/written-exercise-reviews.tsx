'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import {
  formatExerciseDeadline,
  listTeacherWrittenCopies,
  publishWrittenFeedback,
  teacherWrittenPhotoHref,
  writtenExerciseErrorMessage,
  type TeacherWrittenCopy,
} from '@/lib/exercices-rediges'

export function WrittenExerciseReviews({ exerciseId }: { exerciseId: string }) {
  const [copies, setCopies] = useState<TeacherWrittenCopy[] | null>(null)
  const [activeId, setActiveId] = useState<string>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const panelId = useId()

  useEffect(() => {
    const controller = new AbortController()
    void listTeacherWrittenCopies(exerciseId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setCopies(result)
          setLoading(false)
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setCopies(null)
          setError(writtenExerciseErrorMessage(cause, 'Impossible de charger les copies.'))
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [exerciseId, loadAttempt])

  const active = copies?.find((copy) => copy.eleveId === activeId)

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold text-ink">Copies remises</h2>
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => {
            setError('')
            setLoading(true)
            setLoadAttempt((attempt) => attempt + 1)
          }}
        >
          Actualiser les copies
        </Button>
      </div>

      {loading && (
        <p role="status" className="text-sm text-ink-muted">
          Chargement des copies…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {copies?.length === 0 && <p className="text-sm text-ink-muted">Aucune copie remise.</p>}
      {copies && copies.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {copies.map((copy) => (
            <li key={copy.eleveId}>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                aria-expanded={copy.eleveId === activeId}
                aria-controls={copy.eleveId === activeId ? panelId : undefined}
                onClick={() =>
                  setActiveId((current) => (current === copy.eleveId ? undefined : copy.eleveId))
                }
              >
                {copy.nomAffiche}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <CopyReview
          key={active.eleveId}
          panelId={panelId}
          exerciseId={exerciseId}
          copy={active}
          onPublished={(updated) =>
            setCopies(
              (current) =>
                current?.map((copy) => (copy.eleveId === updated.eleveId ? updated : copy)) ?? null
            )
          }
        />
      )}
    </Panel>
  )
}

function CopyReview({
  panelId,
  exerciseId,
  copy,
  onPublished,
}: {
  panelId: string
  exerciseId: string
  copy: TeacherWrittenCopy
  onPublished: (updated: TeacherWrittenCopy) => void
}) {
  const [feedback, setFeedback] = useState(copy.retour?.commentaire ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const pending = useRef(false)

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || !feedback.trim()) return
    pending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      onPublished(await publishWrittenFeedback(exerciseId, copy.eleveId, feedback.trim()))
      setNotice('Retour publié.')
    } catch (cause) {
      setError(writtenExerciseErrorMessage(cause, 'Impossible de publier le retour.'))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <section id={panelId} aria-labelledby={`${panelId}-title`} className="space-y-4">
      <Panel raised className="space-y-2">
        <h3 id={`${panelId}-title`} className="font-display text-base font-extrabold text-ink">
          Copie de {copy.nomAffiche}
        </h3>
        <p className="text-sm text-ink-muted">
          Remise le <time dateTime={copy.remisAt}>{formatExerciseDeadline(copy.remisAt)}</time>
        </p>
        {copy.reponse && <p className="whitespace-pre-wrap break-words">{copy.reponse}</p>}
        {copy.photo && (
          <a
            href={teacherWrittenPhotoHref(exerciseId, copy.eleveId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-accent-ink underline"
          >
            Ouvrir la photo de la copie
          </a>
        )}
      </Panel>
      <form className="space-y-2" onSubmit={publish}>
        <label className="block space-y-1">
          <span className="block text-sm font-semibold">Commentaire pour l’élève</span>
          <textarea
            className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 font-prose text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            rows={4}
            maxLength={8000}
            value={feedback}
            disabled={busy}
            onChange={(event) => {
              setFeedback(event.target.value)
              setError('')
              setNotice('')
            }}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm font-semibold text-ink">
            {notice}
          </p>
        )}
        <Button type="submit" loading={busy} disabled={!feedback.trim()}>
          {copy.retour ? 'Mettre à jour le retour' : 'Publier le retour'}
        </Button>
      </form>
    </section>
  )
}
