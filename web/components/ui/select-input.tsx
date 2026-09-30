import { forwardRef, useId } from 'react'

type SelectInputProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
}

// The native select, dressed like TextInput: same label, border and focus ring.
export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  { label, id: idProp, className = '', children, ...rest },
  ref
) {
  const generatedId = useId()
  const id = idProp ?? generatedId

  return (
    <div className={['flex flex-col gap-1.5', className].join(' ')}>
      <label htmlFor={id} className="font-prose text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        ref={ref}
        id={id}
        className={[
          'rounded-md border-2 border-line bg-surface-raised px-4 py-3 font-prose text-base text-ink',
          'transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'focus:outline-none focus:border-accent focus:[box-shadow:0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)]',
          'disabled:cursor-not-allowed disabled:text-ink-muted',
        ].join(' ')}
        {...rest}
      >
        {children}
      </select>
    </div>
  )
})
