'use client'

// Clavier maths réutilisable : une rangée de touches qui insèrent du LaTeX au curseur. Chaque
// touche décrit ce qui s'insère AVANT et APRÈS le curseur (`apres` sert aux modèles à trou :
// \frac{|}{}, \sqrt{|}, x^{|}…). Si du texte est sélectionné, il est enveloppé (il devient le
// contenu du premier trou). Le composant est purement présentiel : il ne connaît ni le champ ni le
// DOM — c'est l'appelant (champ-formule) qui réalise l'insertion. Réutilisable côté élève en F5.

/** Une insertion : `avant` va juste avant le curseur, `apres` juste après (modèle à trou). */
export type InsertionMaths = { avant: string; apres: string }

type Touche = {
  /** Symbole affiché sur la touche. */
  symbole: string
  /** Libellé accessible (lu par les lecteurs d'écran, infobulle). */
  label: string
  insertion: InsertionMaths
}

// Jeu minimal du CDC (#123) + variantes à modèle utiles au collège/lycée. L'ordre suit celui d'un
// clavier maths courant : opérateurs, puissances/indices, racines, fractions, comparateurs, grec.
const TOUCHES: Touche[] = [
  { symbole: '×', label: 'Multiplié', insertion: { avant: '\\times ', apres: '' } },
  { symbole: '÷', label: 'Divisé', insertion: { avant: '\\div ', apres: '' } },
  { symbole: 'x²', label: 'Au carré', insertion: { avant: '^2', apres: '' } },
  { symbole: 'xⁿ', label: 'Exposant', insertion: { avant: '^{', apres: '}' } },
  { symbole: 'xᵢ', label: 'Indice', insertion: { avant: '_{', apres: '}' } },
  { symbole: '√', label: 'Racine carrée', insertion: { avant: '\\sqrt{', apres: '}' } },
  { symbole: 'ⁿ√', label: 'Racine n-ième', insertion: { avant: '\\sqrt[', apres: ']{}' } },
  { symbole: 'a/b', label: 'Fraction', insertion: { avant: '\\frac{', apres: '}{}' } },
  { symbole: '≤', label: 'Inférieur ou égal', insertion: { avant: '\\le ', apres: '' } },
  { symbole: '≥', label: 'Supérieur ou égal', insertion: { avant: '\\ge ', apres: '' } },
  { symbole: '∈', label: 'Appartient à', insertion: { avant: '\\in ', apres: '' } },
  { symbole: 'π', label: 'Pi', insertion: { avant: '\\pi ', apres: '' } },
]

type Props = {
  onInserer: (insertion: InsertionMaths) => void
  /** Libellé du groupe de touches pour les lecteurs d'écran. */
  ariaLabel?: string
}

export function ClavierMaths({ onInserer, ariaLabel = 'Clavier mathématique' }: Props) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface-panel p-1.5 shadow-sm"
    >
      {TOUCHES.map((touche) => (
        <button
          key={touche.symbole}
          type="button"
          title={touche.label}
          aria-label={touche.label}
          // onMouseDown + preventDefault : garder le focus (et donc le curseur) dans le champ
          // au lieu de le lui voler au clic.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInserer(touche.insertion)}
          className="grid h-8 min-w-8 place-items-center rounded-md border border-line bg-surface-page px-2 font-mono text-sm text-ink transition-colors hover:border-accent hover:bg-accent-soft"
        >
          {touche.symbole}
        </button>
      ))}
    </div>
  )
}
