'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { soumettre, type SoumissionResult } from '@/lib/api'
import { useChapterInteraction } from '@/components/chapter-interaction-context'
import { useProgression } from '@/components/progression-context'
import { EntraideExercice } from '@/components/entraide/entraide-exercice'
import { useEntraideActive } from '@/components/entraide/entraide-context'
import { OptionRow, type OptionState } from '@/components/ui/option-row'
import { TextInput } from '@/components/ui/text-input'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { ResultSheetSurface, resultSheetText } from '@/components/ui/result-sheet'
import { useModeChapitre } from '@/components/chapitre-interactif/mode-context'

type Choice = { id: string; text: string }

/** The part of the course a wrong answer sends the student back to (#253). */
export type CourseSection = { id: string; title: string }

type ExerciceWidgetProps = {
  id?: string
  exerciseType: string
  prompt: string
  choices?: Choice[]
  multiple?: boolean
  unit?: string
  explanation?: string
  /** Where « Pas tout à fait » points; absent when the exercise sits in an exercises section. */
  courseSection?: CourseSection
  placeholder?: string
  /** fill-blank: sentence with `{}` markers, one per blank. */
  template?: string
  /** fill-blank: the pool of tiles the student picks from. */
  bank?: string[]
} & (
  | { exerciceId: string; apercu?: false }
  /**
   * Teacher's preview of an unpublished draft: the exercise has no `exerciceId` yet (assigned at
   * publication, ADR 0019 §4), so it renders as the student sees it but cannot be checked.
   */
  | { exerciceId?: undefined; apercu: true }
)

const BLANK_MARKER = '{}'

type PaperExerciseProps = {
  id?: string
  prompt: string
  /** The given data / setup shown under the prompt. */
  statement?: string
  /** Author-provided model correction, shown for self-comparison. */
  solution: string
}

/**
 * "Sur feuille" exercise — the student works on paper, reveals the model
 * correction, then self-assesses. No auto-grading and no submission: the result
 * is the student's own honest judgement (mockup 4-types-exercices, self-check).
 *
 * Showing the model answer is intentional here and specific to this type — it is
 * how self-assessment works. It is NOT the T0-protected auto-graded flow, which
 * never reveals the expected answer.
 */
