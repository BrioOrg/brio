import { describe, expect, it } from 'vitest'

import { traceImplicite, type Fenetre, type PointSvg, type TraceImplicite } from '../implicite'

type Fn = (x: number, y: number) => number

/** An affine view of `fenetre` on a `width` × `height` px drawing, y downwards. */
function view(fenetre: Fenetre, width: number, height: number) {
  const sx = width / (fenetre.xMax - fenetre.xMin)
  const sy = height / (fenetre.yMax - fenetre.yMin)
  return {
    fenetre,
    sx,
    sy,
    toSvg: (x: number, y: number): PointSvg => ({
      x: (x - fenetre.xMin) * sx,
      y: (fenetre.yMax - y) * sy,
    }),
    toWorld: (p: PointSvg) => ({ x: fenetre.xMin + p.x / sx, y: fenetre.yMax - p.y / sy }),
  }
}

const square = view({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, 400, 400)

function trace(F: Fn, v = square, budget?: number): TraceImplicite {
  return traceImplicite(F, v.fenetre, v.toSvg, budget === undefined ? undefined : { budget })
}

/** Distance from the SVG point p to the curve F = 0, in pixels, to first order (|F| / |∇F|). */
function pixelDistance(F: Fn, v: typeof square, p: PointSvg): number {
  const { x, y } = v.toWorld(p)
  const h = 1e-6
  const gx = (F(x + h, y) - F(x - h, y)) / (2 * h) / v.sx
  const gy = (F(x, y + h) - F(x, y - h)) / (2 * h) / v.sy
  return Math.abs(F(x, y)) / Math.hypot(gx, gy)
}

function closed(line: PointSvg[]): boolean {
  const a = line[0]
  const b = line[line.length - 1]
  return line.length > 3 && Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9
}

function distanceToSegment(p: PointSvg, a: PointSvg, b: PointSvg): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

function distanceToTrace(p: PointSvg, lines: PointSvg[][]): number {
  let best = Infinity
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      best = Math.min(best, distanceToSegment(p, line[i - 1], line[i]))
    }
  }
  return best
}

/** Every polyline has at least two finite points inside the drawing. */
function expectValid(t: TraceImplicite, width: number, height: number) {
  for (const line of t.chemins) {
    expect(line.length).toBeGreaterThanOrEqual(2)
    for (const p of line) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
      expect(p.x).toBeGreaterThanOrEqual(-1e-9)
      expect(p.x).toBeLessThanOrEqual(width + 1e-9)
      expect(p.y).toBeGreaterThanOrEqual(-1e-9)
      expect(p.y).toBeLessThanOrEqual(height + 1e-9)
    }
  }
}

