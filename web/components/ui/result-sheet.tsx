'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Icon } from './icon'
import { Button } from './button'

type ResultSheetVariant = 'success' | 'failure'

type ResultSheetProps = {
  open: boolean
  onClose: () => void
  variant: ResultSheetVariant
  title: string
  subtitle?: string
  continueLabel?: string
  xpEarned?: number
}

const CONFIG = {
  success: {
    surface: 'bg-surface-result-correct',
    icon: 'check',
    iconBg: 'bg-accent',
    iconColor: 'text-surface-page',
    title: 'text-accent-edge',
    subtitle: 'text-accent-edge',
    xpColor: 'text-accent-edge',
    xpBg: 'bg-accent/20',
    shadowColor: 'var(--color-accent-edge)',
  },
  failure: {
    surface: 'bg-surface-result-incorrect',
    icon: 'x',
    iconBg: 'bg-feedback-incorrect',
    iconColor: 'text-surface-page',
    title: 'text-feedback-incorrect-edge',
    subtitle: 'text-feedback-incorrect-edge',
    xpColor: 'text-feedback-incorrect-edge',
    xpBg: 'bg-feedback-incorrect/20',
    shadowColor: 'var(--color-feedback-incorrect-edge)',
  },
} as const

export function ResultSheet({
  open,
  onClose,
  variant,
  title,
  subtitle,
  continueLabel = 'Continuer',
  xpEarned,
}: ResultSheetProps) {
  const c = CONFIG[variant]

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-[fadeIn_var(--duration-slow)_var(--ease-out)]" />
        <Dialog.Content
          aria-label={title}
          className={[
            'fixed bottom-0 left-0 right-0 z-50 rounded-t-xl px-5 pb-8 pt-5',
            c.surface,
            'data-[state=open]:animate-[slideUp_var(--duration-slow)_var(--ease-out)]',
            'focus-visible:outline-none',
          ].join(' ')}
        >
          <div className="flex flex-col gap-4">
            {/* Icon + heading row */}
            <div className="flex items-center gap-3">
              <span
                className={[
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
                  c.iconBg,
                ].join(' ')}
                aria-hidden="true"
              >
                <Icon name={c.icon} weight="bold" size={22} className={c.iconColor} />
              </span>
              <div className="flex flex-col gap-0.5">
                <Dialog.Title
                  className={['font-display text-xl font-extrabold', c.title].join(' ')}
                >
                  {title}
                </Dialog.Title>
                {subtitle && (
                  <Dialog.Description className={['font-prose text-sm', c.subtitle].join(' ')}>
                    {subtitle}
                  </Dialog.Description>
                )}
              </div>
            </div>

            {/* Optional XP badge */}
            {xpEarned !== undefined && (
              <span
                className={[
                  'inline-flex w-fit items-center gap-1.5 rounded-pill px-3 py-1 font-display text-sm font-extrabold',
                  c.xpBg,
                  c.xpColor,
                ].join(' ')}
                aria-label={`${xpEarned} XP gagnés`}
              >
                <Icon name="star" weight="bold" size={14} className="text-xp" aria-hidden="true" />+
                {xpEarned} XP
              </span>
            )}

            {/* Continue button */}
            <Button
              variant={variant === 'success' ? 'primary' : 'secondary'}
              size="lg"
              onClick={onClose}
              className="w-full"
              style={
                variant === 'failure'
                  ? {
                      borderColor: `var(--color-feedback-incorrect)`,
                      color: `var(--color-feedback-incorrect)`,
                    }
                  : undefined
              }
            >
              {continueLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
