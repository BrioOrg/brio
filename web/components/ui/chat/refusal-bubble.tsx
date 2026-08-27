import { Icon } from '../icon'

type RefusalVariant = 'policy' | 'socratic'

type RefusalBubbleProps = {
  variant?: RefusalVariant
  children: React.ReactNode
}

const CONFIG = {
  policy: {
    border: 'border-info/40',
    bg: 'bg-info/10',
    label: 'Hors sujet',
    labelColor: 'text-info',
    icon: 'info',
  },
  socratic: {
    border: 'border-feedback-incorrect/40',
    bg: 'bg-surface-result-incorrect',
    label: 'Aide sans réponse',
    labelColor: 'text-feedback-incorrect',
    icon: 'sparkle',
  },
} as const

export function RefusalBubble({ variant = 'policy', children }: RefusalBubbleProps) {
  const c = CONFIG[variant]

  return (
    <div className="flex justify-start">
      <div
        className={[
          'max-w-[88%] rounded-[1rem_1rem_1rem_0.3125rem] border px-3.5 py-2.5',
          c.border,
          c.bg,
        ].join(' ')}
      >
        <p
          className={[
            'mb-1.5 flex items-center gap-1.5 font-display text-xs font-extrabold uppercase tracking-wide',
            c.labelColor,
          ].join(' ')}
        >
          <Icon name={c.icon} size={12} aria-hidden="true" />
          {c.label}
        </p>
        <p className="font-prose text-sm leading-relaxed text-ink">{children}</p>
      </div>
    </div>
  )
}
