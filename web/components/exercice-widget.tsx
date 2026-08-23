'use client'

import { useState } from 'react'
import { soumettre, type SoumissionResult } from '@/lib/api'

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

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Exercice</p>
      <p className="text-gray-800 mb-4">{prompt}</p>

      {result ? (
        <ResultPanel
          result={result}
          choices={choices}
          exerciseType={exerciseType}
          unit={unit}
          staticExplanation={explanation}
          onReset={() => {
            setResult(null)
            setSelectedIds([])
            setNumericValue('')
            setShortAnswerText('')
          }}
        />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {exerciseType === 'multiple-choice' && choices && (
            <fieldset className="mb-4">
              <legend className="sr-only">Choix de réponse</legend>
              <div className="space-y-2">
                {choices.map((choice) => {
                  const inputType = multiple ? 'checkbox' : 'radio'
                  const inputId = `choice-${choice.id}`
                  return (
                    <label
                      key={choice.id}
                      htmlFor={inputId}
                      className="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                    >
                      <input
                        type={inputType}
                        id={inputId}
                        name="choice"
                        value={choice.id}
                        checked={selectedIds.includes(choice.id)}
                        onChange={() => toggleChoice(choice.id)}
                        className="accent-blue-600"
                      />
                      <span className="text-gray-800">{choice.text}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}

          {exerciseType === 'numeric' && (
            <div className="mb-4 flex items-center gap-2">
              <label htmlFor="numeric-answer" className="sr-only">
                Réponse numérique
              </label>
              <input
                id="numeric-answer"
                type="number"
                step="any"
                value={numericValue}
                onChange={(e) => {
                  setNumericValue(e.target.value)
                  setValidationError(null)
                }}
                placeholder="Ta réponse"
                className="w-40 rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {unit && <span className="text-gray-600 text-sm">{unit}</span>}
            </div>
          )}

          {exerciseType === 'short-answer' && (
            <div className="mb-4">
              <label htmlFor="short-answer-input" className="sr-only">
                Réponse
              </label>
              <input
                id="short-answer-input"
                type="text"
                value={shortAnswerText}
                onChange={(e) => {
                  setShortAnswerText(e.target.value)
                  setValidationError(null)
                }}
                placeholder={placeholder ?? 'Ta réponse'}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {validationError && (
            <p role="alert" className="mb-3 text-sm text-red-600">
              {validationError}
            </p>
          )}

          {error && (
            <p role="alert" className="mb-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || (exerciseType === 'short-answer' && shortAnswerText.trim() === '')}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Correction…' : 'Vérifier'}
          </button>
        </form>
      )}
    </div>
  )
}

type ResultPanelProps = {
  result: SoumissionResult
  choices?: Choice[]
  exerciseType: string
  unit?: string
  staticExplanation?: string
  onReset: () => void
}

function ResultPanel({
  result,
  choices,
  exerciseType,
  unit,
  staticExplanation,
  onReset,
}: ResultPanelProps) {
  const isCorrect = result.correct
  const borderColor = isCorrect ? 'border-green-300 bg-green-50' : 'border-red-200 bg-red-50'
  const labelColor = isCorrect ? 'text-green-800' : 'text-red-800'

  return (
    <div className={`rounded-md border p-4 ${borderColor}`} role="status">
      <p className={`font-semibold ${labelColor}`}>{isCorrect ? '✓ Correct !' : '✗ Incorrect'}</p>

      {exerciseType === 'numeric' && !isCorrect && result.expectedValue !== null && (
        <p className="mt-1 text-sm text-gray-700">
          La bonne réponse était{' '}
          <strong>
            {result.expectedValue}
            {unit ? ` ${unit}` : ''}
          </strong>
          .
        </p>
      )}

      {exerciseType === 'multiple-choice' && result.choiceFeedback.length > 0 && choices && (
        <ul className="mt-2 space-y-1 text-sm">
          {result.choiceFeedback.map((fb) => {
            const choice = choices.find((c) => c.id === fb.choiceId)
            return (
              <li key={fb.choiceId} className={fb.correct ? 'text-green-700' : 'text-red-700'}>
                {fb.correct ? '✓' : '✗'} {choice?.text ?? fb.choiceId}
              </li>
            )
          })}
        </ul>
      )}

      {exerciseType === 'short-answer' &&
        !isCorrect &&
        !(result.explanation ?? staticExplanation) && (
          <p className="mt-2 text-sm text-gray-700">
            Ce n&apos;est pas la réponse attendue. Relis la section précédente.
          </p>
        )}

      {(result.explanation ?? staticExplanation) && (
        <p className="mt-2 text-sm text-gray-700">{result.explanation ?? staticExplanation}</p>
      )}

      <button
        onClick={onReset}
        className="mt-3 text-sm text-blue-600 underline hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      >
        Réessayer
      </button>
    </div>
  )
}