describe('traceImplicite', () => {
  it('should draw x² + y² = 4 as one closed polyline within 1 px of the circle', () => {
    const t = trace((x, y) => x * x + y * y - 4)
    expect(t.chemins).toHaveLength(1)
    expect(t.points).toEqual([])
    const [line] = t.chemins
    expect(closed(line)).toBe(true)
    for (const p of line) {
      const { x, y } = square.toWorld(p)
      expect(Math.abs(Math.hypot(x, y) - 2) * square.sx).toBeLessThan(1)
    }
    // The chords too: the midpoint of each stays within a pixel of the circle.
    for (let i = 1; i < line.length; i++) {
      const m = { x: (line[i - 1].x + line[i].x) / 2, y: (line[i - 1].y + line[i].y) / 2 }
      const { x, y } = square.toWorld(m)
      expect(Math.abs(Math.hypot(x, y) - 2) * square.sx).toBeLessThan(1)
    }
  })

  it('should draw x = 3 as a vertical segment from the top of the frame to the bottom', () => {
    const t = trace((x) => x - 3)
    expect(t.chemins).toHaveLength(1)
    const [line] = t.chemins
    expect(line).toHaveLength(2)
    for (const p of line) expect(p.x).toBeCloseTo(square.toSvg(3, 0).x, 6)
    const ys = line.map((p) => p.y).sort((a, b) => a - b)
    expect(ys[0]).toBeCloseTo(0, 6)
    expect(ys[1]).toBeCloseTo(400, 6)
  })

  it('should draw a vertical line off the lattice as well (x = 1/3)', () => {
    const t = trace((x) => x - 1 / 3)
    expect(t.chemins).toHaveLength(1)
    const [line] = t.chemins
    expect(line).toHaveLength(2)
    for (const p of line) expect(p.x).toBeCloseTo(square.toSvg(1 / 3, 0).x, 6)
  })

  it('should draw xy = 1 as two branches, neither crossing an axis', () => {
    const t = trace((x, y) => x * y - 1)
    expect(t.chemins).toHaveLength(2)
    const quadrants = t.chemins.map((line) => {
      const signs = new Set(
        line.map((p) => {
          const { x, y } = square.toWorld(p)
          expect(x * y).toBeGreaterThan(0)
          return Math.sign(x)
        })
      )
      expect(signs.size).toBe(1)
      return [...signs][0]
    })
    expect(quadrants.sort()).toEqual([-1, 1])
    for (const line of t.chemins) {
      for (const p of line) expect(pixelDistance((x, y) => x * y - 1, square, p)).toBeLessThan(1)
    }
  })

  it('should draw nothing for 1/(x − 1) = 0, not even the asymptote', () => {
    expect(trace((x) => 1 / (x - 1))).toEqual({ chemins: [], points: [] })
    // Nor a jump with no zero in it: floor(x) − 0,5 goes from −0,5 to 0,5 at x = 1.
    expect(trace((x) => Math.floor(x) - 0.5)).toEqual({ chemins: [], points: [] })
  })

  it('should not draw the asymptotes of tan x = 0, only its zeros', () => {
    const t = trace((x) => Math.tan(x))
    // Zeros at x = −π, 0, π; asymptotes at ±π/2 must stay empty.
    const xs = t.chemins.flat().map((p) => square.toWorld(p).x)
    for (const x of xs) {
      const nearest = Math.round(x / Math.PI) * Math.PI
      expect(Math.abs(x - nearest) * square.sx).toBeLessThan(1)
    }
    expect(t.chemins).toHaveLength(3)
  })

  it('should draw the three lines of sin x = sin y through their crossings, with no gap over 2 px', () => {
    const v = view({ xMin: -4, xMax: 4, yMin: -4, yMax: 4 }, 400, 400)
    const F: Fn = (x, y) => Math.sin(x) - Math.sin(y)
    const t = trace(F, v)
    expectValid(t, 400, 400)
    const lines: Array<(x: number) => number> = [(x) => x, (x) => Math.PI - x, (x) => -Math.PI - x]
    for (const g of lines) {
      // Samples every half pixel along the true line: none is more than 1 px from the trace,
      // so no gap is wider than 2 px, crossings (the saddles) included.
      for (let px = 0; px <= 400; px += 0.5) {
        const x = -4 + px / v.sx
        const y = g(x)
        if (y < -4 || y > 4) continue
        expect(distanceToTrace(v.toSvg(x, y), t.chemins)).toBeLessThan(1)
      }
    }
    for (const line of t.chemins) {
      for (const p of line) expect(pixelDistance(F, v, p)).toBeLessThan(1)
    }
  })

  it('should draw the double zero (x − 1)² = 0 as the line x = 1, from frame to frame', () => {
    const cases: Array<[Fn, number]> = [
      [(x) => (x - 1) ** 2, 1],
      [(x) => -((x - 1.0123) ** 2), 1.0123],
      // A V rather than a parabola, its tip on the lattice and off it.
      [(x) => Math.abs(x - 1), 1],
      [(x) => Math.abs(x - 1.0123), 1.0123],
    ]
    for (const [F, root] of cases) {
      const t = trace(F)
      expect(t.points).toEqual([])
      expect(t.chemins).toHaveLength(1)
      const pts = t.chemins[0]
      for (const p of pts) expect(Math.abs(square.toWorld(p).x - root) * square.sx).toBeLessThan(1)
      const ys = pts.map((p) => p.y)
      expect(Math.min(...ys)).toBeLessThan(1)
      expect(Math.max(...ys)).toBeGreaterThan(399)
    }
  })

  it('should draw a row of zeros once, not once per cell on each side (x(y − 1)²)', () => {
    const t = trace((x, y) => x * (y - 1) ** 2)
    for (const line of t.chemins) expect(closed(line)).toBe(false)
    // x = 0 and y = 1: three pieces meeting at (0, 1), none drawn twice.
    expect(t.chemins.length).toBeLessThanOrEqual(4)
  })

  it('should draw (x² + y² − 4)² = 0 as the circle of radius 2', () => {
    const t = trace((x, y) => (x * x + y * y - 4) ** 2)
    expect(t.points).toEqual([])
    const pts = t.chemins.flat()
    expect(pts.length).toBeGreaterThan(20)
    for (const p of pts) {
      const { x, y } = square.toWorld(p)
      expect(Math.abs(Math.hypot(x, y) - 2) * square.sx).toBeLessThan(1)
    }
    // All around: every degree of the circle has a point of the trace within 1,5 px.
    for (let a = 0; a < 360; a++) {
      const r = (a * Math.PI) / 180
      const q = square.toSvg(2 * Math.cos(r), 2 * Math.sin(r))
      expect(distanceToTrace(q, t.chemins)).toBeLessThan(1.5)
    }
  })

  it('should give the single solution of x² + y² = 0 as a point', () => {
    for (const [cx, cy] of [
      [0, 0],
      [0.123, -0.456],
    ]) {
      const t = trace((x, y) => (x - cx) ** 2 + (y - cy) ** 2)
      expect(t.chemins).toEqual([])
      expect(t.points).toHaveLength(1)
      const o = square.toSvg(cx, cy)
      expect(Math.hypot(t.points[0].x - o.x, t.points[0].y - o.y)).toBeLessThan(1)
    }
  })

  it('should draw nothing where F has no zero (x² + y² + 1, a constant, 1/(x − 1)²)', () => {
    expect(trace((x, y) => x * x + y * y + 1)).toEqual({ chemins: [], points: [] })
    expect(trace(() => 3)).toEqual({ chemins: [], points: [] })
    expect(trace((x) => 1 / (x - 1) ** 2)).toEqual({ chemins: [], points: [] })
  })

  it('should stop where F is not defined (√x + y² = 4 has no part for x < 0)', () => {
    const F: Fn = (x, y) => Math.sqrt(x) + y * y - 1
    const t = trace(F)
    expect(t.chemins.length).toBeGreaterThanOrEqual(1)
    for (const p of t.chemins.flat()) {
      expect(square.toWorld(p).x).toBeGreaterThanOrEqual(-1e-9)
    }
  })

  it('should draw the ellipse x²/9 + y²/4 = 1 closed and within 1 px', () => {
    const F: Fn = (x, y) => (x * x) / 9 + (y * y) / 4 - 1
    const t = trace(F)
    expect(t.chemins).toHaveLength(1)
    expect(closed(t.chemins[0])).toBe(true)
    for (const p of t.chemins[0]) expect(pixelDistance(F, square, p)).toBeLessThan(1)
  })

  it('should draw the parabola x = y² as one open branch from frame to frame', () => {
    const F: Fn = (x, y) => x - y * y
    const t = trace(F)
    expect(t.chemins).toHaveLength(1)
    const line = t.chemins[0]
    expect(closed(line)).toBe(false)
    for (const p of line) expect(pixelDistance(F, square, p)).toBeLessThan(1)
  })

  it('should work on a window that is not square, with cells square in pixels', () => {
    const v = view({ xMin: -10, xMax: 10, yMin: -3, yMax: 3 }, 800, 300)
    const F: Fn = (x, y) => x * x + y * y - 4
    const t = trace(F, v)
    expect(t.chemins).toHaveLength(1)
    expect(closed(t.chemins[0])).toBe(true)
    for (const p of t.chemins[0]) expect(pixelDistance(F, v, p)).toBeLessThan(1)
    expectValid(t, 800, 300)
  })

  it('should clip a curve leaving the frame (a circle of radius 6 in [−5 ; 5]²)', () => {
    const t = trace((x, y) => x * x + y * y - 36)
    expect(t.chemins).toHaveLength(4)
    expectValid(t, 400, 400)
  })

  it('should stay within its budget on sin(xy) = 0 over [−50 ; 50]² and return valid polylines', () => {
    const v = view({ xMin: -50, xMax: 50, yMin: -50, yMax: 50 }, 800, 800)
    let calls = 0
    const F: Fn = (x, y) => {
      calls++
      return Math.sin(x * y)
    }
    const t = trace(F, v)
    // The hard guarantee: never more evaluations than the budget, whatever F does.
    expect(calls).toBeLessThanOrEqual(200000)
    // And a bounded time. Best of three after that first run (the JIT warm-up), so a CI worker
    // shared with the rest of the suite measures the code rather than its neighbours.
    const times: number[] = []
    for (let i = 0; i < 3; i++) {
      const start = performance.now()
      trace(F, v)
      times.push(performance.now() - start)
    }
    expect(Math.min(...times)).toBeLessThan(300)
    expect(t.chemins.length).toBeGreaterThan(0)
    expectValid(t, 800, 800)
  })

  it('should honour a smaller budget, down to nothing', () => {
    let calls = 0
    const F: Fn = (x, y) => {
      calls++
      return x * x + y * y - 4
    }
    trace(F, square, 5000)
    expect(calls).toBeLessThanOrEqual(5000)
    calls = 0
    expect(trace(F, square, 10)).toEqual({ chemins: [], points: [] })
    expect(calls).toBeLessThanOrEqual(10)
  })

  it('should give the same output for the same input', () => {
    const F: Fn = (x, y) => Math.sin(x) - Math.sin(y) + 0.1 * x * y
    expect(trace(F)).toEqual(trace(F))
    const G: Fn = (x, y) => Math.sin(x * y)
    const big = view({ xMin: -50, xMax: 50, yMin: -50, yMax: 50 }, 600, 600)
    expect(trace(G, big)).toEqual(trace(G, big))
  })

  it('should return nothing for an empty or invalid window', () => {
    const F: Fn = (x, y) => x + y
    expect(traceImplicite(F, { xMin: 1, xMax: 1, yMin: 0, yMax: 1 }, square.toSvg)).toEqual({
      chemins: [],
      points: [],
    })
    expect(traceImplicite(F, { xMin: 0, xMax: NaN, yMin: 0, yMax: 1 }, square.toSvg)).toEqual({
      chemins: [],
      points: [],
    })
    expect(traceImplicite(F, square.fenetre, () => ({ x: 0, y: 0 }))).toEqual({
      chemins: [],
      points: [],
    })
  })

  it('should not mistake a circle touching a lattice line for a double zero', () => {
    // On this view (2, 0) is a lattice point: there F = 0 and, along y, its neighbours are
    // both positive, as at a double zero; along x it changes sign, so it is not one.
    const v = view({ xMin: -8, xMax: 8, yMin: -6, yMax: 6 }, 800, 600)
    const t = trace((x, y) => x * x + y * y - 4, v)
    expect(t.points).toEqual([])
    expect(t.chemins).toHaveLength(1)
    expect(closed(t.chemins[0])).toBe(true)
  })

  it('should draw a circle on an 800 × 600 view quickly (target < 15 ms)', () => {
    const v = view({ xMin: -8, xMax: 8, yMin: -6, yMax: 6 }, 800, 600)
    const F: Fn = (x, y) => x * x + y * y - 4
    for (let i = 0; i < 5; i++) trace(F, v) // warm-up
    const times: number[] = []
    for (let i = 0; i < 21; i++) {
      const start = performance.now()
      trace(F, v)
      times.push(performance.now() - start)
    }
    times.sort((a, b) => a - b)
    const median = times[10]
    console.info(`traceImplicite circle 800×600: median ${median.toFixed(2)} ms`)
    // Not a gate: a loaded CI machine is slower. The target is recorded in the PR.
    expect(median).toBeLessThan(100)
  })
})
