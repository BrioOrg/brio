'use client'

import { useEffect, useRef, useState } from 'react'

import { ApercuKatex } from '@/components/maths/apercu-katex'
import { ClavierMaths, type InsertionMaths } from '@/components/maths/clavier-maths'

// Champ de saisie d'une formule : l'input LaTeX, son rendu KaTeX en direct dessous, et le clavier
// maths qui apparaît quand le champ est actif. L'insertion se fait au curseur (et enveloppe la
// sélection le cas échéant). Composant isolé et réutilisable — l'élève s'en servira en F5 pour
// répondre. Le champ reste « contrôlé » (value/onChange) pour s'intégrer au modèle du bloc.

type Props = {
  value: string
  onChange: (value: string) => void
  onFocus?: () => void
  placeholder?: string
  /** Rendu « bloc » centré (défaut) ou « en ligne » pour l'aperçu. */
  displayMode?: boolean
  /** Classe de l'input LaTeX (le style dépend du bloc appelant). */
  inputClassName?: string
  /** Libellé accessible de l'input. */
  ariaLabel?: string
}

export function ChampFormule({
  value,
  onChange,
  onFocus,
  placeholder,
  displayMode = true,
  inputClassName = '',
  ariaLabel = 'Formule LaTeX',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [actif, setActif] = useState(false)
  // Position du curseur à restaurer après une insertion (le champ étant contrôlé, on ne peut
  // repositionner le curseur qu'une fois la nouvelle valeur rendue).
  const caretEnAttente = useRef<number | null>(null)

  useEffect(() => {
    if (caretEnAttente.current != null && inputRef.current) {
      const pos = caretEnAttente.current
      caretEnAttente.current = null
      inputRef.current.focus()
      inputRef.current.setSelectionRange(pos, pos)
    }
  }, [value])

  function inserer({ avant, apres }: InsertionMaths) {
    const el = inputRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? start
    const selection = value.slice(start, end)
    onChange(value.slice(0, start) + avant + selection + apres + value.slice(end))
    // Curseur juste après le fragment inséré et la sélection enveloppée (dans le premier trou).
    caretEnAttente.current = start + avant.length + selection.length
  }

  // Le clavier vit dans le même conteneur que l'input : on garde le champ « actif » tant que le
  // focus reste à l'intérieur (input ou touches), pour que la navigation clavier fonctionne.
  function onBlurConteneur(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActif(false)
  }

  const montrerApercu = actif || value.trim().length > 0

  return (
    <div
      className="flex flex-col gap-2"
      onFocus={() => {
        setActif(true)
        onFocus?.()
      }}
      onBlur={onBlurConteneur}
    >
      <input
        ref={inputRef}
        aria-label={ariaLabel}
        className={inputClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {actif && <ClavierMaths onInserer={inserer} />}
      {montrerApercu && <ApercuKatex latex={value} displayMode={displayMode} />}
    </div>
  )
}
