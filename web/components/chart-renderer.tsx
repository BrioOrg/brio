import { buildChartModel, formatNumber, type ChartSpec, type ChartText } from '@brio/content'

// Literal class names so Tailwind generates them; a pie has at most six categories (ADR 0030 §6).
const SECTOR_FILL = [
  'fill-chart-1',
  'fill-chart-2',
  'fill-chart-3',
  'fill-chart-4',
  'fill-chart-5',
  'fill-chart-6',
] as const

const LINE_HEIGHT = 13

export function ChartRenderer({
  spec,
  alt,
  title,
  caption,
}: {
  spec: ChartSpec
  alt: string
  title?: string
  caption?: string
}) {
  const model = buildChartModel(spec)
  const series = spec.series[0]

  return (
    <figure className="my-1 text-ink">
      {title && (
        <p className="mb-1.5 text-center font-display text-sm font-bold text-ink">{title}</p>
      )}
      <div className="overflow-x-auto">
        <svg
          viewBox={model.viewBox}
          role="img"
          className="mx-auto block max-w-full"
          style={{ maxWidth: 320 }}
        >
          <title>{alt}</title>
          {caption && <desc>{caption}</desc>}

          {model.valueAxis?.grid.map((g, i) => (
            <line
              key={`grid-${i}`}
              x1={g.x1}
              y1={g.y1}
              x2={g.x2}
              y2={g.y2}
              className="stroke-line"
              strokeWidth={1}
            />
          ))}

          {model.bars.map((bar, i) => (
            <rect
              key={`bar-${i}`}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              className="fill-accent"
            />
          ))}

          {model.sectors.map((sector, i) => (
            <path
              key={`sector-${i}`}
              d={sector.d}
              className={`${SECTOR_FILL[(sector.slot - 1) % SECTOR_FILL.length]} stroke-surface-page`}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          ))}

          {model.leaders.map((l, i) => (
            <line
              key={`leader-${i}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="currentColor"
              strokeWidth={1}
            />
          ))}

          {model.valueAxis && (
            <g>
              <line
                x1={model.valueAxis.line.x1}
                y1={model.valueAxis.line.y1}
                x2={model.valueAxis.line.x2}
                y2={model.valueAxis.line.y2}
                stroke="currentColor"
                strokeWidth={1.5}
              />
              {model.valueAxis.ticks.map((tick, i) => (
                <g key={`tick-${i}`}>
                  <line
                    x1={tick.x1}
                    y1={tick.y1}
                    x2={tick.x2}
                    y2={tick.y2}
                    stroke="currentColor"
                    strokeWidth={1.5}
                  />
                  <ChartLabel text={tick.label} fontSize={11} />
                </g>
              ))}
              {model.valueAxis.title && <ChartLabel text={model.valueAxis.title} fontSize={12} />}
            </g>
          )}

          {model.baseline && (
            <line
              x1={model.baseline.x1}
              y1={model.baseline.y1}
              x2={model.baseline.x2}
              y2={model.baseline.y2}
              stroke="currentColor"
              strokeWidth={1.5}
            />
          )}

          {model.line && (
            <g>
              <polyline
                points={model.line.points}
                fill="none"
                className="stroke-accent"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {model.line.dots.map((dot, i) => (
                <circle key={`dot-${i}`} cx={dot.cx} cy={dot.cy} r={3} className="fill-accent" />
              ))}
            </g>
          )}

          {model.categoryLabels.map((label, i) => (
            <ChartLabel key={`cat-${i}`} text={label} fontSize={11} />
          ))}
          {model.valueLabels.map((label, i) => (
            <ChartLabel key={`val-${i}`} text={label} fontSize={11} />
          ))}
          {model.categoryAxisTitle && <ChartLabel text={model.categoryAxisTitle} fontSize={12} />}
        </svg>
      </div>

      {series && (
        <table className="sr-only">
          {title && <caption>{title}</caption>}
          <thead>
            <tr>
              <th scope="col">{spec.xLabel ?? 'Catégorie'}</th>
              <th scope="col">{series.label}</th>
            </tr>
          </thead>
          <tbody>
            {series.data.map((d) => (
              <tr key={d.label}>
                <th scope="row">{d.label}</th>
                <td>{formatNumber(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {caption && (
        <figcaption className="mt-1.5 text-center font-prose text-xs text-ink-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

// A label of several lines grows away from its anchor point: downwards when it hangs, upwards
// when it sits on its baseline, both ways when it is centred.
function ChartLabel({ text, fontSize }: { text: ChartText; fontSize: number }) {
  const n = text.lines.length
  const firstY =
    text.baseline === 'hanging'
      ? text.y
      : text.baseline === 'auto'
        ? text.y - (n - 1) * LINE_HEIGHT
        : text.y - ((n - 1) * LINE_HEIGHT) / 2
  return (
    <text
      x={text.x}
      y={firstY}
      textAnchor={text.anchor}
      dominantBaseline={text.baseline}
      fontSize={fontSize}
      fill="currentColor"
    >
      {text.lines.map((line, i) => (
        <tspan key={i} x={text.x} dy={i === 0 ? 0 : LINE_HEIGHT}>
          {line}
        </tspan>
      ))}
    </text>
  )
}
