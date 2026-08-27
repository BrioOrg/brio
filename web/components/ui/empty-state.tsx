import { Icon } from './icon'

type EmptyStateProps = {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={['flex flex-col items-center gap-4 py-12 text-center', className].join(' ')}>
      {icon && (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised text-ink-muted">
          <Icon name={icon} size={32} />
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="font-display text-lg font-extrabold text-ink">{title}</p>
        {description && <p className="font-prose text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
