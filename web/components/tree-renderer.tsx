import {
  buildTreeModel,
  type TreeLabel,
  type TreeModel,
  type TreePathRow,
  type TreeSpec,
} from '@brio/content'

import { RichTextRenderer } from '@/components/blocs/rich-text'
import { renderKatex } from '@/lib/katex'
import clsx from 'clsx'

// A probability tree (ADR 0040). The layout comes from @brio/content in pixels and is never
// scaled: a fraction on a branch must stay legible. Branches are SVG; labels are HTML laid over
// it, so KaTeX sets fractions and $\overline{A}$ as it does in the prose. Two layouts are emitted
// and a container query shows one: the authored one from 28rem, the compact horizontal one below.

export function TreeRenderer({
  spec,
  alt,
  title,
  caption,
}: {
  spec: TreeSpec
  alt: string
  title?: string
  caption?: string
}) {
  if (!spec.root || !Array.isArray(spec.root.children) || spec.root.children.length === 0) {
    return null
  }
  const wide = buildTreeModel(spec)
  const compact = buildTreeModel(spec, { compact: true })

  return (
    <figure className="my-1 text-ink @container">
      {title && (
        <p className="mb-1.5 text-center font-display text-sm font-bold text-ink">{title}</p>
      )}
      <div className="hidden overflow-x-auto @md:block">
        <TreeDrawing model={wide} alt={alt} />
      </div>
      <div className="overflow-x-auto @md:hidden">
        <TreeDrawing model={compact} alt={alt} />
      </div>

      <PathTable rows={wide.rows} title={title} />

      {caption && (
        <figcaption className="mt-1.5 text-center font-prose text-xs text-ink-muted">
          <RichTextRenderer text={caption} />
        </figcaption>
      )}
    </figure>
  )
}

function TreeDrawing({ model, alt }: { model: TreeModel; alt: string }) {
  return (
    <div
      role="img"
      aria-label={alt}
      className="relative mx-auto font-prose text-sm leading-none text-ink"
      style={{ width: model.width, height: model.height }}
    >
      <svg
        width={model.width}
        height={model.height}
        viewBox={`0 0 ${model.width} ${model.height}`}
        className="absolute inset-0"
        aria-hidden="true"
      >
        {model.branches.map((b, i) => (
          <line
            key={i}
            x1={b.x1}
            y1={b.y1}
            x2={b.x2}
            y2={b.y2}
            className={b.emphasis ? 'stroke-tone-1' : 'stroke-current'}
            strokeWidth={b.emphasis ? 2.25 : 1.25}
            strokeLinecap="round"
          />
        ))}
        <circle cx={model.root.x} cy={model.root.y} r={2.5} className="fill-current" />
      </svg>
      {model.labels.map((label, i) => (
        <TreeLabelView key={i} label={label} />
      ))}
    </div>
  )
}

function TreeLabelView({ label }: { label: TreeLabel }) {
  const className = clsx(
    // KaTeX at the label's own size (not its 1.21em): the layout measured it so.
    'absolute whitespace-nowrap [&_.katex]:text-[1em]',
    label.anchor === 'middle' ? '-translate-x-1/2 -translate-y-1/2' : '-translate-y-1/2',
    label.emphasis ? 'font-bold text-tone-1' : 'text-ink'
  )
  const style = { left: label.x, top: label.y }
  if (label.content.kind === 'math') {
    return (
      <span
        className={className}
        style={style}
        data-role={label.role}
        dangerouslySetInnerHTML={{ __html: renderKatex(label.content.latex, false) }}
      />
    )
  }
  return (
    <span className={className} style={style} data-role={label.role}>
      <RichTextRenderer text={label.content.text} />
    </span>
  )
}

// One row per path, for a screen reader (ADR 0040 §10): the drawing itself is an image.
function PathTable({ rows, title }: { rows: TreePathRow[]; title?: string }) {
  const steps = Math.max(...rows.map((r) => r.steps.length))
  const withProduct = rows.some((r) => r.product !== null)
  return (
    <table className="sr-only">
      {title && <caption>{title}</caption>}
      <thead>
        <tr>
          {Array.from({ length: steps }, (_, i) => (
            <th key={i} scope="col">
              Épreuve {i + 1}
            </th>
          ))}
          <th scope="col">Issue</th>
          {withProduct && <th scope="col">Probabilité</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {Array.from({ length: steps }, (_, i) => {
              const step = row.steps[i]
              return (
                <td key={i}>
                  {step && <RichTextRenderer text={step.label} />}
                  {step?.probability && (
                    <>
                      {' '}
                      (probabilité{' '}
                      <span
                        dangerouslySetInnerHTML={{ __html: renderKatex(step.probability, false) }}
                      />
                      )
                    </>
                  )}
                </td>
              )
            })}
            <td>
              <RichTextRenderer text={row.outcome} />
            </td>
            {withProduct && (
              <td>
                {row.product && (
                  <span dangerouslySetInnerHTML={{ __html: renderKatex(row.product, false) }} />
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
