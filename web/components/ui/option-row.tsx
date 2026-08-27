'use client'

import { Icon } from './icon'

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted'

type OptionRowProps = {
  label: string
  marker: string
  state?: OptionState
  onClick?: () => void
}

const ROW: Record<OptionState, string> = {
  idle: 'border-line bg-surface-raised hover:-translate-y-px hover:[box-shadow:0_4px_0_var(--color-line)] cursor-pointer',
  selected:
    'border-accent bg-accent-soft [box-shadow:0_3px_0_var(--color-accent-edge)] cursor-pointer',
  correct: 'border-accent bg-surface-result-correct [box-shadow:0_3px_0_var(--color-accent-edge)]',
  wrong:
    'border-feedback-incorrect bg-surface-result-incorrect [box-shadow:0_3px_0_var(--color-feedback-incorrect-edge)]',
  muted: 'border-line bg-surface-raised opacity-50',
}

const HEX: Record<OptionState, string> = {
  idle: 'bg-surface-panel text-ink-muted',
  selected: 'bg-accent text-surface-page',
  correct: 'bg-accent text-surface-page',
  wrong: 'bg-feedback-incorrect text-surface-page',
  muted: 'bg-surface-panel text-ink-muted',
}

const hexClip = {
  clipPath: 'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%)',
}

function TrailingIcon({ state }: { state: OptionState }) {
  if (state === 'correct')
    return <Icon name="check" weight="bold" size={18} className="text-accent shrink-0" />
  if (state === 'wrong')
    return <Icon name="x" weight="bold" size={18} className="text-feedback-incorrect shrink-0" />
  if (state === 'selected') return <Icon name="check" size={18} className="text-accent shrink-0" />
  return null
}

export function OptionRow({ label, marker, state = 'idle', onClick }: OptionRowProps) {
  const interactive = state === 'idle' || state === 'selected'

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      aria-pressed={state === 'selected' ? true : undefined}
      aria-label={`Option ${marker}: ${label}${state !== 'idle' ? `, ${state}` : ''}`}
      className={[
        'flex w-full items-center gap-3 rounded-md border-2 p-4 text-left font-prose text-base text-ink transition-[transform,box-shadow,border-color,background-color] duration-[var(--duration-base)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:cursor-default',
        ROW[state],
      ].join(' ')}
    >
      {/* Hexagonal marker */}
      <span
        className={[
          'flex h-7 w-7 shrink-0 items-center justify-center font-display text-sm font-extrabold',
          HEX[state],
        ].join(' ')}
        style={hexClip}
        aria-hidden="true"
      >
        {marker}
      </span>

      <span className="flex-1 font-semibold">{label}</span>

      <TrailingIcon state={state} />
    </button>
  )
}
