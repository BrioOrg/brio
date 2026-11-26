'use client'

import { listerMesCours, type CoursResume } from '@brio/api-client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ChampFormule } from '@/components/maths/champ-formule'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import { TextInput } from '@/components/ui/text-input'
import { apiBaseUrl } from '@/lib/api-base-url'
import {
  closeWrittenExercise,
  formatExerciseDeadline,
  listTeacherWrittenExercises,
  publishWrittenExercise,
  saveWrittenExercise,
  writtenExerciseErrorMessage,
  type TeacherWrittenExercise,
  type WrittenExerciseDraft,
} from '@/lib/exercices-rediges'
import { WrittenExerciseReader } from './written-exercise-reader'

const fieldStyle =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 font-prose text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:bg-surface-panel'

type BuilderForm = Omit<WrittenExerciseDraft, 'echeance'> & { deadlineLocal: string }

const blankForm: BuilderForm = {
  coursId: '',
  titre: '',
  enonce: '',
  reponseAttendue: '',
  corrige: '',
  deadlineLocal: '',
}

function formFromExercise(exercise: TeacherWrittenExercise): BuilderForm {
  const deadline = exercise.echeance ? new Date(exercise.echeance) : null
  // datetime-local shows the teacher's local wall time. The API stores the instant as UTC.
  const local = deadline
    ? new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60_000)
    : null
  return {
    coursId: exercise.coursId,
    titre: exercise.titre,
    enonce: exercise.enonce,
    reponseAttendue: exercise.reponseAttendue,
    corrige: exercise.corrige,
    deadlineLocal: local?.toISOString().slice(0, 16) ?? '',
  }
}

