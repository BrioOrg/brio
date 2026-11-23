'use client'

import { useState } from 'react'

import { formaterDecimal, latexRationnel, type Rationnel } from '@brio/content'

import { renderKatex } from '@/lib/katex'

// The result of a calculation line (spec U4 §3.4): `= 5/6` as a real fraction when the engine
// knows the exact value, `≈ 0,83` in decimal writing, and a button that switches between them.
// The decimal value is never shown with a floating-point tail or an exponent.

const MOINS = '−'

/** "1234567" → "1\,234\,567" for KaTeX: thin spaces between groups of three digits. */
function grouperLatex(latex: string): string {
  return latex.replace(/\d{5,}/g, (n) => n.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,'))
}

/** "5 sur 6", "moins 5 sur 6", "12": what a screen reader says of a fraction. */
function lectureFraction(r: Rationnel): string {
  const signe = r.num < 0n ? 'moins ' : ''
  const num = (r.num < 0n ? -r.num : r.num).toString()
  return r.den === 1n ? `${signe}${num}` : `${signe}${num} sur ${r.den.toString()}`
}

export function Resultat({ valeur, exact }: { valeur: number; exact: Rationnel | null }) {
  const [enDecimal, setEnDecimal] = useState(false)
  // A whole number is the same in both writings: no switch.
  const fraction = exact !== null && exact.den !== 1n
  const decimal = formaterDecimal(valeur)

  let visuel: React.ReactNode
  let lecture: string
  if (exact !== null && (exact.den === 1n || (fraction && !enDecimal))) {
    visuel = (
      <span
        className="text-lg text-ink"
        dangerouslySetInnerHTML={{
          __html: renderKatex(`= ${grouperLatex(latexRationnel(exact))}`, false),
        }}
      />
    )
    lecture = `Résultat : ${lectureFraction(exact)}`
  } else if (decimal) {
    const signe = decimal.approche ? '≈' : '='
    visuel = (
      <span className="font-prose text-lg tabular-nums text-ink">
        {signe}
        {' '}
        {decimal.texte}
      </span>
    )
    const texte = decimal.texte.replace(MOINS, 'moins ')
    lecture = `Résultat : ${decimal.approche ? 'environ ' : ''}${texte}`
  } else {
    return null
  }

  return (
    <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-2">
      <span aria-hidden="true" className="min-w-0 break-all">
        {visuel}
      </span>
      <span className="sr-only">{lecture}</span>
      {fraction && (
        <button
          type="button"
          onClick={() => setEnDecimal((d) => !d)}
          aria-label={
            enDecimal
              ? 'Afficher le résultat en fraction'
              : 'Afficher le résultat en écriture décimale'
          }
          className="min-h-11 cursor-pointer rounded-pill border border-line px-3 font-display text-xs font-extrabold text-ink-muted transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel"
        >
          {enDecimal ? 'Fraction' : 'Décimal'}
        </button>
      )}
    </span>
  )
}
