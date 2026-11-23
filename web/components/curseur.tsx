'use client'

import { forwardRef, useId } from 'react'

import { formatNumber } from '@brio/content'

type CurseurProps = {
  /** The letter, written in italics as on the board. */
  nom: string
  min: number
  max: number
  pas: number
  valeur: number
  onChange: (valeur: number) => void
  /** The slider's accessible name: "Paramètre a" in a course figure, "Curseur a" in the calculator. */
  label: string
  onFocus?: () => void
  onKeyDown?: () => void
  onPointerDown?: () => void
  /** How the value and the bounds are written; the course figures keep `formatNumber`. */
  formater?: (v: number) => string
  /** Extra classes of the range input (the calculator gives it a 44 px target). */
  classeRange?: string
}

/**
 * A slider for one letter (ADR 0038 §6, ADR 0049 §3): `a = 2` on its left, the range and its two
 * bounds on its right. The slider carries the same `a = 2` for screen readers. Shared by the
 * course figures and the graphing calculator.
 */
export const Curseur = forwardRef<HTMLInputElement, CurseurProps>(function Curseur(
  {
    nom,
    min,
    max,
    pas,
    valeur,
    onChange,
    label,
    onFocus,
    onKeyDown,
    onPointerDown,
    formater = formatNumber,
    classeRange,
  },
  ref
) {
  const id = useId()
  const texte = `${nom} = ${formater(valeur)}`
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 font-prose text-sm text-ink">
      {/* The value, written as on the board; the slider carries the same text for screen readers. */}
      <output htmlFor={id} aria-hidden="true" className="min-w-[6ch] tabular-nums">
        <i>{nom}</i> = {formater(valeur)}
      </output>
      <div className="flex flex-col">
        <input
          ref={ref}
          id={id}
          type="range"
          min={min}
          max={max}
          step={pas}
          value={valeur}
          aria-label={label}
          aria-valuetext={texte}
          onChange={(e) => onChange(Number(e.target.value))}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          className={['w-full cursor-pointer accent-accent', classeRange].filter(Boolean).join(' ')}
        />
        <div
          aria-hidden="true"
          className="flex justify-between text-xs tabular-nums text-ink-muted"
        >
          <span>{formater(min)}</span>
          <span>{formater(max)}</span>
        </div>
      </div>
    </div>
  )
})
