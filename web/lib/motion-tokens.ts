/**
 * Motion tokens of the interactive mode, for JavaScript animations (#243).
 *
 * `motion` takes durations as seconds and curves as Bézier arrays; it cannot
 * read CSS variables. This file mirrors web/app/tokens.css for it — the CSS
 * stays the source of truth, and motion-tokens.test.ts fails if they drift.
 *
 * The CSS reduced-motion override does not reach JavaScript animations, so
 * every duration goes through motionMs()/motionS() with the result of
 * useReducedMotion(): reduced motion means 0, not a shorter animation
 * (MOTION.md, "Reduced motion").
 *
 * No framework import: the Expo app will reuse these values.
 */

/** Durations in milliseconds, keyed by the `--duration-*` token suffix. */
export const duration = {
  fast: 100,
  base: 120,
  slow: 300,
  'slide-out': 160,
  'slide-in': 280,
  stagger: 50,
  beat: 240,
  press: 90,
  select: 160,
  sheet: 290,
  check: 300,
  particles: 1030,
  'xp-delay': 500,
  'xp-flight': 470,
  count: 180,
  finale: 900,
} as const

export type DurationName = keyof typeof duration

export type Bezier = readonly [number, number, number, number]

function curve(bezier: Bezier) {
  return { bezier, css: `cubic-bezier(${bezier.join(', ')})` } as const
}

/** Curves, keyed by the `--ease-*` token suffix. */
export const ease = {
  in: curve([0.4, 0, 1, 1]),
  out: curve([0, 0, 0.4, 1]),
  standard: curve([0.2, 0, 0, 1]),
  'out-quint': curve([0.22, 1, 0.36, 1]),
  /** Reading mode only — the interactive mode never overshoots. */
  spring: curve([0.34, 1.56, 0.64, 1]),
} as const

export type EaseName = keyof typeof ease

/** Travel distances in pixels, keyed by the `--motion-*` token suffix. */
export const distance = {
  'slide-shift': 32,
  'beat-rise': 12,
  'particle-spread': 55,
} as const

/** Particle counts: not design values, so constants here rather than CSS tokens. */
export const particles = {
  count: 21,
  /** The end-slide burst has twice the particles… */
  finaleCountFactor: 2,
  /** …and 1.6 times the spread. */
  finaleSpreadFactor: 1.6,
} as const

/** A duration in milliseconds, or 0 when the student asked for reduced motion. */
export function motionMs(name: DurationName, reducedMotion: boolean | null): number {
  return reducedMotion ? 0 : duration[name]
}

/** A duration in seconds, the unit `motion` expects; 0 under reduced motion. */
export function motionS(name: DurationName, reducedMotion: boolean | null): number {
  return motionMs(name, reducedMotion) / 1000
}
