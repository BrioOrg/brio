import { fenetreValide, formatNumber, type FigureSpec } from '@brio/content'

import {
  adresseAvecEtat,
  encoderEtat,
  LIGNES_MAX,
  type EtatCalculatrice,
} from '@/lib/calculatrice-etat'
import { prochaineCouleur } from '@/components/calculatrice/lignes'
import type { CurveColour } from '@/lib/curve-colours'

// A course figure with functions, opened in the graphing calculator (ADR 0049 §5, #423). Pure:
// the state the calculator starts from, and the address that carries it. Readings and the
// `domain` of a function are not carried over (the calculator has its own readings, and no
// domains).

export const CALCULATRICE_HREF = '/explorer/calculatrice'

/** The calculator's state for a figure; null when the figure has no function to open. */
export function figureVersCalculatrice(
  spec: FigureSpec,
  parameterValues: Readonly<Record<string, number>> = {}
): EtatCalculatrice | null {
  const functions = spec.functions ?? []
  const parameters = spec.parameters ?? []
  if (functions.length === 0 || functions.length + parameters.length > LIGNES_MAX) return null

  // A tone n takes curve colour n; the other curves take the next colour no line has.
  const taken: CurveColour[] = functions.flatMap((fn) => (fn.tone ? [fn.tone as CurveColour] : []))
  const lignes: EtatCalculatrice['lignes'] = functions.map((fn) => {
    const couleur: CurveColour = fn.tone ?? prochaineCouleur(taken)
    if (!fn.tone) taken.push(couleur)
    return {
      texte: `${fn.name}(x) = ${fn.expr}`,
      couleur,
      ...(fn.style === 'dashed' && { style: 'pointille' as const }),
    }
  })

  for (const p of parameters) {
    lignes.push({
      texte: `${p.name} = ${formatNumber(parameterValues[p.name] ?? p.value)}`,
      curseur: { min: p.min, max: p.max, pas: p.step },
    })
  }

  const fenetre = spec.axes && {
    xMin: spec.axes.x.from,
    xMax: spec.axes.x.to,
    yMin: spec.axes.y.from,
    yMax: spec.axes.y.to,
  }
  return {
    v: 1,
    lignes,
    ...(fenetre && fenetreValide(fenetre) && { fenetre, orthonorme: false as const }),
  }
}

/** The link's href (path and `?e=`), or null for a figure without functions. */
export function hrefCalculatrice(
  spec: FigureSpec,
  parameterValues: Readonly<Record<string, number>> = {}
): string | null {
  const etat = figureVersCalculatrice(spec, parameterValues)
  if (!etat) return null
  return adresseAvecEtat(`http://x${CALCULATRICE_HREF}`, encoderEtat(etat))
}
