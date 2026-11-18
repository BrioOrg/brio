import type { DrawingModel } from '@brio/content'

import { HALO_CLASS } from '@/components/figure/halo'
import { VectorArrows } from '@/components/figure/vector-arrows'

// The same strokes as <FigureRenderer/>: hidden edges and construction lines in viewBox units.
const DASH = '5 4'

/**
 * The geometric elements of a drawing model, without its frame (axes, number lines, solids): an
 * image layer, its construction marks or the ghost that moves to it (ADR 0041). Colour comes
 * from the surrounding group, through `currentColor`.
 *
 * `fixedStroke` keeps strokes at their width while the group is scaled, as the ghost of a
 * homothety is during its motion.
 */
export function FigureLayer({
  model,
  fixedStroke = false,
}: {
  model: DrawingModel
  fixedStroke?: boolean
}) {
  const stroke = {
    stroke: 'currentColor',
    strokeWidth: 1.5,
    fill: 'none',
    vectorEffect: fixedStroke ? ('non-scaling-stroke' as const) : undefined,
  }
  return (
    <>
      {model.polygons.map((p, i) => (
        <polygon
          key={`pg-${i}`}
          points={p.points}
          {...stroke}
          strokeLinejoin="round"
          strokeDasharray={p.dashed ? DASH : undefined}
        />
      ))}
      {model.segments.map((s, i) => (
        <line
          key={`sg-${i}`}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          {...stroke}
          strokeDasharray={s.dashed ? DASH : undefined}
        />
      ))}
      {model.curves.map((c, i) => (
        <path key={`cv-${i}`} d={c.d} {...stroke} strokeDasharray={c.dashed ? DASH : undefined} />
      ))}
      {model.polylines.map((p, i) => (
        <polyline
          key={`pl-${i}`}
          points={p.points}
          {...stroke}
          strokeLinejoin="round"
          strokeDasharray={p.dashed ? DASH : undefined}
        />
      ))}
      {model.circles.map((c, i) => (
        <circle key={`ci-${i}`} cx={c.cx} cy={c.cy} r={c.r} {...stroke} />
      ))}
      {model.rightAngleSquares.map((sq, i) => (
        <polyline key={`ra-${i}`} points={sq.points} {...stroke} />
      ))}
      {model.angleArcs.map((a, i) => (
        <path key={`aa-${i}`} d={a.d} {...stroke} />
      ))}
      {model.lengthTicks.flatMap((tick, i) =>
        tick.lines.map((l, j) => (
          <line key={`lt-${i}-${j}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} {...stroke} />
        ))
      )}
      <VectorArrows vectors={model.vectors} part="arrows" />
      {model.dots.map((d, i) => (
        <circle key={`dt-${i}`} cx={d.cx} cy={d.cy} r={2} fill="currentColor" />
      ))}
      {model.pointLabels.map((l, i) => (
        <text
          key={`lb-${i}`}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          dominantBaseline={l.baseline}
          fontSize={13}
          fontFamily="serif"
          fill="currentColor"
          className={HALO_CLASS}
        >
          {l.text}
        </text>
      ))}
      {/* Names last, with a halo: no stroke of the layer runs through them (ADR 0038). */}
      <VectorArrows vectors={model.vectors} part="names" />
    </>
  )
}
