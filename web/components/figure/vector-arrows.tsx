import type { DrawingVector } from '@brio/content'

import { HTML_HALO_CLASS } from '@/components/figure/halo'
import { renderKatex } from '@/lib/katex'

const DASH = '5 4'
// The box a vector's name is centred in, in viewBox units: room for \overrightarrow{AB}.
const LABEL_BOX_W = 56
const LABEL_BOX_H = 28

/**
 * Vectors (ADR 0041): a shaft, a filled arrowhead in proportion to the stroke, and the name
 * typeset by KaTeX (\vec{u}, \overrightarrow{AB}) beside the arrow, the same way as in the text.
 */
export function VectorArrows({
  vectors,
  part = 'all',
}: {
  vectors: DrawingVector[]
  /** A figure draws the arrows with its strokes and the names over every stroke (ADR 0038). */
  part?: 'arrows' | 'names' | 'all'
}) {
  const arrows = part !== 'names'
  const names = part !== 'arrows'
  return (
    <>
      {vectors.map((v, i) => (
        <g key={i}>
          {arrows && (
            <>
              <line
                x1={v.x1}
                y1={v.y1}
                x2={v.x2}
                y2={v.y2}
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray={v.dashed ? DASH : undefined}
              />
              <polygon points={v.head} fill="currentColor" />
            </>
          )}
          {names && v.label && (
            <foreignObject
              x={v.label.x - LABEL_BOX_W / 2}
              y={v.label.y - LABEL_BOX_H / 2}
              width={LABEL_BOX_W}
              height={LABEL_BOX_H}
            >
              <div
                className={`flex h-full w-full items-center justify-center leading-none ${HTML_HALO_CLASS}`}
                style={{ fontSize: 13 }}
                dangerouslySetInnerHTML={{ __html: renderKatex(v.label.tex, false) }}
              />
            </foreignObject>
          )}
        </g>
      ))}
    </>
  )
}
