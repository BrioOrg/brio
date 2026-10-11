'use client'

import { useModeChapitre } from './mode-context'

type Props = {
  id: string
  /** The section title, shown above the slide in interactive mode and focused when it opens. */
  kicker?: string
  /** Absent from the reading page (the end slide). */
  interactifSeulement?: boolean
  children: React.ReactNode
}

/**
 * The blocks of one slide (ADR 0032). In reading mode the frame is `display: contents`, so the
 * page lays out exactly as without it. In interactive mode only the current slide's frames show.
 * The element never changes type between modes: its blocks, and their state, are never remounted.
 *
 * A slide may have several frames: `debut` holds the chapter header and, inside the first section,
 * the objectives block.
 */
export function DiapoFrame({ id, kicker, interactifSeulement = false, children }: Props) {
  const ctx = useModeChapitre()
  const interactif = ctx?.mode === 'interactif'
  const courante = interactif && ctx.deck[ctx.index]?.id === id
  const sortante = interactif && !courante && ctx.sortante === id
  const cache = interactif ? !courante && !sortante : interactifSeulement

  // One structure in both modes: a child that moves (the kicker appearing before the blocks)
  // would make React remount the blocks, and lose an answer being typed.
  return (
    <div
      data-diapo={id}
      hidden={cache || undefined}
      inert={sortante || undefined}
      aria-hidden={sortante || undefined}
      className={interactif ? 'flex flex-col gap-5' : 'contents'}
    >
      {interactif && kicker ? (
        <h2
          data-diapo-titre
          tabIndex={-1}
          className="font-display text-xs font-extrabold uppercase tracking-widest text-accent-ink focus:outline-none"
        >
          {kicker}
        </h2>
      ) : null}
      {interactifSeulement && !interactif ? null : children}
    </div>
  )
}
