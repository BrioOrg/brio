import type { components } from '@brio/api-client'

type ChapitreResponse = components['schemas']['ChapitreResponse']
type Block = Record<string, unknown>

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
              <BlockRenderer key={(block['id'] as string) ?? i} block={block} />
            ))}
          </div>
        </section>
      ))}
    </article>
  )
}

function BlockRenderer({ block }: { block: Block }) {
  const type = block['type'] as string

  switch (type) {
    case 'prose':
      return <p className="text-gray-700 leading-relaxed">{block['text'] as string}</p>

    case 'heading':
      return <Heading level={(block['level'] as number) ?? 1} text={block['text'] as string} />

    case 'formula':
      return (
        <pre className="bg-gray-50 border rounded p-3 font-mono text-sm overflow-x-auto">
          {block['latex'] as string}
        </pre>
      )

    case 'callout':
      return <Callout block={block} />

    case 'code':
      return (
        <pre className="bg-gray-900 text-gray-100 rounded p-4 text-sm overflow-x-auto">
          <code>{block['code'] as string}</code>
        </pre>
      )

    case 'image':
      return (
        <figure className="my-4">
          <div className="bg-gray-100 rounded p-4 text-center text-sm text-gray-500 italic">
            [{block['asset'] as string}]
          </div>
          {block['caption'] && (
            <figcaption className="mt-1 text-center text-xs text-gray-500">
              {block['caption'] as string}
            </figcaption>
          )}
        </figure>
      )

    case 'exercise':
      return <ExerciseStatement block={block} />

    default:
      return null
  }
}

function Heading({ level, text }: { level: number; text: string }) {
  const className = 'font-semibold text-gray-800 mt-4'
  if (level === 1) return <h3 className={`text-lg ${className}`}>{text}</h3>
  if (level === 2) return <h4 className={`text-base ${className}`}>{text}</h4>
  return <h5 className={`text-sm ${className}`}>{text}</h5>
}

function Callout({ block }: { block: Block }) {
  const variant = (block['variant'] as string) ?? 'note'
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
      {block['title'] && <p className="font-semibold mb-1">{block['title'] as string}</p>}
      <p>{block['text'] as string}</p>
    </div>
  )
}

function ExerciseStatement({ block }: { block: Block }) {
  return (
    <div className="rounded-lg border border-gray-300 bg-white p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Exercice</p>
      <p className="text-gray-800">{block['prompt'] as string}</p>
      {block['explanation'] && (
        <details className="mt-3">
          <summary className="text-sm text-gray-500 cursor-pointer select-none">
            Explication
          </summary>
          <p className="mt-2 text-sm text-gray-600">{block['explanation'] as string}</p>
        </details>
      )}
    </div>
  )
}
