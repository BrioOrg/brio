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

// The button is the arcade key's frame: it holds the focus ring and the layout classes a caller
// passes. Inside it, two layers (MOTION.md budget rule 2): the edge stays put, the face drops onto
// it when pressed. Only the face's transform moves; the edge is never animated.
const BASE =
  'group/bouton relative inline-flex rounded-lg cursor-pointer select-none border-none bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:cursor-not-allowed'

// The interactive mode has its own press duration, so it can be retuned without the reading mode.
const FACE =
  'relative flex w-full items-center justify-center gap-2 rounded-lg font-display font-extrabold transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] group-active/bouton:translate-y-[var(--depth-arcade)] group-data-[chapitre-mode=interactif]/mode:duration-[var(--duration-press)]'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-surface-page group-disabled/bouton:bg-surface-raised group-disabled/bouton:text-ink-muted',
  secondary:
    'text-accent-ink border-2 border-line group-hover/bouton:border-accent group-disabled/bouton:text-ink-muted group-disabled/bouton:border-line',
  ghost:
    'text-ink-muted group-hover/bouton:text-ink group-hover/bouton:bg-surface-raised group-disabled/bouton:text-ink-muted group-disabled/bouton:bg-transparent',
  destructive:
    'text-danger border-2 border-danger group-hover/bouton:bg-surface-raised group-disabled/bouton:text-ink-muted group-disabled/bouton:border-line',
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
      className={[BASE, className].join(' ')}
      {...rest}
    >
      {/* Only an enabled primary button stands on an edge. */}
      {variant === 'primary' && !isDisabled && (
        <span
          data-bouton-bord
          aria-hidden="true"
          className="absolute inset-0 translate-y-[var(--depth-arcade)] rounded-lg bg-accent-edge"
        />
      )}
      <span data-bouton-face className={[FACE, VARIANTS[variant], SIZES[size]].join(' ')}>
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <Icon
              name="circle-notch"
              size={size === 'sm' ? 16 : size === 'md' ? 20 : 24}
              className="animate-spin motion-reduce:animate-none motion-reduce:opacity-60"
            />
          </span>
        )}
        {/* Keep label in DOM for screen readers even while loading. The wrapper lays out
          label and icon itself: the button's own gap does not reach its children. */}
        <span
          className={['inline-flex items-center justify-center gap-2', loading ? 'invisible' : '']
            .join(' ')
            .trim()}
        >
          {children}
        </span>
      </span>
    </button>
  )
})
