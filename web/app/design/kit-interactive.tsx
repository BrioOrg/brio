'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { OptionRow, type OptionState } from '@/components/ui/option-row'
import { ResultSheet } from '@/components/ui/result-sheet'

/* ── Option row interactive demo ──────────────────────────────────────────── */

export function OptionRowDemo() {
  const [state, setState] = useState<OptionState>('idle')

  return (
    <div className="flex flex-col gap-3">
      <OptionRow
        label="La somme des angles d'un triangle est égale à 180°."
        marker="A"
        state={state}
        onClick={() => setState('selected')}
      />
      <div className="flex flex-wrap gap-2">
        {(['idle', 'selected', 'correct', 'wrong', 'muted'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={[
              'rounded-md border px-3 py-1 font-prose text-xs font-semibold transition-colors',
              state === s
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-surface-raised text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Button loading demo ──────────────────────────────────────────────────── */

export function ButtonLoadingDemo() {
  const [loading, setLoading] = useState(false)

  function trigger() {
    setLoading(true)
    setTimeout(() => setLoading(false), 2000)
  }

  return (
    <Button onClick={trigger} loading={loading} size="lg" className="w-48">
      {loading ? 'Chargement…' : 'Valider'}
    </Button>
  )
}

/* ── Result sheet demo ────────────────────────────────────────────────────── */

export function ResultSheetDemo() {
  const [open, setOpen] = useState(false)
  const [variant, setVariant] = useState<'success' | 'failure'>('success')

  function trigger(v: 'success' | 'failure') {
    setVariant(v)
    setOpen(true)
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => trigger('success')} size="md">
        Bonne réponse
      </Button>
      <Button variant="secondary" onClick={() => trigger('failure')} size="md">
        Mauvaise réponse
      </Button>

      <ResultSheet
        open={open}
        onClose={() => setOpen(false)}
        variant={variant}
        title={variant === 'success' ? 'Bien vu !' : 'Pas tout à fait…'}
        subtitle={
          variant === 'success'
            ? 'Tu gères ! La réponse est correcte.'
            : 'On regarde ensemble. Relis la définition du cours.'
        }
        xpEarned={variant === 'success' ? 20 : undefined}
      />
    </div>
  )
}
