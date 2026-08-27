import { Icon } from '../icon'

type SuggestedQuestionProps = {
  children: React.ReactNode
  onClick?: () => void
}

export function SuggestedQuestion({ children, onClick }: SuggestedQuestionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface-raised px-4 py-3 text-left font-prose text-sm font-semibold text-ink transition-[border-color,background-color] duration-[var(--duration-fast)] hover:border-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
    >
      <Icon name="caret-right" size={16} className="shrink-0 text-accent-ink" aria-hidden="true" />
      <span className="flex-1">{children}</span>
    </button>
  )
}
