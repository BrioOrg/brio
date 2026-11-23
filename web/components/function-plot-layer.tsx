import type { DrawingCurveLabel, DrawingFunctionPlot } from '@brio/content'

import { HALO_CLASS } from '@/components/figure/halo'
import { TONE_TEXT, toneClass } from '@/lib/math-tones'

// The curves of a figure's functions, their names and the readings (ADR 0038), drawn inside the
// figure's <svg>. The model is computed in @brio/content: here, only the mapping to SVG.
// The curve keeps the ink of the figure, or the tone of its formula (ADR 0037, drawn through
// currentColor); a reading is the one accent-coloured thing, guides, point and values together.

// Viewbox units, like the figure's own strokes.
export const CURVE_DASH = '6 4'
const GUIDE_DASH = '3 3'

/** Guides, curves and reading points: drawn with the figure's other strokes. */
export function FunctionPlotStrokes({ plot }: { plot: DrawingFunctionPlot | null }) {
  if (!plot) return null
  return (
    <g>
      {plot.readings.map((r, i) =>
        r.guides.map((g, j) => (
          <line
            key={`guide-${i}-${j}`}
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
            className="stroke-accent"
            strokeWidth={1}
            strokeDasharray={GUIDE_DASH}
          />
        ))
      )}

      {plot.curves.map((c, i) => (
        <path
          key={`curve-${i}`}
          d={c.d}
          data-function={c.name}
          className={toneClass(TONE_TEXT, c.tone)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={c.dashed ? CURVE_DASH : undefined}
        />
      ))}

      {plot.readings.map((r, i) =>
        r.dots.map((d, j) => (
          <circle key={`dot-${i}-${j}`} cx={d.cx} cy={d.cy} r={2.5} className="fill-accent" />
        ))
      )}
    </g>
  )
}

/** Read values and curve names: drawn over every stroke, with a halo. */
export function FunctionPlotTexts({ plot }: { plot: DrawingFunctionPlot | null }) {
  if (!plot) return null
  return (
    <g>
      {plot.readings.map((r, i) =>
        r.values.map((v, j) => (
          <text
            key={`value-${i}-${j}`}
            x={v.x}
            y={v.y}
            textAnchor={v.anchor}
            dominantBaseline={v.baseline}
            fontSize={11}
            className={`fill-accent-ink ${HALO_CLASS}`}
          >
            {v.text}
          </text>
        ))
      )}

      {plot.labels.map((l) => (
        <CurveLabel key={`label-${l.name}`} label={l} />
      ))}
    </g>
  )
}

function CurveLabel({ label }: { label: DrawingCurveLabel }) {
  if (label.kind === 'text') {
    return (
      <text
        className={[toneClass(TONE_TEXT, label.tone), HALO_CLASS].filter(Boolean).join(' ')}
        x={label.x}
        y={label.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fill="currentColor"
      >
        {label.text}
      </text>
    )
  }
  // 𝒞 with the function's name as an italic subscript, as in a textbook: 𝒞_f.
  return (
    <text
      className={[toneClass(TONE_TEXT, label.tone), HALO_CLASS].filter(Boolean).join(' ')}
      x={label.x}
      y={label.y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={15}
      fontFamily="serif"
      fill="currentColor"
    >
      {'\u{1D49E}'}
      <tspan fontSize={10} fontStyle="italic" dy={4}>
        {label.subscript}
      </tspan>
    </text>
  )
}
