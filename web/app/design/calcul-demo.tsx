'use client'

import { useState } from 'react'
import { type CalculSpec } from '@brio/content'

import { CalculRenderer } from '@/components/calcul-renderer'
import { Button } from '@/components/ui/button'

/* ── Calcul en ligne (ADR 0042) ──────────────────────────────────────────────
   The interactive mode's line-by-line reveal, driven by a local counter: in a
   chapter, « Étape suivante », → and space do the same through the mode context. */

const EQUATION: CalculSpec = {
  mode: 'equation',
  title: 'Résoudre $3x + 5 = 11$',
  lines: [
    { latex: '3x + 5 = 11' },
    { latex: '3x = 6', op: '-5', note: 'on soustrait 5 aux deux membres' },
    { latex: 'x = \\frac{6}{3}', op: '\\div 3', note: 'on divise les deux membres par 3' },
    { latex: 'x = 2', note: 'on simplifie' },
  ],
  conclusion: 'La solution de l’équation est $2$.',
}

const TOTAL = EQUATION.lines.length + 1

export function CalculDemo() {
  const [visibles, setVisibles] = useState(1)
  const fini = visibles >= TOTAL
  return (
    <div className="flex flex-col gap-4">
      <CalculRenderer id="demo-calcul-interactif" spec={EQUATION} visibles={visibles} />
      <div className="flex flex-wrap gap-3">
        <Button size="sm" onClick={() => setVisibles((n) => n + 1)} disabled={fini}>
          Étape suivante
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setVisibles(1)}>
          Recommencer
        </Button>
      </div>
    </div>
  )
}
