import katex from 'katex'
import { parseRichText, type RichTextToken, type FigureSpec } from '@brio/content'

import { ExerciceWidget } from '@/components/exercice-widget'
import { FigureRenderer } from '@/components/figure-renderer'
import { Icon } from '@/components/ui/icon'

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
  // other block fields
  [key: string]: unknown
}

export function ChapterView({ chapitre }: { chapitre: ChapitreResponse }) {
  return (
    <article className="font-prose text-ink">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-black leading-[1.1] tracking-tight text-ink text-balance">
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

      <div className="flex flex-col gap-12">
        {chapitre.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-20">
            <h2 className="mb-4 border-b border-line pb-2 font-display text-xl font-extrabold tracking-tight text-ink">
              {section.title}
            </h2>
            <div className="flex flex-col gap-5">
              {section.blocks.map((block, i) => (
                <BlockRenderer key={block.id ?? i} block={block} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case 'prose':
      return (
        <p className="font-prose text-base leading-relaxed text-ink">
          <RichTextRenderer text={block.text as string} />
        </p>
      )

    case 'heading':
      return <Heading level={(block.level as number) ?? 1} text={block.text as string} />

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
          className="overflow-x-auto py-1 text-center text-ink"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <span dangerouslySetInnerHTML={{ __html: html }} />
      )
    }

    case 'callout':
      return <Callout block={block} />

    case 'code':
      return (
        <pre className="overflow-x-auto rounded-md border border-line bg-surface-raised p-4 font-mono text-sm text-ink">
          <code>{block.code as string}</code>
        </pre>
      )

    case 'image':
      return (
        <figure className="my-1">
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
        <FigureRenderer
          spec={block.spec as FigureSpec}
          alt={block.alt as string}
          caption={block.caption as string | undefined}
        />
      )

    case 'exercise':
      return <ExerciseBlock block={block} />

    default:
      return null
  }
}

function ExerciseBlock({ block }: { block: Block }) {
  const { exerciceId, exerciseType, prompt, choices, multiple, unit, explanation } = block

  if (
    exerciceId &&
    prompt &&
    (exerciseType === 'multiple-choice' ||
      exerciseType === 'numeric' ||
      exerciseType === 'short-answer')
  ) {
    return (
      <ExerciceWidget
        exerciceId={exerciceId}
        exerciseType={exerciseType}
        prompt={prompt}
        choices={choices}
        multiple={multiple}
        unit={unit}
        explanation={explanation}
      />
    )
  }

  // Fallback for unsupported exercise types (ordering, free-text): read-only card.
  return (
    <div className="rounded-lg border border-line bg-surface-panel p-5">
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

function Heading({ level, text }: { level: number; text: string }) {
  const base = 'font-display font-extrabold tracking-tight text-ink'
  if (level === 1) return <h3 className={`text-lg ${base}`}>{text}</h3>
  if (level === 2) return <h4 className={`text-base ${base}`}>{text}</h4>
  return <h5 className={`text-sm ${base}`}>{text}</h5>
}

// Callout variants map to semantic token families — never raw colours.
const CALLOUT: Record<string, { icon: string; accent: string; surface: string; border: string }> = {
  note: { icon: 'info', accent: 'text-info', surface: 'bg-info/10', border: 'border-info/30' },
  tip: {
    icon: 'lightning',
    accent: 'text-accent',
    surface: 'bg-accent-soft',
    border: 'border-accent/40',
  },
  warning: {
    icon: 'warning-circle',
    accent: 'text-warning',
    surface: 'bg-warning/10',
    border: 'border-warning/30',
  },
  definition: {
    icon: 'book-open',
    accent: 'text-accent',
    surface: 'bg-accent-soft',
    border: 'border-accent/40',
  },
  example: {
    icon: 'sparkle',
    accent: 'text-info',
    surface: 'bg-info/10',
    border: 'border-info/30',
  },
}

const CALLOUT_LABEL: Record<string, string> = {
  note: 'À noter',
  tip: 'Astuce',
  warning: 'Attention',
  definition: 'Définition',
  example: 'Exemple',
}

function Callout({ block }: { block: Block }) {
  const variant = (block.variant as string) ?? 'note'
  const c = CALLOUT[variant] ?? CALLOUT.note

  return (
    <div className={`rounded-lg border ${c.border} ${c.surface} p-4`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${c.accent}`} aria-hidden="true">
          <Icon name={c.icon} size={18} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`mb-1 font-display text-xs font-extrabold uppercase tracking-widest ${c.accent}`}>
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
