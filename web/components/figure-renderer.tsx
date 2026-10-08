import {
  buildDrawingModel,
  type DrawingAxis,
  type DrawingText,
  type FigureSpec,
} from '@brio/content'

export function FigureRenderer({
  spec,
  alt,
  caption,
}: {
  spec: FigureSpec
  alt: string
  caption?: string
}) {
  const model = buildDrawingModel(spec)

  return (
    <figure className="my-1 text-ink">
      <div className="overflow-x-auto">
        <svg
          viewBox={model.viewBox}
          role="img"
          aria-labelledby={caption ? undefined : undefined}
          className="mx-auto block max-w-full"
          style={{ maxWidth: 320 }}
        >
          <title>{alt}</title>
          {caption && <desc>{caption}</desc>}

          {/* Repère grid: behind everything, in the muted line colour */}
          {model.axes?.grid.map((g, i) => (
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

          {model.axes && (
            <g>
              <Axis axis={model.axes.x} />
              <Axis axis={model.axes.y} />
              {model.axes.origin && <AxisText text={model.axes.origin} fontSize={11} />}
            </g>
          )}

          {/* Polygons */}
          {model.polygons.map((poly, i) => (
            <polygon
              key={i}
              points={poly.points}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            />
          ))}

          {/* Segments */}
          {model.segments.map((seg, i) => (
            <line
              key={i}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke="currentColor"
              strokeWidth={1.5}
            />
          ))}

          {/* Polylines */}
          {model.polylines.map((pl, i) => (
            <polyline
              key={i}
              points={pl.points}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          ))}

          {/* Circles */}
          {model.circles.map((c, i) => (
            <circle
              key={i}
              cx={c.cx}
              cy={c.cy}
              r={c.r}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            />
          ))}

          {/* Right-angle squares */}
          {model.rightAngleSquares.map((sq, i) => (
            <polyline
              key={i}
              points={sq.points}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            />
          ))}

          {/* Angle arcs */}
          {model.angleArcs.map((arc, i) => (
            <path key={i} d={arc.d} fill="none" stroke="currentColor" strokeWidth={1.5} />
          ))}

          {/* Length ticks */}
          {model.lengthTicks.map((tick, i) =>
            tick.lines.map((line, j) => (
              <line
                key={`${i}-${j}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="currentColor"
                strokeWidth={1.5}
              />
            ))
          )}

          {/* Point dots */}
          {model.dots.map((dot, i) => (
            <circle key={i} cx={dot.cx} cy={dot.cy} r={2} fill="currentColor" />
          ))}

          {/* Point labels */}
          {model.pointLabels.map((lbl, i) => (
            <text
              key={i}
              x={lbl.x}
              y={lbl.y}
              textAnchor={lbl.anchor}
              dominantBaseline={lbl.baseline}
              fontSize={13}
              fontFamily="serif"
              fill="currentColor"
            >
              {lbl.text}
            </text>
          ))}

          {/* Free labels */}
          {model.freeLabels.map((lbl, i) => (
            <text
              key={i}
              x={lbl.x}
              y={lbl.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
              fill="currentColor"
            >
              {lbl.text}
            </text>
          ))}

          {/* Number lines */}
          {model.numberLines.map((nl, i) => (
            <g key={i}>
              <line
                x1={nl.axis.x1}
                y1={nl.axis.y1}
                x2={nl.axis.x2}
                y2={nl.axis.y2}
                stroke="currentColor"
                strokeWidth={1.5}
              />
              {nl.ticks.map((tick, j) => (
                <g key={j}>
                  <line
                    x1={tick.x1}
                    y1={tick.y1}
                    x2={tick.x2}
                    y2={tick.y2}
                    stroke="currentColor"
                    strokeWidth={1.5}
                  />
                  {tick.label && (
                    <text
                      x={tick.labelX}
                      y={tick.labelY}
                      textAnchor="middle"
                      dominantBaseline={tick.labelBaseline}
                      fontSize={11}
                      fill="currentColor"
                    >
                      {tick.label}
                    </text>
                  )}
                </g>
              ))}
            </g>
          ))}
        </svg>
      </div>

      {caption && (
        <figcaption className="mt-1.5 text-center font-prose text-xs text-ink-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

function AxisText({ text, fontSize }: { text: DrawingText; fontSize: number }) {
  return (
    <text
      x={text.x}
      y={text.y}
      textAnchor={text.anchor}
      dominantBaseline={text.baseline}
      fontSize={fontSize}
      fill="currentColor"
    >
      {text.text}
    </text>
  )
}

function Axis({ axis }: { axis: DrawingAxis }) {
  return (
    <g>
      <line
        x1={axis.line.x1}
        y1={axis.line.y1}
        x2={axis.line.x2}
        y2={axis.line.y2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <polygon points={axis.arrow.points} fill="currentColor" />
      {axis.ticks.map((tick, i) => (
        <g key={i}>
          <line
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="currentColor"
            strokeWidth={1.5}
          />
          {tick.label && <AxisText text={tick.label} fontSize={11} />}
        </g>
      ))}
      {axis.title && <AxisText text={axis.title} fontSize={12} />}
    </g>
  )
}
