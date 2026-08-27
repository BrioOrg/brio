type ProgressBarProps = {
  value: number
  max: number
  showCounter?: boolean
  className?: string
}

export function ProgressBar({ value, max, showCounter = true, className = '' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0

  return (
    <div className={['flex items-center gap-3', className].join(' ')}>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`Progression : ${value} sur ${max}`}
        className="relative h-3.5 flex-1 overflow-hidden rounded-pill bg-surface-raised"
      >
        <div
          className="h-full rounded-pill transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out)]"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-hi))',
            boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.15)',
          }}
        />
      </div>
      {showCounter && (
        <span
          className="shrink-0 font-display text-sm font-extrabold text-ink-muted"
          aria-hidden="true"
        >
          {value}/{max}
        </span>
      )}
    </div>
  )
}
