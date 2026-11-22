import type { Bezier } from '@/lib/motion-tokens'

/**
 * The progress of a CSS cubic-bezier curve at time `t` in [0, 1], for an animation driven frame
 * by frame in JavaScript (a solid coming back to its starting view, ADR 0039). Solved by
 * bisection on x, which is monotonic for every curve of motion-tokens.ts.
 */
export function bezierAt(curve: Bezier, t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const [x1, y1, x2, y2] = curve
  const at = (p1: number, p2: number, s: number) =>
    3 * p1 * s * (1 - s) ** 2 + 3 * p2 * s * s * (1 - s) + s ** 3
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (at(x1, x2, mid) < t) lo = mid
    else hi = mid
  }
  return at(y1, y2, (lo + hi) / 2)
}
