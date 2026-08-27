import { forwardRef, useId } from 'react'

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, error, id: idProp, className = '', ...rest },
  ref
) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const errorId = `${id}-error`

  return (
    <div className={['flex flex-col gap-1.5', className].join(' ')}>
      <label htmlFor={id} className="font-prose text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={[
          'rounded-md border-2 bg-surface-raised px-4 py-3 font-prose text-base text-ink placeholder:text-ink-muted',
          'transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'focus:outline-none focus:border-accent focus:[box-shadow:0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)]',
          error
            ? 'border-feedback-incorrect focus:border-feedback-incorrect focus:[box-shadow:0_0_0_3px_color-mix(in_oklab,var(--color-feedback-incorrect)_25%,transparent)]'
            : 'border-line',
        ].join(' ')}
        {...rest}
      />
      {error && (
        <p id={errorId} role="alert" className="font-prose text-sm text-feedback-incorrect">
          {error}
        </p>
      )}
    </div>
  )
})
