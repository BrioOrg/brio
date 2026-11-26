'use client'

import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  PROBABILITY_EXPERIMENT_IDS,
  PROBABILITY_EXPERIMENTS,
  simulateExperiment,
  type ProbabilityExperiment,
} from '@/lib/probability-simulator'

const BATCH_SIZES = [10, 100, 1000]
const numberFormat = new Intl.NumberFormat('fr-FR')
const percentFormat = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  maximumFractionDigits: 2,
})

export function ProbabilitySimulator({
  initialExperiment = 'die',
}: {
  initialExperiment?: ProbabilityExperiment
}) {
  return <ExperimentPanel key={initialExperiment} initialExperiment={initialExperiment} />
}

function ExperimentPanel({ initialExperiment }: { initialExperiment: ProbabilityExperiment }) {
  const [experiment, setExperiment] = useState(initialExperiment)
  const [counts, setCounts] = useState(() =>
    PROBABILITY_EXPERIMENTS[initialExperiment].outcomes.map(() => 0)
  )
  const descriptionId = useId()
  const { description, outcomes } = PROBABILITY_EXPERIMENTS[experiment]
  const total = counts.reduce((sum, count) => sum + count, 0)
  const totalWeight = outcomes.reduce((sum, { weight }) => sum + weight, 0)

  function selectExperiment(value: string) {
    const next = PROBABILITY_EXPERIMENT_IDS.find((id) => id === value)
    if (!next || next === experiment) return
    setExperiment(next)
    setCounts(PROBABILITY_EXPERIMENTS[next].outcomes.map(() => 0))
  }

  function runBatch(size: number) {
    const batch = simulateExperiment(experiment, size)
    setCounts((previous) => previous.map((count, index) => count + batch[index]))
  }

  return (
    <div className="space-y-4 rounded-lg border border-line bg-surface-panel p-3 sm:p-5">
      <div className="space-y-2">
        <label className="flex flex-col gap-1 font-display text-sm font-bold">
          Expérience
          <select
            aria-describedby={descriptionId}
            className="min-h-11 w-full rounded-md border border-line bg-surface-page px-3 font-prose text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-fit"
            value={experiment}
            onChange={(event) => selectExperiment(event.target.value)}
          >
            {PROBABILITY_EXPERIMENT_IDS.map((id) => (
              <option key={id} value={id}>
                {PROBABILITY_EXPERIMENTS[id].label}
              </option>
            ))}
          </select>
        </label>
        <p id={descriptionId} className="text-sm text-ink-muted">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {BATCH_SIZES.map((size) => (
          <Button
            key={size}
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => runBatch(size)}
          >
            Lancer {numberFormat.format(size)} essais
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={total === 0}
          onClick={() => setCounts(outcomes.map(() => 0))}
        >
          Remettre à zéro
        </Button>
      </div>

      <p role="status" className="font-display text-lg font-extrabold text-ink">
        {numberFormat.format(total)} essais
      </p>
      <table className="w-full table-fixed text-left text-xs tabular-nums sm:text-sm">
        <caption className="sr-only">Résultats</caption>
        <thead className="border-b border-line text-ink-muted">
          <tr>
            <th scope="col" className="px-1 py-2 align-bottom sm:px-3">
              Issue
            </th>
            <th scope="col" className="px-1 py-2 align-bottom sm:px-3">
              Effectif
            </th>
            <th scope="col" className="break-words px-1 py-2 align-bottom sm:px-3">
              Fréquence observée
            </th>
            <th scope="col" className="break-words px-1 py-2 align-bottom sm:px-3">
              Probabilité théorique
            </th>
          </tr>
        </thead>
        <tbody>
          {outcomes.map(({ label, weight }, index) => {
            const observed = total === 0 ? null : counts[index] / total
            return (
              <tr key={label} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-1 py-2 sm:px-3">
                  {label}
                </th>
                <td className="px-1 py-2 sm:px-3">{numberFormat.format(counts[index])}</td>
                <td className="px-1 py-2 sm:px-3">
                  {observed === null ? '—' : percentFormat.format(observed)}
                  {observed !== null && <FrequencyBar value={observed} />}
                </td>
                <td className="px-1 py-2 sm:px-3">
                  {percentFormat.format(weight / totalWeight)}
                  <FrequencyBar value={weight / totalWeight} theoretical />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FrequencyBar({ value, theoretical = false }: { value: number; theoretical?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-raised"
    >
      <span
        className={theoretical ? 'block h-full bg-ink-muted' : 'block h-full bg-accent'}
        style={{ width: `${value * 100}%` }}
      />
    </span>
  )
}
