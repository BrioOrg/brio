import { ExerciceWidget } from '@/components/exercice-widget'

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
    <article>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{chapitre.title}</h1>
        {(chapitre.subject || chapitre.level) && (
          <p className="mt-1 text-sm text-gray-500">
            {[chapitre.subject, chapitre.level].filter(Boolean).join(' · ')}
          </p>
        )}
      </header>

      {chapitre.sections.map((section) => (
        <section key={section.id} className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-gray-800 border-b pb-2">
            {section.title}
          </h2>
          <div className="space-y-4">
            {section.blocks.map((block, i) => (
              <BlockRenderer key={block.id ?? i} block={block} />
            ))}
          </div>
        </section>
      ))}
    </article>
  )
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case 'prose':
      return <p className="text-gray-700 leading-relaxed">{block.text as string}</p>

    case 'heading':
      return <Heading level={(block.level as number) ?? 1} text={block.text as string} />

    case 'formula':
      return (
        <pre className="bg-gray-50 border rounded p-3 font-mono text-sm overflow-x-auto">
          {block.latex as string}
        </pre>
      )

    case 'callout':
      return <Callout block={block} />

    case 'code':
      return (
        <pre className="bg-gray-900 text-gray-100 rounded p-4 text-sm overflow-x-auto">
          <code>{block.code as string}</code>
        </pre>
      )

    case 'image':
      return (
        <figure className="my-4">
          <div className="bg-gray-100 rounded p-4 text-center text-sm text-gray-500 italic">
            [{block.asset as string}]
          </div>
          {block.caption && (
            <figcaption className="mt-1 text-center text-xs text-gray-500">
              {block.caption as string}
            </figcaption>
          )}
        </figure>
      )

    case 'exercise':
      return <ExerciseBlock block={block} />

    default:
      return null
  }
}

function ExerciseBlock({ block }: { block: Block }) {
  const { exerciceId, exerciseType, prompt, choices, multiple, unit, explanation } = block

  if (exerciceId && prompt && (exerciseType === 'multiple-choice' || exerciseType === 'numeric')) {
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

  // Fallback for unsupported exercise types (short-answer, ordering, free-text)
  return (
    <div className="rounded-lg border border-gray-300 bg-white p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Exercice</p>
      <p className="text-gray-800">{prompt}</p>
      {explanation && (
        <details className="mt-3">
          <summary className="text-sm text-gray-500 cursor-pointer select-none">
            Explication
          </summary>
          <p className="mt-2 text-sm text-gray-600">{explanation}</p>
        </details>
      )}
    </div>
  )
}

function Heading({ level, text }: { level: number; text: string }) {
  const className = 'font-semibold text-gray-800 mt-4'
  if (level === 1) return <h3 className={`text-lg ${className}`}>{text}</h3>
  if (level === 2) return <h4 className={`text-base ${className}`}>{text}</h4>
  return <h5 className={`text-sm ${className}`}>{text}</h5>
}

function Callout({ block }: { block: Block }) {
  const variant = (block.variant as string) ?? 'note'
  const styles: Record<string, string> = {
    note: 'bg-blue-50 border-blue-200 text-blue-900',
    tip: 'bg-green-50 border-green-200 text-green-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    definition: 'bg-purple-50 border-purple-200 text-purple-900',
    example: 'bg-orange-50 border-orange-200 text-orange-900',
  }
  const style = styles[variant] ?? styles['note']

  return (
    <div className={`rounded-lg border p-4 ${style}`}>
      {block.title && <p className="font-semibold mb-1">{block.title as string}</p>}
      <p>{block.text as string}</p>
    </div>
  )
}
