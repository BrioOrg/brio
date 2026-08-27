import { Icon } from './icon'

type ChipVariant = 'citation' | 'level' | 'status'

type ChipProps = {
  variant?: ChipVariant
  children: React.ReactNode
  icon?: string
  className?: string
}

const VARIANTS: Record<ChipVariant, string> = {
  citation: 'bg-info/10 border border-info/30 text-info',
  level: 'bg-accent-soft border border-line text-accent-ink',
  status: 'bg-surface-raised border border-line text-ink-muted',
}

export function Chip({ variant = 'status', icon, children, className = '' }: ChipProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 font-display text-xs font-extrabold',
        VARIANTS[variant],
        className,
      ].join(' ')}
    >
      {icon && <Icon name={icon} size={12} aria-hidden="true" />}
      {children}
    </span>
  )
}
