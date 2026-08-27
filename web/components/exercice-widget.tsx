'use client'

import { useState } from 'react'
import { soumettre, type SoumissionResult } from '@/lib/api'
import { OptionRow, type OptionState } from '@/components/ui/option-row'
import { TextInput } from '@/components/ui/text-input'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'

type Choice = { id: string; text: string }

type ExerciceWidgetProps = {
  exerciceId: string
  exerciseType: string
  prompt: string
  choices?: Choice[]
  multiple?: boolean
  unit?: string
  explanation?: string
  placeholder?: string
}

const MARKERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function ExerciceWidget({
  exerciceId,
  exerciseType,
  prompt,
  choices,
  multiple,
  unit,
  explanation,
  placeholder,
}: ExerciceWidgetProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [numericValue, setNumericValue] = useState('')
  const [shortAnswerText, setShortAnswerText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SoumissionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  function toggleChoice(id: string) {
    if (multiple) {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    } else {
      setSelectedIds([id])
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
    }

    const answer: Record<string, unknown> =
      exerciseType === 'multiple-choice'
        ? { choiceIds: selectedIds }
        : exerciseType === 'short-answer'
          ? { text: shortAnswerText }
          : { value: Number(numericValue) }

    setLoading(true)
    try {
      const res = await soumettre(exerciceId, answer)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau. Réessaie plus tard.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setResult(null)
    setSelectedIds([])
    setNumericValue('')
    setShortAnswerText('')
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
    loading || (exerciseType === 'short-answer' && shortAnswerText.trim() === '')

  return (
    <div className="rounded-lg border border-line bg-surface-panel p-5">
      <p className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
        Exercice
      </p>
      <p className="mb-4 font-prose text-base leading-relaxed text-ink">{prompt}</p>

      <form onSubmit={handleSubmit} noValidate>
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
                setShortAnswerText(e.target.value)
                setValidationError(null)
              }}
              placeholder={placeholder ?? 'Ta réponse'}
            />
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

        {!result && (
          <Button type="submit" loading={loading} disabled={submitDisabled} className="w-full sm:w-auto">
            Vérifier
          </Button>
        )}
      </form>

      {result && (
        <ResultPanel
          result={result}
          exerciseType={exerciseType}
          staticExplanation={explanation}
          onReset={reset}
        />
      )}
    </div>
  )
}

type ResultPanelProps = {
  result: SoumissionResult
  exerciseType: string
  staticExplanation?: string
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

function ResultPanel({ result, exerciseType, staticExplanation, onReset }: ResultPanelProps) {
  const isCorrect = result.correct === true
  const c = RESULT_CONFIG[isCorrect ? 'success' : 'failure']

  // A wrong answer opens an explanation, never the expected answer (T0).
  // We surface the author's pedagogical explanation when present; otherwise a
  // non-punitive nudge — we never echo `expectedValue` or accepted answers.
  const explanation = result.explanation ?? staticExplanation
  const fallback =
    !isCorrect && !explanation
      ? exerciseType === 'short-answer'
        ? 'On regarde ensemble : relis la section précédente.'
        : 'On regarde ensemble : reprends le raisonnement pas à pas.'
      : null

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
          <p className={`font-display text-lg font-extrabold ${c.title}`}>{c.heading}</p>
          {explanation && (
            <p className="mt-1 font-prose text-sm leading-relaxed text-ink">{explanation}</p>
          )}
          {fallback && <p className="mt-1 font-prose text-sm leading-relaxed text-ink">{fallback}</p>}
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
