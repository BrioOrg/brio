import { Icon } from '../icon'

type CitationChipProps = {
  children: React.ReactNode
  onClick?: () => void
}

export function CitationChip({ children, onClick }: CitationChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-1.5 rounded-pill border border-line bg-accent-soft px-3 py-1.5 font-display text-xs font-extrabold text-accent-ink transition-colors duration-[var(--duration-fast)] hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
    >
      <Icon name="book-open" size={12} aria-hidden="true" />
      {children}
    </button>
  )
}
