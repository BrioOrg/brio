'use client'

import { forwardRef } from 'react'
import { Icon } from './icon'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const BASE =
  'relative inline-flex items-center justify-center gap-2 font-display font-extrabold rounded-lg cursor-pointer select-none border-none transition-[transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:cursor-not-allowed active:[transform:translateY(var(--depth-arcade))]'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-surface-page [box-shadow:var(--shadow-arcade)] active:[box-shadow:none] disabled:bg-surface-raised disabled:text-ink-muted disabled:[box-shadow:none]',
  secondary:
    'bg-transparent text-accent-ink border-2 border-line [box-shadow:none] hover:border-accent disabled:text-ink-muted disabled:border-line',
  ghost:
    'bg-transparent text-ink-muted [box-shadow:none] hover:text-ink hover:bg-surface-raised disabled:text-ink-muted',
  destructive:
    'bg-transparent text-danger border-2 border-danger [box-shadow:none] hover:bg-surface-raised disabled:text-ink-muted disabled:border-line',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'text-sm px-4 py-2',
  md: 'text-base px-5 py-3',
  lg: 'text-lg px-6 py-4',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    children,
    className = '',
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      className={[BASE, VARIANTS[variant], SIZES[size], className].join(' ')}
      {...rest}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <Icon
            name="circle-notch"
            size={size === 'sm' ? 16 : size === 'md' ? 20 : 24}
            className="animate-spin motion-reduce:animate-none motion-reduce:opacity-60"
          />
        </span>
      )}
      {/* Keep label in DOM for screen readers even while loading */}
      <span className={loading ? 'invisible' : undefined}>{children}</span>
    </button>
  )
})
