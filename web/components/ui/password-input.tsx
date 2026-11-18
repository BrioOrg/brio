'use client'

import { forwardRef, useId, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { TextInput, type TextInputProps } from '@/components/ui/text-input'

type PasswordInputProps = Omit<TextInputProps, 'type' | 'suffixe'> & {
  /**
   * The show button's accessible name. Fixed: it does not flip to « Masquer » — `aria-pressed`
   * says whether the password is shown. Name the field when a form has two of them.
   */
  libelleAfficher?: string
}

/**
 * A password field with a button that shows what was typed (#364): a child typing a long
 * password on a phone can check it before sending. A toggle button (`aria-pressed`), at least
 * 24 px (WCAG 2.5.8), that never submits the form.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { libelleAfficher = 'Afficher le mot de passe', id: idProp, ...rest },
    ref
  ) {
    const generatedId = useId()
    const id = idProp ?? generatedId
    const [visible, setVisible] = useState(false)

    return (
      <TextInput
        {...rest}
        ref={ref}
        id={id}
        type={visible ? 'text' : 'password'}
        // Shown, the field is plain text: a phone keyboard would capitalise or "correct" the
        // password the child is choosing, and the browser could send it to a spell-checking
        // service. Never overridable by a caller.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        suffixe={
          <button
            type="button"
            aria-label={libelleAfficher}
            aria-pressed={visible}
            aria-controls={id}
            onClick={() => setVisible((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-sm text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon name={visible ? 'eye-slash' : 'eye'} size={20} />
          </button>
        }
      />
    )
  }
)
