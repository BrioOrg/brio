// The Tailwind classes of each curve colour of the graphing calculator (#417, ADR 0049), written
// out in full so Tailwind sees them. The colours themselves are tokens (--color-courbe-n in
// tokens.css): the curve and the pastille of its line, never decoration or state.

/** Which of the six curve colours: the n-th expression of the calculator. */
export type CouleurCourbe = 1 | 2 | 3 | 4 | 5 | 6

/** Stroke of a curve. */
export const COURBE_STROKE = {
  1: 'stroke-courbe-1',
  2: 'stroke-courbe-2',
  3: 'stroke-courbe-3',
  4: 'stroke-courbe-4',
  5: 'stroke-courbe-5',
  6: 'stroke-courbe-6',
} as const satisfies Record<CouleurCourbe, string>

/** Fill of a point or an SVG label in the colour of its curve. */
export const COURBE_FILL = {
  1: 'fill-courbe-1',
  2: 'fill-courbe-2',
  3: 'fill-courbe-3',
  4: 'fill-courbe-4',
  5: 'fill-courbe-5',
  6: 'fill-courbe-6',
} as const satisfies Record<CouleurCourbe, string>

/** Background of the pastille of a line. */
export const COURBE_BG = {
  1: 'bg-courbe-1',
  2: 'bg-courbe-2',
  3: 'bg-courbe-3',
  4: 'bg-courbe-4',
  5: 'bg-courbe-5',
  6: 'bg-courbe-6',
} as const satisfies Record<CouleurCourbe, string>

/** Text colour of the name of a curve. */
export const COURBE_TEXT = {
  1: 'text-courbe-1',
  2: 'text-courbe-2',
  3: 'text-courbe-3',
  4: 'text-courbe-4',
  5: 'text-courbe-5',
  6: 'text-courbe-6',
} as const satisfies Record<CouleurCourbe, string>
