'use client'

import { useLayoutEffect, useRef } from 'react'

import { reveler } from './animation'
import { useModeChapitre } from './mode-context'

/** One line of a `calcul` block, its KaTeX already rendered. */
export type LigneCalcul = {
  /** HTML of each column; KaTeX hides it from assistive technology. */
  lhs: string
  rel: string
  rhs: string
  /** The whole line as MathML: what a screen reader reads. */
  lu: string
  /** The operation applied to both members to get this line (equation mode). */
  op?: {
    html: string
    lu: string
    /** The previous line's right member: the operation is set under its end. */
    rhsAvant: string
  }
  note?: React.ReactNode
}

type Props = {
  blockId: string
  lignes: LigneCalcul[]
  conclusion?: React.ReactNode
  /** Forces the number of steps shown (the /design demo). */
  visibles?: number
}

const cacher = (cache: boolean) => (cache ? ' invisible' : '')

// Grid rows inside a line: the operation (if any), the line, and on a narrow block the note.
// Written out in full so Tailwind sees every class.
const RANG = {
  avecOp: {
    ligne: 'row-start-2',
    note: 'row-start-3 @lg:row-start-2',
  },
  sansOp: {
    ligne: 'row-start-1',
    note: 'row-start-2 @lg:row-start-1',
  },
} as const

/**
 * The lines of a worked calculation (ADR 0042), aligned on their relation: three columns shared
 * by every line (left member, relation, right member) and the notes in a fourth when the block is
 * wide enough, under their line otherwise.
 *
 * In an equation, the operation applied to both members (−13 … −13) is written under each member
 * of the previous line, at its end, as on a copy. It belongs to the line it leads to, so it shows
 * with that line and reads before it.
 *
 * In the interactive mode the lines come one at a time, like the steps of a `steps` block
 * (MOTION.md "Step reveal"), then the conclusion. A line not revealed yet keeps its place,
 * `invisible`: the columns never change width under the student's eyes, and assistive technology
 * skips it too.
 */
export function CalculLignes({ blockId, lignes, conclusion, visibles: forcees }: Props) {
  const ctx = useModeChapitre()
  const total = lignes.length + (conclusion ? 1 : 0)
  const interactif = ctx?.mode === 'interactif'
  const visibles = forcees ?? (interactif ? (ctx.etapesVisibles[blockId] ?? total) : total)
  const reducedMotion = ctx?.reducedMotion ?? true
  const racine = useRef<HTMLDivElement>(null)
  const avant = useRef(visibles)

  // Only a line revealed on this slide moves: arriving on the slide is the slide's own beats.
  useLayoutEffect(() => {
    const precedent = avant.current
    avant.current = visibles
    if (visibles !== precedent + 1) return
    const arrivant = racine.current?.querySelector<HTMLElement>(`[data-etape="${visibles}"]`)
    if (arrivant) reveler(arrivant, reducedMotion)
  }, [visibles, reducedMotion])

  return (
    <div ref={racine} className="@container">
      <ol
        className="grid grid-cols-[auto_auto_1fr] gap-y-2 overflow-x-auto pb-1 text-base text-ink @lg:grid-cols-[auto_auto_auto_1fr]"
        aria-live={interactif ? 'polite' : undefined}
      >
        {lignes.map((ligne, i) => {
          const cachee = i >= visibles
          const rang = ligne.op ? RANG.avecOp : RANG.sansOp
          return (
            <li
              key={i}
              data-etape={i + 1}
              aria-hidden={cachee || undefined}
              className={`col-span-full grid grid-cols-subgrid items-baseline${cacher(cachee)}`}
            >
              <span className="sr-only">
                {ligne.op && (
                  <>
                    Aux deux membres : <span dangerouslySetInnerHTML={{ __html: ligne.op.lu }} />
                    .{' '}
                  </>
                )}
                <span dangerouslySetInnerHTML={{ __html: ligne.lu }} />
              </span>
              {ligne.op && (
                <>
                  <Operation
                    html={ligne.op.html}
                    className="col-start-1 row-start-1 -mt-1 self-start justify-self-end"
                  />
                  {/* The previous right member, without height, gives the width to end under. */}
                  <span
                    aria-hidden="true"
                    className="col-start-3 row-start-1 -mt-1 flex flex-col items-end self-start justify-self-start"
                  >
                    <span
                      className="invisible h-0 overflow-hidden"
                      dangerouslySetInnerHTML={{ __html: ligne.op.rhsAvant }}
                    />
                    <Operation html={ligne.op.html} />
                  </span>
                </>
              )}
              <span
                className={`col-start-1 justify-self-end ${rang.ligne}`}
                dangerouslySetInnerHTML={{ __html: ligne.lhs }}
              />
              <span
                className={`col-start-2 ${rang.ligne}`}
                dangerouslySetInnerHTML={{ __html: ligne.rel }}
              />
              <span
                className={`col-start-3 justify-self-start ${rang.ligne}`}
                dangerouslySetInnerHTML={{ __html: ligne.rhs }}
              />
              {ligne.note && (
                <span
                  className={`col-start-3 font-prose text-sm italic text-ink-muted @lg:col-start-4 @lg:pl-6 ${rang.note}`}
                >
                  {ligne.note}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {conclusion && (
        <p
          data-etape={total}
          aria-hidden={visibles < total || undefined}
          className={`mt-3 font-prose text-base leading-relaxed text-ink${cacher(visibles < total)}`}
        >
          {conclusion}
        </p>
      )}
    </div>
  )
}

/** The operation under a member: small, in tone 1, the colour of the part it changes. */
function Operation({ html, className = '' }: { html: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`whitespace-nowrap text-xs leading-none text-tone-1 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
