import { type Diapo } from '@brio/content'

import { type CourseSection } from '@/components/exercice-widget'
import { Icon } from '@/components/ui/icon'
import { DiapoFrame } from '@/components/chapitre-interactif/diapo-frame'
import { FinDeChapitre } from '@/components/chapitre-interactif/fin-de-chapitre'
import {
  BlockRenderer,
  CORRIGES_AUTOMATIQUEMENT,
  type Block,
} from '@/components/blocs/block-renderer'

type Section = {
  id: string
  title: string
  kind: string
  difficulty?: string
  estimatedDurationMinutes?: number
  blocks: Block[]
}

export type ChapitreResponse = {
  schemaVersion?: number
  id: string
  title: string
  subject?: string
  level?: string
  difficulty?: string
  estimatedDurationMinutes?: number
  sections: Section[]
}

/**
 * `apercu`: the teacher's preview of an unpublished draft. Exercises have no `exerciceId` yet, so
 * they render as the student will see them, without grading.
 *
 * `deck`: the chapter's slides (ADR 0032), for a page offering the interactive mode. Each slide's
 * blocks are wrapped in a `DiapoFrame`, which leaves the reading layout untouched. Without it the
 * view renders as it always has (teacher courses, the editor's preview).
 */
export function ChapterView({
  chapitre,
  apercu = false,
  deck,
}: {
  chapitre: ChapitreResponse
  apercu?: boolean
  deck?: readonly Diapo[]
}) {
  const diapoDe = deck ? diapoParBloc(deck) : null
  const header = (
    <header className="mb-8">
      <h1
        className="font-display text-3xl font-black leading-[1.1] tracking-tight text-ink text-balance focus:outline-none"
        {...(deck ? { 'data-diapo-titre': true, tabIndex: -1 } : {})}
      >
        {chapitre.title}
      </h1>
      {(chapitre.subject || chapitre.level || chapitre.estimatedDurationMinutes) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-prose text-sm text-ink-muted">
          {chapitre.estimatedDurationMinutes != null && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="book-open" size={14} aria-hidden="true" />
              Lecture ≈ {chapitre.estimatedDurationMinutes} min
            </span>
          )}
        </p>
      )}
    </header>
  )

  return (
    <article
      data-chapitre-article
      className={`relative font-prose text-ink${deck ? ` ${INTERACTIF_TACTILE}` : ''}`}
    >
      {deck ? <DiapoFrame id="debut">{header}</DiapoFrame> : header}

      <div className={`flex flex-col gap-12${deck ? ` ${INTERACTIF_CONTENTS}` : ''}`}>
        {chapitre.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className={`scroll-mt-20${deck ? ` ${INTERACTIF_CONTENTS}` : ''}`}
          >
            <h2
              className={`mb-4 border-b border-line pb-2 font-display text-xl font-extrabold tracking-tight text-ink${deck ? ` ${INTERACTIF_HIDDEN}` : ''}`}
            >
              {section.title}
            </h2>
            <div className={`flex flex-col gap-5${deck ? ` ${INTERACTIF_CONTENTS}` : ''}`}>
              {diapoDe
                ? parDiapo(section.blocks, diapoDe).map(({ diapoId, blocks }) => (
                    <DiapoFrame
                      key={blocks[0].id}
                      id={diapoId}
                      kicker={diapoId === 'debut' ? undefined : section.title}
                    >
                      {blocks.map((block, i) => (
                        <BlockRenderer
                          key={block.id ?? i}
                          block={block}
                          apercu={apercu}
                          courseSection={courseSectionOf(section)}
                        />
                      ))}
                    </DiapoFrame>
                  ))
                : section.blocks.map((block, i) => (
                    <BlockRenderer
                      key={block.id ?? i}
                      block={block}
                      apercu={apercu}
                      courseSection={courseSectionOf(section)}
                    />
                  ))}
            </div>
            {/* Reading mode marks the section read when its end comes on screen (#252). */}
            {deck && (
              <div data-fin-section={section.id} aria-hidden="true" className={INTERACTIF_HIDDEN} />
            )}
          </section>
        ))}
      </div>

      {deck && (
        <DiapoFrame id="fin" interactifSeulement>
          <FinDeChapitre />
        </DiapoFrame>
      )}
    </article>
  )
}

// In interactive mode the section structure steps aside: only the current slide's frame lays
// out, and the section title moves into it as a kicker (ADR 0032 rule 7).
const INTERACTIF_CONTENTS = 'group-data-[chapitre-mode=interactif]/mode:contents'
const INTERACTIF_HIDDEN = 'group-data-[chapitre-mode=interactif]/mode:hidden'
// A horizontal swipe changes slide; vertical panning still scrolls. The padding keeps the slide
// clear of the bottom bar, which sits at the bottom of the screen.
const INTERACTIF_TACTILE =
  'group-data-[chapitre-mode=interactif]/mode:touch-pan-y group-data-[chapitre-mode=interactif]/mode:pb-10'

function diapoParBloc(deck: readonly Diapo[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const diapo of deck) for (const id of diapo.blockIds) map.set(id, diapo.id)
  return map
}

/** A section's blocks in runs that belong to the same slide, in order. */
function parDiapo(blocks: Block[], diapoDe: Map<string, string>) {
  const runs: { diapoId: string; blocks: Block[] }[] = []
  for (const block of blocks) {
    const diapoId = diapoDe.get(block.id) ?? block.id
    const last = runs[runs.length - 1]
    if (last?.diapoId === diapoId) last.blocks.push(block)
    else runs.push({ diapoId, blocks: [block] })
  }
  return runs
}

/**
 * The part of the course a wrong answer points back to (#253): the lesson section holding the
 * exercise. An exercise in an exercises section has no lesson of its own to point to.
 */
function courseSectionOf(section: Section): CourseSection | undefined {
  return section.kind === 'exercises' ? undefined : { id: section.id, title: section.title }
}

/** The number of steps of each `steps` block, by block id: what the interactive mode reveals. */
export function etapesParBloc(chapitre: ChapitreResponse): Record<string, number> {
  return Object.fromEntries(
    chapitre.sections.flatMap((section) =>
      section.blocks
        .filter((b) => b.type === 'steps' && Array.isArray(b.steps))
        .map((b) => [b.id, (b.steps as unknown[]).length])
    )
  )
}

/**
 * The blocks a student can check (#246): the interactive mode offers « Vérifier » and « Passer »
 * on their slides and marks them in the strip. Known on the server, so the first paint is right.
 */
export function exercicesCorriges(chapitre: ChapitreResponse): string[] {
  return chapitre.sections.flatMap((section) =>
    section.blocks
      .filter(
        (b) =>
          b.type === 'exercise' &&
          b.prompt &&
          b.exerciceId &&
          CORRIGES_AUTOMATIQUEMENT.has(b.exerciseType ?? '')
      )
      .map((b) => b.id)
  )
}

/**
 * Each exercise's `exerciceId`, by block id, paper exercises included: the interactive mode's
 * tutor tells the backend which exercise the current slide is (#250).
 */
export function exercicesParBloc(chapitre: ChapitreResponse): Record<string, string> {
  return Object.fromEntries(
    chapitre.sections.flatMap((section) =>
      section.blocks.flatMap((b) =>
        b.type === 'exercise' && b.exerciceId ? [[b.id, b.exerciceId] as const] : []
      )
    )
  )
}