export function WrittenExerciseBuilder() {
  const [catalogue, setCatalogue] = useState<{
    courses: CoursResume[]
    exercises: TeacherWrittenExercise[]
  } | null>(null)
  const [form, setForm] = useState<BuilderForm | null>(null)
  const [selectedId, setSelectedId] = useState<string>()
  const [preview, setPreview] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([listerMesCours(apiBaseUrl()), listTeacherWrittenExercises(controller.signal)])
      .then(([courses, exercises]) => {
        if (!controller.signal.aborted) {
          setCatalogue({ courses, exercises })
          setError('')
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(writtenExerciseErrorMessage(cause, 'Impossible de charger les exercices.'))
        }
      })
    return () => controller.abort()
  }, [loadAttempt])

  const selected = catalogue?.exercises.find((exercise) => exercise.id === selectedId)
  const published = selected?.publie === true

  function selectExercise(exercise?: TeacherWrittenExercise) {
    setSelectedId(exercise?.id)
    setForm(
      exercise
        ? formFromExercise(exercise)
        : {
            ...blankForm,
            coursId: catalogue?.courses.length === 1 ? (catalogue.courses[0].id ?? '') : '',
          }
    )
    setPreview(false)
    setConfirmClose(false)
    setNotice('')
    setError('')
  }

  function change(patch: Partial<BuilderForm>) {
    setForm((current) => (current && { ...current, ...patch }) || current)
    setError('')
    setNotice('')
  }

  function applyExercise(exercise: TeacherWrittenExercise) {
    setCatalogue(
      (current) =>
        current && {
          ...current,
          exercises: [exercise, ...current.exercises.filter(({ id }) => id !== exercise.id)],
        }
    )
    setSelectedId(exercise.id)
    setForm(formFromExercise(exercise))
  }

  async function save(publish: boolean) {
    if (!form || busy || published || !form.coursId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { deadlineLocal, ...fields } = form
      const echeance = deadlineLocal ? new Date(deadlineLocal).toISOString() : null
      const saved = await saveWrittenExercise({ ...fields, echeance }, selectedId)
      applyExercise(saved)
      if (publish) {
        const exercise = await publishWrittenExercise(saved.id)
        applyExercise(exercise)
        setNotice('Exercice publié dans la leçon.')
      } else {
        setNotice('Brouillon enregistré.')
      }
    } catch (cause) {
      setError(
        writtenExerciseErrorMessage(
          cause,
          publish
            ? 'Impossible de publier l’exercice. Vérifie les champs.'
            : 'Impossible d’enregistrer le brouillon.'
        )
      )
    } finally {
      setBusy(false)
    }
  }

  async function close() {
    if (!selected || busy || !confirmClose) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      applyExercise(await closeWrittenExercise(selected.id))
      setConfirmClose(false)
      setNotice('Exercice clôturé. Le corrigé est disponible.')
    } catch (cause) {
      setError(writtenExerciseErrorMessage(cause, 'Impossible de clôturer cet exercice.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 font-prose text-ink sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-black tracking-tight">Exercices rédigés</h1>
        {catalogue && catalogue.courses.length > 0 && (
          <Button type="button" disabled={busy} onClick={() => selectExercise()}>
            Nouvel exercice
          </Button>
        )}
      </div>

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

      {!catalogue &&
        (error ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setError('')
              setLoadAttempt((attempt) => attempt + 1)
            }}
          >
            Réessayer
          </Button>
        ) : (
          <p role="status" className="text-sm text-ink-muted">
            Chargement des exercices…
          </p>
        ))}

      {catalogue && catalogue.courses.length === 0 && (
        <Panel className="space-y-3">
          <p>Créez d’abord une leçon dans « Mes cours » pour y rattacher un exercice.</p>
          <Link href="/prof" className="font-semibold text-accent-ink underline">
            Mes cours
          </Link>
        </Panel>
      )}

      {catalogue && catalogue.exercises.length > 0 && (
        <Panel className="space-y-2">
          <h2 className="font-display text-lg font-extrabold">Vos exercices</h2>
          <ul className="flex flex-wrap gap-2">
            {catalogue.exercises.map((exercise) => (
              <li key={exercise.id}>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  aria-pressed={exercise.id === selectedId}
                  disabled={busy}
                  onClick={() => selectExercise(exercise)}
                >
                  {exercise.titre || 'Brouillon sans titre'}
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {catalogue && form && (
        <Panel className="space-y-4">
          <h2 className="font-display text-lg font-extrabold">
            {published ? 'Exercice publié' : 'Brouillon'}
          </h2>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void save(false)
            }}
          >
            <fieldset className="space-y-4" disabled={published || busy}>
              <label className="block space-y-1">
                <span className="block text-sm font-semibold">Leçon</span>
                <select
                  className={fieldStyle}
                  required
                  value={form.coursId}
                  onChange={(event) => change({ coursId: event.target.value })}
                >
                  <option value="">Choisir une leçon</option>
                  {catalogue.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.titre}
                    </option>
                  ))}
                </select>
              </label>
              <TextInput
                label="Titre"
                maxLength={160}
                value={form.titre}
                onChange={(event) => change({ titre: event.target.value })}
              />
              <label className="block space-y-1">
                <span className="block text-sm font-semibold">Énoncé</span>
                <textarea
                  className={fieldStyle}
                  maxLength={8000}
                  rows={4}
                  value={form.enonce}
                  onChange={(event) => change({ enonce: event.target.value })}
                />
              </label>
              <div className="space-y-1">
                <p className="text-sm font-semibold">Réponse attendue</p>
                <ChampFormule
                  ariaLabel="Réponse attendue"
                  keyboard="polynomial"
                  maxLength={512}
                  value={form.reponseAttendue}
                  onChange={(value) => change({ reponseAttendue: value })}
                  inputClassName={fieldStyle}
                />
                <p className="text-sm text-ink-muted">
                  Le correcteur accepte les expressions polynomiales équivalentes en x.
                </p>
              </div>
              <label className="block space-y-1">
                <span className="block text-sm font-semibold">Corrigé</span>
                <textarea
                  className={fieldStyle}
                  maxLength={8000}
                  rows={4}
                  value={form.corrige}
                  onChange={(event) => change({ corrige: event.target.value })}
                />
              </label>
              <TextInput
                type="datetime-local"
                label="Échéance"
                value={form.deadlineLocal}
                onChange={(event) => change({ deadlineLocal: event.target.value })}
              />
              <p className="text-sm text-ink-muted">
                Laissez vide pour un entraînement sans échéance. La date est saisie dans l’heure
                locale de cet appareil.
              </p>
            </fieldset>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={!form.enonce.trim() || busy}
                aria-expanded={preview}
                onClick={() => setPreview((show) => !show)}
              >
                {preview ? 'Masquer l’aperçu' : 'Prévisualiser'}
              </Button>
              {!published && (
                <>
                  <Button type="submit" variant="secondary" disabled={!form.coursId} loading={busy}>
                    Enregistrer le brouillon
                  </Button>
                  {selected && (
                    <Button
                      type="button"
                      disabled={!form.coursId}
                      loading={busy}
                      onClick={() => void save(true)}
                    >
                      Publier
                    </Button>
                  )}
                </>
              )}
              {published && selected.echeance && !selected.cloture && !confirmClose && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirmClose(true)}
                >
                  Clôturer maintenant
                </Button>
              )}
            </div>
          </form>
          {confirmClose && (
            <div className="space-y-3">
              <p>
                Après la clôture, les élèves pourront voir le corrigé même sans avoir remis de
                réponse.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="destructive"
                  loading={busy}
                  onClick={() => void close()}
                >
                  Confirmer la clôture
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirmClose(false)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
          {selected?.cloture && selected.echeance && (
            <p className="text-sm text-ink-muted">
              Clôturé le {formatExerciseDeadline(selected.echeance)}.
            </p>
          )}
        </Panel>
      )}

      {preview && form && (
        <section aria-label="Aperçu élève" className="space-y-3">
          <h2 className="font-display text-lg font-extrabold">Aperçu élève</h2>
          {form.titre && <p className="font-display text-xl font-extrabold">{form.titre}</p>}
          <WrittenExerciseReader
            key={`${selectedId ?? 'draft'}:${form.enonce}`}
            preview
            initialExercise={{
              id: selectedId ?? 'preview',
              version: selected?.version ?? 1,
              titre: form.titre,
              enonce: form.enonce,
              cloture: false,
            }}
          />
        </section>
      )}
    </main>
  )
}
