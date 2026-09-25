'use client'

import katex from 'katex'
import { useMemo, useRef } from 'react'

// Rendu KaTeX « en direct » d'une formule LaTeX saisie à la main. Contrairement à l'afficheur
// élève (chapter-view.tsx), l'entrée ici est saisie par un humain, en cours de frappe : elle est
// donc souvent incomplète ou invalide. On rend avec throwOnError pour attraper l'erreur nous-mêmes
// et afficher un message discret plutôt qu'un « ParseError » rouge, tout en gardant le dernier
// rendu valide visible pour ne pas faire clignoter la page à chaque frappe.
//
// Composant isolé et réutilisable : l'élève s'en servira en F5 pour voir sa réponse rendue.

type Props = {
  latex: string
  /** Rendu « bloc » centré (défaut) ou « en ligne ». */
  displayMode?: boolean
  /** Texte affiché quand rien n'a encore été saisi. */
  placeholder?: string
}

export function ApercuKatex({
  latex,
  displayMode = true,
  placeholder = 'Le rendu de la formule apparaîtra ici.',
}: Props) {
  // Dernier HTML valide : conservé pour ne pas vider l'aperçu pendant qu'une formule est
  // momentanément invalide (ex. une accolade pas encore refermée).
  const dernierValide = useRef<string>('')

  const { html, erreur } = useMemo(() => {
    const source = latex.trim()
    if (!source) return { html: '', erreur: null as string | null }
    try {
      const rendu = katex.renderToString(source, {
        throwOnError: true,
        output: 'htmlAndMathml',
        displayMode,
      })
      dernierValide.current = rendu
      return { html: rendu, erreur: null as string | null }
    } catch {
      return { html: dernierValide.current, erreur: 'Formule incomplète ou invalide.' }
    }
  }, [latex, displayMode])

  if (!html && !erreur) {
    return <p className="font-prose text-sm italic text-ink-muted/70">{placeholder}</p>
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        aria-live="polite"
        className={`overflow-x-auto text-ink ${displayMode ? 'text-center' : ''} ${
          erreur ? 'opacity-50' : ''
        }`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {erreur && (
        <p role="status" className="font-prose text-xs text-ink-muted">
          {erreur}
        </p>
      )}
    </div>
  )
}