export function PaperExercise({ id, prompt, statement, solution }: PaperExerciseProps) {
  const [revealed, setRevealed] = useState(false)
  const [selfResult, setSelfResult] = useState<'ok' | 'review' | null>(null)

  return (
    <div id={id} className="rounded-lg border border-line bg-surface-panel p-5">
      <p className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
        Exercice sur feuille
      </p>
      <p className="mb-3 font-prose text-base leading-relaxed text-ink group-data-[chapitre-mode=interactif]/mode:font-display group-data-[chapitre-mode=interactif]/mode:text-2xl group-data-[chapitre-mode=interactif]/mode:font-extrabold group-data-[chapitre-mode=interactif]/mode:leading-snug">
        {prompt}
      </p>
      {statement && (
        <p className="mb-3 font-prose text-sm leading-relaxed text-ink-muted">{statement}</p>
      )}

      <p className="mb-4 flex items-start gap-2 rounded-md border border-line bg-surface-raised px-3 py-2.5 font-prose text-sm text-ink-muted">
        <Icon name="book-open" weight="bold" size={18} className="mt-0.5 shrink-0 text-accent" />
        <span>Fais-le d’abord au brouillon — c’est ça, faire des maths.</span>
      </p>

      {!revealed ? (
        <Button onClick={() => setRevealed(true)} className="w-full sm:w-auto">
          Voir la correction
        </Button>
      ) : (
        <>
          <div className="rounded-lg border border-line bg-surface-raised p-4">
            <p className="mb-1 font-display text-xs font-extrabold uppercase tracking-widest text-accent-ink">
              Correction
            </p>
            <p className="whitespace-pre-line font-prose text-sm leading-relaxed text-ink">
              {solution}
            </p>
          </div>

          {selfResult === null ? (
            <div className="mt-4">
              <p className="mb-2 font-prose text-sm font-semibold text-ink">
                As-tu réussi ta démonstration&nbsp;?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setSelfResult('review')}>
                  À revoir
                </Button>
                <Button onClick={() => setSelfResult('ok')}>J’avais juste</Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-line bg-surface-panel p-4" role="status">
              <p className="font-prose text-sm leading-relaxed text-ink">
                {selfResult === 'ok'
                  ? 'Bravo — la rédaction sur feuille, c’est le vrai entraînement. Continue comme ça.'
                  : 'Pas grave : relis la correction, refais-la au propre, et tu vas y arriver.'}
              </p>
              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={() => setSelfResult(null)}>
                  Refaire mon auto-évaluation
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const MARKERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function ExerciceWidget({
  id,
  exerciceId,
  exerciseType,
  prompt,
  choices,
  multiple,
  unit,
  explanation,
  courseSection,
  placeholder,
  template,
  bank,
  apercu,
}: ExerciceWidgetProps) {
  const { setActiveExerciceId } = useChapterInteraction()
  const { refresh: refreshProgression } = useProgression()
  const entraide = useEntraideActive()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [numericValue, setNumericValue] = useState('')
  const [shortAnswerText, setShortAnswerText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SoumissionResult | null>(null)
  const [xpGain, setXpGain] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  // fill-blank: the sentence splits into text parts around each `{}` blank.
  const textParts = template ? template.split(BLANK_MARKER) : []
  const blankCount = Math.max(textParts.length - 1, 0)
  // Each blank holds the index of the bank tile placed in it (or null).
  const [filledBlanks, setFilledBlanks] = useState<(number | null)[]>(() =>
    Array(blankCount).fill(null)
  )

  // Interactive mode (#246): the same widget, laid out full screen. It draws « Vérifier » in the
  // slide's bottom bar and its result in a sheet over it, both through portals, so its state and
  // its form stay here. Outside a chapter's provider (teacher courses, the editor) this is inert.
  const ctx = useModeChapitre()
  const formId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const enonceRef = useRef<HTMLParagraphElement>(null)
  const interactif = ctx?.mode === 'interactif'
  const courant =
    interactif &&
    id !== undefined &&
    (ctx.deck[ctx.index]?.blockIds as readonly string[] | undefined)?.includes(id) === true
  const feuille = courant && result !== null && ctx.feuilleOuverte === id
  const [refocus, setRefocus] = useState(false)

  // After « Réessayer », the answer field once the form is enabled; without one (options, tiles),
  // the prompt: focus on an option would make Entrée toggle it instead of checking.
  useEffect(() => {
    if (!refocus) return
    setRefocus(false)
    const champ = formRef.current?.querySelector<HTMLElement>('input:not([disabled])')
    ;(champ ?? enonceRef.current)?.focus()
  }, [refocus])

  // Keyboard on the current slide: A–E or 1–5 pick an option, Entrée checks. Never while typing in
  // a field (a digit there is an answer), never over the sheet (its buttons take Entrée).
  const clavier = useRef<(e: KeyboardEvent) => void>(() => {})
  clavier.current = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || ctx?.tiroirOuvert) return
    const cible = e.target instanceof Element ? e.target : null
    if (cible?.closest('input, textarea, select, [contenteditable="true"]')) return
    if (result) return
    if (e.key === 'Enter') {
      if (cible?.closest('button, a[href], summary')) return
      e.preventDefault()
      formRef.current?.requestSubmit()
      return
    }
    if (exerciseType !== 'multiple-choice' || !choices) return
    const touche = e.key.toUpperCase()
    const i = /^[1-9]$/.test(touche) ? Number(touche) - 1 : MARKERS.indexOf(touche)
    if (i < 0 || i >= choices.length) return
    e.preventDefault()
    toggleChoice(choices[i].id)
  }
  useEffect(() => {
    if (!courant || feuille) return
    const onKeyDown = (e: KeyboardEvent) => clavier.current(e)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [courant, feuille])

  function continuer() {
    ctx?.setFeuilleOuverte(null)
    ctx?.suivante()
  }

  function reessayer() {
    reset()
    ctx?.setFeuilleOuverte(null)
    setRefocus(true)
  }

  function markActive() {
    if (exerciceId) setActiveExerciceId(exerciceId)
  }

  function placeTile(tileIndex: number) {
    if (result) return
    markActive()
    setValidationError(null)
    setFilledBlanks((prev) => {
      if (prev.includes(tileIndex)) return prev // already placed
      const firstEmpty = prev.indexOf(null)
      if (firstEmpty === -1) return prev // all blanks full
      const next = [...prev]
      next[firstEmpty] = tileIndex
      return next
    })
  }

  function clearBlank(blankIndex: number) {
    if (result) return
    markActive()
    setValidationError(null)
    setFilledBlanks((prev) => {
      const next = [...prev]
      next[blankIndex] = null
      return next
    })
  }

  function toggleChoice(choiceId: string) {
    markActive()
    if (multiple) {
      setSelectedIds((prev) =>
        prev.includes(choiceId) ? prev.filter((x) => x !== choiceId) : [...prev, choiceId]
      )
    } else {
      setSelectedIds([choiceId])
    }
    setValidationError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setValidationError(null)

    if (exerciseType === 'multiple-choice') {
      if (selectedIds.length === 0) {
        setValidationError('Sélectionne au moins une réponse.')
        return
      }
    } else if (exerciseType === 'numeric') {
      if (numericValue.trim() === '') {
        setValidationError('Saisis une valeur numérique.')
        return
      }
    } else if (exerciseType === 'short-answer') {
      if (shortAnswerText.trim() === '') {
        setValidationError('Saisis ta réponse.')
        return
      }
    } else if (exerciseType === 'fill-blank') {
      if (filledBlanks.some((b) => b === null)) {
        setValidationError('Remplis tous les trous.')
        return
      }
    }

    const answer: Record<string, unknown> =
      exerciseType === 'multiple-choice'
        ? { choiceIds: selectedIds }
        : exerciseType === 'short-answer'
          ? { text: shortAnswerText }
          : exerciseType === 'fill-blank'
            ? { blanks: filledBlanks.map((b) => (b !== null && bank ? bank[b] : '')) }
            : { value: Number(numericValue) }

    if (!exerciceId) return // preview: nothing to grade against

    setLoading(true)
    try {
      const res = await soumettre(exerciceId, answer)
      setResult(res)
      if (id) {
        ctx?.signalerExercice(id, res.correct === true ? 'resolu' : 'tente')
        if (courant) ctx?.setFeuilleOuverte(id)
      }
      // A correct answer may have awarded XP (asynchronously, ADR 0022). Re-read
      // progression and surface the real gain — never a fixed number. Runs in the
      // background so the feedback panel shows immediately.
      if (res.correct === true) {
        refreshProgression()
          .then((delta) => {
            if (delta > 0) setXpGain(delta)
          })
          .catch(() => {
            // XP is non-critical feedback; a failed re-read just shows no gain.
          })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau. Réessaie plus tard.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setResult(null)
    setXpGain(null)
    setSelectedIds([])
    setNumericValue('')
    setShortAnswerText('')
    setFilledBlanks(Array(blankCount).fill(null))
    setError(null)
  }

  // Choice state after submission NEVER reveals an un-selected correct option (T0):
  // only the student's own picks are marked correct/wrong; everything else is muted.
  function choiceState(choiceId: string): OptionState {
    if (!result) return selectedIds.includes(choiceId) ? 'selected' : 'idle'
    if (!selectedIds.includes(choiceId)) return 'muted'
    const fb = result.choiceFeedback.find((c) => c.choiceId === choiceId)
    return fb?.correct ? 'correct' : 'wrong'
  }

  const submitDisabled =
    apercu || loading || (exerciseType === 'short-answer' && shortAnswerText.trim() === '')

  return (
    <div
      id={id}
      className="rounded-lg border border-line bg-surface-panel p-5 group-data-[chapitre-mode=interactif]/mode:border-0 group-data-[chapitre-mode=interactif]/mode:bg-transparent group-data-[chapitre-mode=interactif]/mode:p-0"
    >
      <p className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted group-data-[chapitre-mode=interactif]/mode:hidden">
        Exercice
      </p>
      <p
        ref={enonceRef}
        tabIndex={-1}
        className="mb-4 font-prose text-base leading-relaxed text-ink focus:outline-none group-data-[chapitre-mode=interactif]/mode:mb-6 group-data-[chapitre-mode=interactif]/mode:font-display group-data-[chapitre-mode=interactif]/mode:text-2xl group-data-[chapitre-mode=interactif]/mode:font-extrabold group-data-[chapitre-mode=interactif]/mode:leading-snug"
      >
        {prompt}
      </p>

      <form id={formId} ref={formRef} onSubmit={handleSubmit} noValidate>
        {exerciseType === 'multiple-choice' && choices && (
          <fieldset className="mb-4" disabled={result !== null}>
            <legend className="sr-only">Choix de réponse</legend>
            <div className="flex flex-col gap-2">
              {choices.map((choice, i) => (
                <OptionRow
                  key={choice.id}
                  label={choice.text}
                  marker={MARKERS[i] ?? String(i + 1)}
                  state={choiceState(choice.id)}
                  onClick={() => toggleChoice(choice.id)}
                />
              ))}
            </div>
          </fieldset>
        )}

        {exerciseType === 'numeric' && (
          <div className="mb-4 flex items-end gap-3">
            <TextInput
              label="Ta réponse"
              inputMode="decimal"
              type="number"
              step="any"
              value={numericValue}
              disabled={result !== null}
              onChange={(e) => {
                markActive()
                setNumericValue(e.target.value)
                setValidationError(null)
              }}
              placeholder="Ta réponse"
              className="w-44"
            />
            {unit && (
              <span className="pb-3 font-prose text-base text-ink-muted" aria-hidden="true">
                {unit}
              </span>
            )}
          </div>
        )}

        {exerciseType === 'short-answer' && (
          <div className="mb-4">
            <TextInput
              label="Ta réponse"
              type="text"
              value={shortAnswerText}
              disabled={result !== null}
              onChange={(e) => {
                markActive()
                setShortAnswerText(e.target.value)
                setValidationError(null)
              }}
              placeholder={placeholder ?? 'Ta réponse'}
            />
          </div>
        )}

        {exerciseType === 'fill-blank' && template && bank && (
          <div className="mb-4">
            <p className="mb-3 font-prose text-base leading-relaxed text-ink">
              {textParts.map((part, i) => (
                <span key={i}>
                  {part}
                  {i < blankCount &&
                    (filledBlanks[i] !== null ? (
                      <button
                        type="button"
                        onClick={() => clearBlank(i)}
                        disabled={result !== null}
                        aria-label={`Trou ${i + 1} : ${bank[filledBlanks[i] as number]} — retirer`}
                        className="mx-1 inline-flex min-w-14 items-center justify-center rounded-t-md border-b-2 border-accent bg-accent-soft px-2 py-0.5 font-display font-extrabold text-accent-ink"
                      >
                        {bank[filledBlanks[i] as number]}
                      </button>
                    ) : (
                      <span
                        aria-label={`Trou ${i + 1} à remplir`}
                        className="mx-1 inline-block min-w-14 rounded-t-md border-b-2 border-ink-muted px-2 py-0.5 align-middle"
                      >
                        &nbsp;
                      </span>
                    ))}
                </span>
              ))}
            </p>
            <p className="mb-2 font-prose text-sm text-ink-muted">
              Touche une étiquette pour remplir le prochain trou.
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Étiquettes">
              {bank.map((tile, i) => {
                const used = filledBlanks.includes(i)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => placeTile(i)}
                    disabled={used || result !== null}
                    className="rounded-md border-2 border-line bg-surface-raised px-3 py-1.5 font-display font-extrabold text-ink transition-[transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)] enabled:hover:-translate-y-0.5 enabled:hover:[box-shadow:0_3px_0_var(--color-line)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel"
                  >
                    {tile}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {validationError && (
          <p role="alert" className="mb-3 font-prose text-sm text-feedback-incorrect">
            {validationError}
          </p>
        )}

        {error && (
          <p role="alert" className="mb-3 font-prose text-sm text-danger">
            {error}
          </p>
        )}

        {!result && !interactif && (
          <Button
            type="submit"
            loading={loading}
            disabled={submitDisabled}
            className="w-full sm:w-auto"
          >
            Vérifier
          </Button>
        )}
        {apercu && (
          <p className="mt-2 font-prose text-sm text-ink-muted">
            La correction sera active une fois le cours publié.
          </p>
        )}
      </form>

      {courant &&
        ctx?.piedExercice &&
        createPortal(
          !result ? (
            <Button
              type="submit"
              form={formId}
              loading={loading}
              disabled={submitDisabled}
              className="min-w-40"
            >
              Vérifier
            </Button>
          ) : result.correct !== true && !feuille ? (
            <Button variant="secondary" size="sm" onClick={reessayer}>
              Réessayer
            </Button>
          ) : null,
          ctx.piedExercice
        )}

      {feuille &&
        result &&
        ctx?.feuilleExercice &&
        createPortal(
          <FeuilleResultat
            result={result}
            exerciseType={exerciseType}
            staticExplanation={explanation}
            courseSection={courseSection}
            xpGain={xpGain}
            onContinuer={continuer}
            onReessayer={reessayer}
          />,
          ctx.feuilleExercice
        )}

      {result && !interactif && (
        <ResultPanel
          result={result}
          exerciseType={exerciseType}
          staticExplanation={explanation}
          courseSection={courseSection}
          xpGain={xpGain}
          onReset={reset}
        />
      )}

      {entraide && exerciceId && <EntraideExercice exerciceId={exerciceId} />}
    </div>
  )
}

type ResultPanelProps = {
  result: SoumissionResult
  exerciseType: string
  staticExplanation?: string
  courseSection?: CourseSection
  /** Real XP awarded for this answer, or null when none (cap reached / already earned). */
  xpGain?: number | null
  onReset: () => void
}

const RESULT_CONFIG = {
  success: {
    surface: 'border-accent bg-surface-result-correct',
    iconBg: 'bg-accent',
    title: 'text-accent-edge',
    icon: 'check',
    heading: 'Bien vu !',
  },
  failure: {
    surface: 'border-feedback-incorrect bg-surface-result-incorrect',
    iconBg: 'bg-feedback-incorrect',
    title: 'text-feedback-incorrect-edge',
    icon: 'x',
    heading: 'Pas tout à fait…',
  },
} as const

/**
 * What a result says (#253). A wrong answer never reveals the expected answer (T0). Author
 * explanations often state it, so they appear only after a correct answer; a wrong one gets a
 * nudge that reveals nothing, pointing back to the lesson section when there is one. We never echo
 * `expectedValue` or accepted answers.
 */
function retour(
  result: SoumissionResult,
  exerciseType: string,
  staticExplanation: string | undefined,
  courseSection: CourseSection | undefined
) {
  const isCorrect = result.correct === true
  const explanation = isCorrect ? (result.explanation ?? staticExplanation) : null
  const nudge = isCorrect
    ? null
    : courseSection
      ? 'Regarde cette partie du cours.'
      : exerciseType === 'short-answer'
        ? 'On regarde ensemble : relis la section précédente.'
        : 'On regarde ensemble : reprends le raisonnement pas à pas.'
  return { isCorrect, explanation, nudge }
}

/** The real XP this answer earned (ADR 0022), never a fixed number. */
function GainXp({ xpGain }: { xpGain?: number | null }) {
  if (xpGain == null || xpGain <= 0) return null
  return (
    <span
      className="xp-pop inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-display text-xs font-extrabold text-xp"
      role="status"
    >
      <Icon name="star" weight="bold" size={14} className="text-xp" />+{xpGain}
      &nbsp;XP
    </span>
  )
}

function LienRevoir({ courseSection }: { courseSection: CourseSection }) {
  return (
    <a
      href={`#${courseSection.id}`}
      className="mt-2 inline-flex items-center gap-1.5 font-display text-sm font-bold text-accent-ink hover:underline"
    >
      <Icon name="book-open" weight="bold" size={16} aria-hidden="true" />
      Revoir : {courseSection.title}
    </a>
  )
}

function ResultPanel({
  result,
  exerciseType,
  staticExplanation,
  courseSection,
  xpGain,
  onReset,
}: ResultPanelProps) {
  const { isCorrect, explanation, nudge } = retour(
    result,
    exerciseType,
    staticExplanation,
    courseSection
  )
  const c = RESULT_CONFIG[isCorrect ? 'success' : 'failure']

  return (
    <div className={`mt-4 rounded-lg border ${c.surface} p-4`} role="status">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${c.iconBg}`}
          aria-hidden="true"
        >
          <Icon name={c.icon} weight="bold" size={18} className="text-surface-page" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-display text-lg font-extrabold ${c.title}`}>{c.heading}</p>
            {isCorrect && <GainXp xpGain={xpGain} />}
          </div>
          {explanation && (
            <p className="mt-1 font-prose text-sm leading-relaxed text-ink">{explanation}</p>
          )}
          {nudge && <p className="mt-1 font-prose text-sm leading-relaxed text-ink">{nudge}</p>}
          {!isCorrect && courseSection && <LienRevoir courseSection={courseSection} />}
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={onReset}>
              Réessayer
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

type FeuilleResultatProps = Omit<ResultPanelProps, 'onReset'> & {
  onContinuer: () => void
  onReessayer: () => void
}

/**
 * Interactive mode: the result rises from the bottom of the slide, over its bar (#246). It is not
 * modal: the question stays readable above it. A correct answer focuses « Continuer », a wrong one
 * « Réessayer », so Entrée does the expected next thing; moving on stays possible either way.
 */
function FeuilleResultat({
  result,
  exerciseType,
  staticExplanation,
  courseSection,
  xpGain,
  onContinuer,
  onReessayer,
}: FeuilleResultatProps) {
  const { isCorrect, explanation, nudge } = retour(
    result,
    exerciseType,
    staticExplanation,
    courseSection
  )
  const variant = isCorrect ? 'success' : 'failure'
  const texte = resultSheetText(variant)
  const principal = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    principal.current?.focus({ preventScroll: true })
  }, [])

  return (
    <ResultSheetSurface
      variant={variant}
      role="status"
      data-feuille-resultat={variant}
      className="absolute inset-x-0 bottom-0 animate-[slideUp_var(--duration-sheet)_var(--ease-in)]"
      heading={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-display text-xl font-extrabold ${texte.title}`}>
              {RESULT_CONFIG[variant].heading}
            </p>
            {isCorrect && <GainXp xpGain={xpGain} />}
          </div>
          {(explanation ?? nudge) && (
            <p className="font-prose text-sm leading-relaxed text-ink">{explanation ?? nudge}</p>
          )}
          {!isCorrect && courseSection && <LienRevoir courseSection={courseSection} />}
        </>
      }
    >
      {isCorrect ? (
        <Button ref={principal} size="lg" onClick={onContinuer} className="w-full">
          Continuer
        </Button>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button ref={principal} size="lg" onClick={onReessayer} className="w-full sm:flex-1">
            Réessayer
          </Button>
          <Button variant="secondary" size="lg" onClick={onContinuer} className="w-full sm:flex-1">
            Continuer
          </Button>
        </div>
      )}
    </ResultSheetSurface>
  )
}
