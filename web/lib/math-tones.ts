import type { Tone } from '@brio/content'

// The Tailwind classes of each maths tone (ADR 0037), written out in full so Tailwind sees them.
// The colours themselves are tokens (--color-tone-n, --color-tone-n-soft in tokens.css).

/** Text colour: a `\tone` in a formula, a toned point name or label. */
export const TONE_TEXT = {
  1: 'text-tone-1',
  2: 'text-tone-2',
  3: 'text-tone-3',
  4: 'text-tone-4',
} as const satisfies Record<Tone, string>

/** Stroke of a toned segment, polygon, circle, arc or angle mark. */
export const TONE_STROKE = {
  1: 'stroke-tone-1',
  2: 'stroke-tone-2',
  3: 'stroke-tone-3',
  4: 'stroke-tone-4',
} as const satisfies Record<Tone, string>

/** Fill of a toned dot or text in a figure. */
export const TONE_FILL = {
  1: 'fill-tone-1',
  2: 'fill-tone-2',
  3: 'fill-tone-3',
  4: 'fill-tone-4',
} as const satisfies Record<Tone, string>

/** Soft fill of a polygon under its stroke. */
export const TONE_SOFT_FILL = {
  1: 'fill-tone-1-soft',
  2: 'fill-tone-2-soft',
  3: 'fill-tone-3-soft',
  4: 'fill-tone-4-soft',
} as const satisfies Record<Tone, string>

/** The class of a toned element, or none for ink. */
export function toneClass(
  classes: Record<Tone, string>,
  tone: Tone | undefined
): string | undefined {
  return tone === undefined ? undefined : classes[tone]
}

/** A toned polygon: its stroke, and its soft fill under it when asked. */
export function tonedShapeClass(
  tone: Tone | undefined,
  soft: boolean | undefined
): string | undefined {
  if (tone === undefined) return undefined
  return soft ? `${TONE_STROKE[tone]} ${TONE_SOFT_FILL[tone]}` : TONE_STROKE[tone]
}
