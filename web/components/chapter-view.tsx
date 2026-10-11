import katex from 'katex'
import {
  parseRichText,
  parseScratch,
  type Diapo,
  type RichTextToken,
  type FigureSpec,
  type ChartSpec,
} from '@brio/content'

import { ExerciceWidget, PaperExercise, type CourseSection } from '@/components/exercice-widget'
import { ChartRenderer } from '@/components/chart-renderer'
import { FigureRenderer } from '@/components/figure-renderer'
import { ScratchBlocks } from '@/components/scratch-blocks'
import { CitationChip } from '@/components/ui/chat/citation-chip'
import { Icon } from '@/components/ui/icon'
import { DiapoFrame } from '@/components/chapitre-interactif/diapo-frame'
import { FinDeChapitre } from '@/components/chapitre-interactif/scene'

type Choice = { id: string; text: string }

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

type Block = {
  id: string
  type: string
  // exercise-specific fields
  exerciceId?: string
  exerciseType?: string
  prompt?: string
  choices?: Choice[]
  multiple?: boolean
  unit?: string
  explanation?: string
  statement?: string
  solution?: string
  template?: string
  bank?: string[]
  // other block fields
  [key: string]: unknown
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
// A horizontal swipe changes slide; vertical panning still scrolls.
const INTERACTIF_TACTILE = 'group-data-[chapitre-mode=interactif]/mode:touch-pan-y'

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

function BlockRenderer({
  block,
  apercu,
  courseSection,
}: {
  block: Block
  apercu: boolean
  courseSection?: CourseSection
}) {
  switch (block.type) {
    case 'prose':
      return (
        <p id={block.id} className="font-prose text-base leading-relaxed text-ink">
          <RichTextRenderer text={block.text as string} />
        </p>
      )

    case 'heading':
      return (
        <Heading id={block.id} level={(block.level as number) ?? 1} text={block.text as string} />
      )

    case 'formula': {
      const displayMode = (block.display as string) !== 'inline'
      // KaTeX output is trusted: input comes from the reviewed content pipeline, never from user input.
      const html = katex.renderToString(block.latex as string, {
        throwOnError: false,
        output: 'htmlAndMathml',
        displayMode,
      })
      // No code-block chrome: the formula sits directly on the page ground.
      return displayMode ? (
        <div
          id={block.id}
          className="overflow-x-auto py-1 text-center text-ink"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <span id={block.id} dangerouslySetInnerHTML={{ __html: html }} />
      )
    }

    case 'callout':
      return <Callout id={block.id} block={block} />

    case 'code': {
      // A Scratch programme that does not parse (a teacher's course skips CI) stays as text.
      const scratch = block.language === 'scratch' ? parseScratch(block.code as string) : null
      if (scratch?.ok) {
        return <ScratchBlocks id={block.id} code={block.code as string} script={scratch.script} />
      }
      return (
        <pre
          id={block.id}
          className="overflow-x-auto rounded-md border border-line bg-surface-raised p-4 font-mono text-sm text-ink"
        >
          <code>{block.code as string}</code>
        </pre>
      )
    }

    case 'image':
      return (
        <figure id={block.id} className="my-1">
          <div className="rounded-md border border-line bg-surface-raised p-4 text-center font-prose text-sm italic text-ink-muted">
            [{block.asset as string}]
          </div>
          {block.caption != null && (
            <figcaption className="mt-1.5 text-center font-prose text-xs text-ink-muted">
              {block.caption as string}
            </figcaption>
          )}
        </figure>
      )

    case 'figure':
      return (
        <div id={block.id}>
          <FigureRenderer
            spec={block.spec as FigureSpec}
            alt={block.alt as string}
            caption={block.caption as string | undefined}
          />
        </div>
      )

    case 'chart':
      return (
        <div id={block.id}>
          <ChartRenderer
            spec={block as unknown as ChartSpec}
            alt={block.alt as string}
            title={block.title as string | undefined}
            caption={block.caption as string | undefined}
          />
        </div>
      )

    case 'exercise':
      return (
        <ExerciseBlock id={block.id} block={block} apercu={apercu} courseSection={courseSection} />
      )

    case 'steps':
      return <StepsBlock id={block.id} block={block} />

    case 'objectives':
      return <ObjectivesBlock id={block.id} block={block} />

    case 'table':
      return <TableBlock id={block.id} block={block} />

    case 'reference':
      return <ReferenceBlock id={block.id} block={block} />

    default:
      return null
  }
}

function TableBlock({ id, block }: { id: string; block: Block }) {
  const headers = (Array.isArray(block.headers) ? block.headers : []).filter(
    (h): h is string => typeof h === 'string'
  )
  const rows = (Array.isArray(block.rows) ? block.rows : []).filter((r): r is string[] =>
    Array.isArray(r)
  )
  const caption = typeof block.caption === 'string' ? block.caption : undefined
  if (rows.length === 0) return null

  return (
    <div id={id} className="overflow-x-auto">
      <table className="w-full border-collapse font-prose text-base text-ink">
        {caption && (
          <caption className="mb-1.5 text-left font-prose text-xs text-ink-muted">
            <RichTextRenderer text={caption} />
          </caption>
        )}
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((cell, i) => (
                <th
                  key={i}
                  scope="col"
                  className="border border-line bg-surface-raised px-3 py-2 text-left font-display text-sm font-extrabold text-ink"
                >
                  <RichTextRenderer text={cell} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border border-line px-3 py-2 align-top">
                  <RichTextRenderer text={typeof cell === 'string' ? cell : ''} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReferenceBlock({ id, block }: { id: string; block: Block }) {
  const scope = block.scope as string
  const title = typeof block.title === 'string' ? block.title : ''
  const source = typeof block.source === 'string' ? block.source : undefined
  const consultedOn = typeof block.consultedOn === 'string' ? block.consultedOn : undefined
  if (!title.trim()) return null

  let href: string | undefined
  let external = false
  if (scope === 'external') {
    href = typeof block.url === 'string' ? block.url : undefined
    external = true
  } else if (scope === 'internal') {
    const target = (block.target ?? {}) as {
      level?: string
      subject?: string
      slug?: string
      anchor?: string
    }
    if (target.level && target.subject && target.slug) {
      href = `/${target.level}/${target.subject}/${target.slug}${
        target.anchor ? `#${target.anchor}` : ''
      }`
    }
  }

  // Sans cible résoluble (brouillon incomplet), on n'affiche pas de lien mort : juste le libellé.
  const meta = [source, consultedOn && `consulté le ${consultedOn}`].filter(Boolean).join(' · ')

  return (
    <div id={id}>
      {href ? (
        <CitationChip href={href} external={external}>
          {title}
        </CitationChip>
      ) : (
        <CitationChip>{title}</CitationChip>
      )}
      {meta && <p className="mt-1 font-prose text-xs text-ink-muted">{meta}</p>}
    </div>
  )
}

function ObjectivesBlock({ id, block }: { id: string; block: Block }) {
  const title = block.title as string | undefined
  // Objectifs en texte libre écrits par l'enseignant. (Les compétences codées du référentiel,
  // block.competencies, sont un affichage séparé qui viendra avec les libellés du référentiel.)
  const items = (Array.isArray(block.items) ? block.items : []).filter(
    (it): it is string => typeof it === 'string' && it.trim().length > 0
  )
  if (items.length === 0) return null
  return (
    <div id={id} className="rounded-lg border border-accent-edge bg-accent-soft p-4">
      <p className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-accent-ink">
        {title && title.trim() ? title : 'Ce que tu vas savoir faire'}
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 font-prose text-base leading-relaxed text-ink"
          >
            <span className="mt-1 shrink-0 text-accent-ink" aria-hidden="true">
              <Icon name="check" size={15} weight="bold" />
            </span>
            <span className="min-w-0">
              <RichTextRenderer text={item} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StepsBlock({ id, block }: { id: string; block: Block }) {
  const title = block.title as string | undefined
  const steps = (Array.isArray(block.steps) ? block.steps : []) as {
    text: string
    formula?: string
  }[]
  return (
    <div id={id} className="rounded-lg border border-line bg-surface-panel p-4">
      <p className="mb-3 font-display text-xs font-extrabold uppercase tracking-widest text-accent-ink">
        {title && title.trim() ? <RichTextRenderer text={title} /> : 'Exemple'}
      </p>
      <ol className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-xs font-extrabold text-accent-ink">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-prose text-base leading-relaxed text-ink">
                <RichTextRenderer text={step.text} />
              </p>
              {step.formula && <StepFormula latex={step.formula} />}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function StepFormula({ latex }: { latex: string }) {
  // KaTeX output is trusted: content comes from the reviewed content pipeline, never user input.
  const html = katex.renderToString(latex, {
    throwOnError: false,
    output: 'htmlAndMathml',
    displayMode: true,
  })
  return (
    <div
      className="mt-1 overflow-x-auto py-1 text-ink"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function ExerciseBlock({
  id,
  block,
  apercu,
  courseSection,
}: {
  id: string
  block: Block
  apercu: boolean
  courseSection?: CourseSection
}) {
  const {
    exerciceId,
    exerciseType,
    prompt,
    choices,
    multiple,
    unit,
    explanation,
    statement,
    solution,
    template,
    bank,
  } = block

  const corrigeAutomatiquement =
    exerciseType === 'multiple-choice' ||
    exerciseType === 'numeric' ||
    exerciseType === 'short-answer' ||
    exerciseType === 'fill-blank'

  if (prompt && corrigeAutomatiquement && (exerciceId || apercu)) {
    return (
      <ExerciceWidget
        id={id}
        {...(exerciceId ? { exerciceId } : { apercu: true as const })}
        exerciseType={exerciseType}
        prompt={prompt}
        choices={choices}
        multiple={multiple}
        unit={unit}
        explanation={explanation}
        courseSection={courseSection}
        template={template}
        bank={bank}
      />
    )
  }

  // "Sur feuille" — self-assessed, no backend grading.
  if (exerciseType === 'paper' && prompt && solution) {
    return <PaperExercise id={id} prompt={prompt} statement={statement} solution={solution} />
  }

  // Fallback for unsupported exercise types (ordering, free-text): read-only card.
  return (
    <div id={id} className="rounded-lg border border-line bg-surface-panel p-5">
      <p className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
        Exercice
      </p>
      <p className="font-prose text-base text-ink">{prompt}</p>
      {explanation && (
        <details className="mt-3">
          <summary className="cursor-pointer select-none font-prose text-sm text-accent-ink">
            Voir l&rsquo;explication
          </summary>
          <p className="mt-2 font-prose text-sm text-ink-muted">{explanation}</p>
        </details>
      )}
    </div>
  )
}

function RichTextRenderer({ text }: { text: string }) {
  const tokens = parseRichText(text)
  return (
    <>
      {tokens.map((token, i) => (
        <RichTextSpan key={i} token={token} />
      ))}
    </>
  )
}

function RichTextSpan({ token }: { token: RichTextToken }) {
  switch (token.kind) {
    case 'text':
      return <>{token.value}</>
    case 'bold':
      return <strong className="font-bold text-ink">{token.value}</strong>
    case 'italic':
      return <em>{token.value}</em>
    case 'math': {
      // KaTeX output is trusted: content comes from the reviewed content pipeline, never from user input.
      const html = katex.renderToString(token.value, {
        throwOnError: false,
        output: 'htmlAndMathml',
        displayMode: false,
      })
      return <span dangerouslySetInnerHTML={{ __html: html }} />
    }
  }
}

function Heading({ id, level, text }: { id: string; level: number; text: string }) {
  const base = 'font-display font-extrabold tracking-tight text-ink'
  if (level === 1)
    return (
      <h3 id={id} className={`text-lg ${base}`}>
        {text}
      </h3>
    )
  if (level === 2)
    return (
      <h4 id={id} className={`text-base ${base}`}>
        {text}
      </h4>
    )
  return (
    <h5 id={id} className={`text-sm ${base}`}>
      {text}
    </h5>
  )
}

// Callout variants map to semantic token families — never raw colours.
// Each kind owns a distinct colour so the five read apart at a glance (#209):
// definition = accent (green), note = info (blue), example = concept (violet),
// tip = warning (amber), warning = danger (red).
const CALLOUT: Record<string, { icon: string; accent: string; surface: string; border: string }> = {
  note: { icon: 'info', accent: 'text-info', surface: 'bg-info/10', border: 'border-info/30' },
  tip: {
    icon: 'lightning',
    accent: 'text-warning',
    surface: 'bg-warning/10',
    border: 'border-warning/30',
  },
  warning: {
    icon: 'warning-circle',
    accent: 'text-danger',
    surface: 'bg-danger/10',
    border: 'border-danger/30',
  },
  definition: {
    icon: 'book-open',
    accent: 'text-accent',
    surface: 'bg-accent-soft',
    border: 'border-accent/40',
  },
  example: {
    icon: 'sparkle',
    accent: 'text-concept',
    surface: 'bg-concept/10',
    border: 'border-concept/40',
  },
}

const CALLOUT_LABEL: Record<string, string> = {
  note: 'À noter',
  tip: 'Astuce',
  warning: 'Attention',
  definition: 'Définition',
  example: 'Exemple',
}

function Callout({ id, block }: { id: string; block: Block }) {
  const variant = (block.variant as string) ?? 'note'
  const c = CALLOUT[variant] ?? CALLOUT.note

  return (
    <div id={id} className={`rounded-lg border ${c.border} ${c.surface} p-4`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${c.accent}`} aria-hidden="true">
          <Icon name={c.icon} size={18} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`mb-1 font-display text-xs font-extrabold uppercase tracking-widest ${c.accent}`}
          >
            {block.title != null ? (
              <RichTextRenderer text={block.title as string} />
            ) : (
              (CALLOUT_LABEL[variant] ?? 'À noter')
            )}
          </p>
          <p className="font-prose text-base leading-relaxed text-ink">
            <RichTextRenderer text={block.text as string} />
          </p>
        </div>
      </div>
    </div>
  )
}
