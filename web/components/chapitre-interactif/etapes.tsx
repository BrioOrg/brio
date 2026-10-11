'use client'

import { useLayoutEffect, useRef } from 'react'
import { reveler } from './animation'
import { useModeChapitre } from './mode-context'

type Props = {
  blockId: string
  /** Each step's content, rendered by the server (rich text, KaTeX). */
  etapes: React.ReactNode[]
}

/**
 * The steps of a `steps` block (MOTION.md "Step reveal"). In interactive mode, a slide entered
 * forward shows the first step and → / space / « Suivant » reveal the others one at a time. In
 * reading mode, and on a slide reached any other way, every step is there.
 *
 * A step not revealed yet is `hidden`, so a screen reader skips it too; the list announces each
 * step as it appears.
 */
export function Etapes({ blockId, etapes }: Props) {
  const ctx = useModeChapitre()
  const interactif = ctx?.mode === 'interactif'
  const visibles = interactif ? (ctx.etapesVisibles[blockId] ?? etapes.length) : etapes.length
  const liste = useRef<HTMLOListElement>(null)
  const avant = useRef(visibles)
  const reducedMotion = ctx?.reducedMotion ?? true

  // Only a step revealed on this slide animates: arriving on the slide is the slide's own beats.
  useLayoutEffect(() => {
    const precedent = avant.current
    avant.current = visibles
    if (visibles !== precedent + 1) return
    const etape = liste.current?.children[visibles - 1]
    if (etape instanceof HTMLElement) reveler(etape, reducedMotion)
  }, [visibles, reducedMotion])

  return (
    <ol ref={liste} className="flex flex-col gap-3" aria-live={interactif ? 'polite' : undefined}>
      {etapes.map((etape, i) => (
        <li key={i} data-etape={i + 1} hidden={i >= visibles || undefined} className="flex gap-3">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-xs font-extrabold text-accent-ink">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">{etape}</div>
        </li>
      ))}
    </ol>
  )
}
