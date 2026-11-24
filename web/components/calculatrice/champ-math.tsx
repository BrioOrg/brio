'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { latexVersTexte } from '@brio/content'

import { CHAMP, CHAMP_INVALIDE, CHAMP_MATH, CHAMP_MATH_INVALIDE, FOCUS } from './classes'
import { chargerMathLive, type ChampMathLive } from './mathlive'

// The field of a line (#417): a MathLive maths field, edited in typeset form — `/` stacks a
// fraction, `^` raises an exponent, `sqrt` draws a root. Its LaTeX is written back in the engine's
// text (`latexVersTexte`): the state and the address keep the text only. MathLive is loaded in the
// browser, on this route only; until it is (and should it fail), the line is a plain text field.

type Props = {
  texte: string
  /** The engine's LaTeX of the line, when it reads; the field opens on it. */
  latex: string | null
  numero: number
  placeholder: string
  invalide: boolean
  describedBy?: string
  champRef: (el: HTMLElement | null) => void
  onTexte: (texte: string) => void
  onFocus: () => void
  onBlur: () => void
  onEntree: () => void
  onEffacerVide: () => void
}

/** What the field shows for a text: the engine's LaTeX of it, or the text itself. */
function latexDe(texte: string, latex: string | null): string {
  return latex ?? texte
}

export function ChampMath(props: Props) {
  const { texte, latex, numero, placeholder, invalide, describedBy, champRef } = props
  const hoteRef = useRef<HTMLDivElement>(null)
  const champ = useRef<ChampMathLive | null>(null)
  const [pret, setPret] = useState(false)
  // The last text the field itself gave: a change of `texte` from elsewhere (a slider, a new
  // line) is loaded in the field; its own echo is not.
  const emis = useRef(texte)
  const derniers = useRef(props)
  useLayoutEffect(() => {
    derniers.current = props
  })

  useEffect(() => {
    let annule = false
    let mf: ChampMathLive | null = null
    chargerMathLive()
      .then((creer) => {
        const hote = hoteRef.current
        if (annule || !hote) return
        const p = derniers.current
        mf = creer({
          latex: latexDe(p.texte, p.latex),
          className: `${CHAMP_MATH} border-line`,
          surTexte: (l) => {
            const t = latexVersTexte(l)
            emis.current = t
            derniers.current.onTexte(t)
          },
          surFocus: () => derniers.current.onFocus(),
          surBlur: () => derniers.current.onBlur(),
          surEntree: () => derniers.current.onEntree(),
          surEffacerVide: () => derniers.current.onEffacerVide(),
        })
        // The plain field may have had the focus: the maths field takes it over.
        const avaitFocus = hote.parentElement?.contains(document.activeElement) ?? false
        hote.appendChild(mf.element)
        champ.current = mf
        emis.current = p.texte
        setPret(true)
        if (avaitFocus) mf.element.focus()
      })
      .catch(() => undefined)
    return () => {
      annule = true
      mf?.element.remove()
      champ.current = null
    }
  }, [])

  // The attributes that follow the line.
  useEffect(() => {
    const mf = champ.current
    if (!mf) return
    const el = mf.element
    el.setAttribute('aria-label', `Expression ${numero}`)
    if (invalide) el.setAttribute('aria-invalid', 'true')
    else el.removeAttribute('aria-invalid')
    if (describedBy) el.setAttribute('aria-describedby', describedBy)
    else el.removeAttribute('aria-describedby')
    mf.placeholder(placeholder)
    el.className = `${CHAMP_MATH} ${invalide ? CHAMP_MATH_INVALIDE : 'border-line'}`
  }, [pret, numero, invalide, describedBy, placeholder])

  // A text changed from elsewhere, field not being typed in: loaded in the field.
  useEffect(() => {
    const mf = champ.current
    if (!mf || texte === emis.current || mf.aLeFocus()) return
    emis.current = texte
    mf.charger(latexDe(texte, latex))
  }, [texte, latex, pret])

  useEffect(() => {
    if (!pret) return
    champRef(champ.current?.element ?? null)
    return () => champRef(null)
  }, [pret, champRef])

  return (
    <div className="flex min-w-0 items-start gap-1">
      {!pret && (
        <input
          ref={champRef}
          type="text"
          value={texte}
          onChange={(e) => props.onTexte(e.target.value)}
          onFocus={(e) => {
            e.currentTarget.scrollIntoView?.({ block: 'nearest' })
            props.onFocus()
          }}
          onBlur={props.onBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              props.onEntree()
            } else if (e.key === 'Backspace' && texte === '') {
              e.preventDefault()
              props.onEffacerVide()
            }
          }}
          placeholder={placeholder}
          aria-label={`Expression ${numero}`}
          aria-invalid={invalide || undefined}
          aria-describedby={describedBy}
          inputMode="text"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={200}
          className={[
            CHAMP,
            invalide ? CHAMP_INVALIDE : 'border-line',
            'min-h-11 w-full min-w-0 px-3 py-2 font-prose text-base tabular-nums',
          ].join(' ')}
        />
      )}
      <div ref={hoteRef} className={pret ? 'min-w-0 flex-1' : 'hidden'} />
      {pret && (
        // The virtual keyboard: its own toggle on a touch screen, this button with a mouse.
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => champ.current?.basculerClavier()}
          aria-label={`Clavier pour l’expression ${numero}`}
          className={`hidden min-h-11 shrink-0 cursor-pointer rounded-md px-2 font-display text-xs font-bold text-ink-muted transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-raised hover:text-ink pointer-fine:inline-flex pointer-fine:items-center ${FOCUS}`}
        >
          Clavier
        </button>
      )}
    </div>
  )
}
