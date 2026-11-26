import assert from 'node:assert/strict'

import { describe, expect, it } from 'vitest'

import {
  BUDGET_IMPLICITE_MAX,
  traceImplicite,
  type Fenetre,
  type PointSvg,
  type TraceImplicite,
} from '../implicite'

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
// 25 px coarse cells halved 5 times: the lattice step is 1/128, so every integer is on it and
// F = 0 falls exactly on lattice points, the case where a zero is a corner of the cells.
const wide = view({ xMin: -8, xMax: 8, yMin: -6, yMax: 6 }, 800, 600)

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
  // Native assertions keep the per-point checks cheap on dense curves.
  for (const line of t.chemins) {
    assert(line.length >= 2, 'A polyline must contain at least two points')
    for (const { x, y } of line) {
      assert(Number.isFinite(x) && Number.isFinite(y), 'Point coordinates must be finite')
      assert(x >= -1e-9, 'Point is left of the drawing')
      assert(x <= width + 1e-9, 'Point is right of the drawing')
      assert(y >= -1e-9, 'Point is above the drawing')
      assert(y <= height + 1e-9, 'Point is below the drawing')
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
    // Nor a jump with no zero in it: floor(x) − 0,5 goes from −0,5 to 0,5 at x = 1, and its
    // steps beside a jump look like the bottom of a valley.
    for (const v of [square, wide]) {
      expect(trace((x) => Math.floor(x) - 0.5, v)).toEqual({ chemins: [], points: [] })
    }
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
    for (const v of [square, wide]) {
      for (const [F, root] of cases) {
        const t = trace(F, v)
        expect(t.points).toEqual([])
        expect(t.chemins).toHaveLength(1)
        const pts = t.chemins[0]
        for (const p of pts) expect(Math.abs(v.toWorld(p).x - root) * v.sx).toBeLessThan(1)
        const ys = pts.map((p) => p.y)
        expect(Math.min(...ys)).toBeLessThan(1)
        expect(Math.max(...ys)).toBeGreaterThan((v.fenetre.yMax - v.fenetre.yMin) * v.sy - 1)
      }
    }
  })

  it('should draw a row of zeros once, not once per cell on each side (x(y − 1)²)', () => {
    // y = 1 is a lattice row: for x < 0 it is the edge of the cells above and of those below.
    const t = trace((x, y) => x * (y - 1) ** 2, wide)
    const seen = new Set<string>()
    for (const line of t.chemins) {
      for (let i = 1; i < line.length; i++) {
        const [a, b] = [line[i - 1], line[i]].map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`)
        const key = a < b ? `${a} ${b}` : `${b} ${a}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
    // x = 0 and y = 1: three pieces meeting at (0, 1).
    expect(t.chemins.length).toBeLessThanOrEqual(4)
    // Every chord lies on one of the two lines: no jump between ends wrongly taken as one
    // (vertices and edge crossings have separate identities).
    for (const line of t.chemins) {
      for (let i = 1; i < line.length; i++) {
        const m = wide.toWorld({
          x: (line[i - 1].x + line[i].x) / 2,
          y: (line[i - 1].y + line[i].y) / 2,
        })
        expect(Math.min(Math.abs(m.x), Math.abs(m.y - 1)) * wide.sx).toBeLessThan(1)
      }
    }
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

  it('should start a curve where F becomes defined, not a coarse cell later', () => {
    // x − y, undefined for x < 0: the half-line from the origin. x = 0 is off the lattice here.
    const v = view({ xMin: -5.1, xMax: 4.9, yMin: -5, yMax: 5 }, 400, 400)
    const t = trace((x, y) => Math.sqrt(x) ** 2 - y, v)
    expect(t.chemins).toHaveLength(1)
    expect(distanceToTrace(v.toSvg(0, 0), t.chemins)).toBeLessThan(2)
  })

  it('should find a curve inside an island where F is defined, narrower than a cell', () => {
    // F < 0 at the centre of a disc of radius 0,2 (8 px), undefined outside it, zero at radius
    // 0,15. The coarse cell around it sees only undefined corners and a negative centre.
    const o = -0.15625 // the centre of a coarse cell of `square`
    const F: Fn = (x, y) => Math.sqrt(0.0175) - Math.sqrt(0.04 - (x - o) ** 2 - (y - o) ** 2)
    const t = trace(F)
    expect(t.chemins).toHaveLength(1)
    expect(closed(t.chemins[0])).toBe(true)
    for (const p of t.chemins[0]) {
      const { x, y } = square.toWorld(p)
      expect(Math.abs(Math.hypot(x - o, y - o) - 0.15) * square.sx).toBeLessThan(1)
    }
  })

  it('should keep the branches of a saddle apart, as the centre of its cell says', () => {
    // (x − c)(y − c) = 10⁻⁵ with c the centre of a finest cell: its corners alternate in sign and
    // the branches pass 0,4 px apart. Joined the wrong way, a branch would cross quadrants.
    const c = 1 / 128
    const t = trace((x, y) => (x - c) * (y - c) - 1e-5, wide)
    expect(t.chemins).toHaveLength(2)
    for (const line of t.chemins) {
      const sides = new Set(line.map((p) => Math.sign(wide.toWorld(p).x - c)))
      expect(sides.size).toBe(1)
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
    // In one piece: the chords stay on the curve too.
    for (let i = 1; i < line.length; i++) {
      const m = { x: (line[i - 1].x + line[i].x) / 2, y: (line[i - 1].y + line[i].y) / 2 }
      expect(pixelDistance(F, square, m)).toBeLessThan(1)
    }
    // Both ends on the right edge of the frame, where x = 5 and y = ±√5.
    for (const p of [line[0], line[line.length - 1]]) expect(p.x).toBeCloseTo(400, 9)
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
    const onFrame = (p: PointSvg) =>
      Math.min(Math.abs(p.x), Math.abs(p.x - 400), Math.abs(p.y), Math.abs(p.y - 400))
    for (const line of t.chemins) {
      // Cut exactly on the frame, at both ends.
      expect(onFrame(line[0])).toBeLessThan(1e-9)
      expect(onFrame(line[line.length - 1])).toBeLessThan(1e-9)
      for (const p of line) {
        const { x, y } = square.toWorld(p)
        expect(Math.abs(Math.hypot(x, y) - 6) * square.sx).toBeLessThan(1)
      }
    }
  })

  it('should stay within its budget on sin(xy) = 0 over [−50 ; 50]² and return valid polylines', () => {
    const v = view({ xMin: -50, xMax: 50, yMin: -50, yMax: 50 }, 800, 800)
    let calls = 0
    const F: Fn = (x, y) => {
      calls++
      return Math.sin(x * y)
    }
    const start = performance.now()
    const t = trace(F, v)
    // Information only: the clock depends on the machine (120–135 ms on a laptop).
    console.info(`traceImplicite sin(xy): ${(performance.now() - start).toFixed(0)} ms`)
    // The guarantee is the count: never more evaluations than the budget, whatever F does…
    expect(calls).toBeLessThanOrEqual(200000)
    // …and the budget is what stopped it, not some early exit.
    expect(calls).toBeGreaterThan(190000)
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

  it('should draw a circle on an 800 × 600 view with few evaluations (target < 15 ms)', () => {
    const v = view({ xMin: -8, xMax: 8, yMin: -6, yMax: 6 }, 800, 600)
    let calls = 0
    const F: Fn = (x, y) => {
      calls++
      return x * x + y * y - 4
    }
    trace(F, v)
    // The cost that the code controls: 9 089 evaluations today, refined only along the curve.
    expect(calls).toBeLessThan(12000)
    // Information only: the clock depends on the machine (about 4 ms on a laptop).
    const times: number[] = []
    for (let i = 0; i < 11; i++) {
      const start = performance.now()
      trace(F, v)
      times.push(performance.now() - start)
    }
    times.sort((a, b) => a - b)
    console.info(`traceImplicite circle 800×600: median ${times[5].toFixed(2)} ms`)
  })

  it('should give a solution smaller than a pixel as a point, on the lattice or off it', () => {
    // x² + y² = ε: a loop far under a pixel. On the lattice its crossings all fall on the
    // vertex at the centre, which made a polyline of length 0, invisible in an SVG.
    for (const c of [0, 0.123]) {
      for (const e of [1e-6, 1e-5, 1e-4]) {
        const t = trace((x, y) => (x - c) ** 2 + (y - c) ** 2 - e, wide)
        expect(t.chemins).toEqual([])
        expect(t.points).toHaveLength(1)
        const o = wide.toSvg(c, c)
        expect(Math.hypot(t.points[0].x - o.x, t.points[0].y - o.y)).toBeLessThan(1)
      }
    }
  })

  it('should read the frame from versSvg, wherever the drawing sits in the SVG', () => {
    // The plot drawn 120 px right and 40 px down, as inside a figure with margins.
    const dx = 120
    const dy = 40
    const toSvg = (x: number, y: number) => {
      const p = square.toSvg(x, y)
      return { x: p.x + dx, y: p.y + dy }
    }
    const circle = traceImplicite((x, y) => x * x + y * y - 4, square.fenetre, toSvg)
    expect(circle.chemins).toHaveLength(1)
    expect(closed(circle.chemins[0])).toBe(true)
    for (const p of circle.chemins[0]) {
      const { x, y } = square.toWorld({ x: p.x - dx, y: p.y - dy })
      expect(Math.abs(Math.hypot(x, y) - 2) * square.sx).toBeLessThan(1)
    }
    const line = traceImplicite((x) => x - 3, square.fenetre, toSvg)
    expect(line.chemins).toHaveLength(1)
    const ys = line.chemins[0].map((p) => p.y).sort((a, b) => a - b)
    expect(ys[0]).toBeCloseTo(dy, 6)
    expect(ys[ys.length - 1]).toBeCloseTo(dy + 400, 6)
  })

  it('should still close the circle when the budget stops the refinement early', () => {
    // Each budget stops at a level, which is then drawn whole: the curve keeps its shape at
    // that level instead of being fine in one corner and broken elsewhere.
    for (const budget of [3000, 5000, 7000]) {
      let calls = 0
      const F: Fn = (x, y) => {
        calls++
        return x * x + y * y - 4
      }
      const t = trace(F, square, budget)
      expect(calls).toBeLessThanOrEqual(budget)
      expect(t.chemins).toHaveLength(1)
      expect(closed(t.chemins[0])).toBe(true)
      for (const p of t.chemins[0]) {
        const { x, y } = square.toWorld(p)
        // Coarser than 1 px, but on the circle within a coarse cell (12,5 px).
        expect(Math.abs(Math.hypot(x, y) - 2) * square.sx).toBeLessThan(12.5)
      }
    }
  })

  it('should never go over BUDGET_IMPLICITE_MAX, whatever budget is asked for', () => {
    let calls = 0
    const F: Fn = (x, y) => {
      calls++
      return Math.sin(x * y)
    }
    const v = view({ xMin: -50, xMax: 50, yMin: -50, yMax: 50 }, 800, 800)
    trace(F, v, 1e12)
    expect(calls).toBeLessThanOrEqual(BUDGET_IMPLICITE_MAX)
    expect(calls).toBeGreaterThan(BUDGET_IMPLICITE_MAX * 0.5)
  })

  it('should treat an F that throws as undefined there', () => {
    const F: Fn = (x, y) => {
      if (x < 0) throw new RangeError('not defined')
      return x * x + y * y - 4
    }
    const t = trace(F)
    expect(t.chemins.length).toBeGreaterThanOrEqual(1)
    for (const p of t.chemins.flat()) {
      const { x, y } = square.toWorld(p)
      expect(x).toBeGreaterThanOrEqual(-1e-9)
      expect(Math.abs(Math.hypot(x, y) - 2) * square.sx).toBeLessThan(1)
    }
  })

  it('should draw |x|/x = y as two half-lines, with no stroke across the jump at x = 0', () => {
    const F: Fn = (x, y) => Math.abs(x) / x - y
    const t = trace(F)
    expect(t.chemins).toHaveLength(2)
    for (const line of t.chemins) {
      for (const p of line) {
        const { x, y } = square.toWorld(p)
        // y = 1 on the right, y = −1 on the left: never the segment between them.
        expect(Math.abs(y - Math.sign(x)) * square.sx).toBeLessThan(1)
      }
    }
  })

  it('should make a cluster of double zeros two steps wide a point, and three steps a line', () => {
    // A flat-bottomed valley: F = 0 on a short segment of the x axis, (|x − x0| − L)² beyond.
    // On `wide` a lattice step is 1/64; the zeros on the lattice are the cluster.
    const valley =
      (x0: number, half: number): Fn =>
      (x, y) =>
        y * y + Math.max(0, Math.abs(x - x0) - half) ** 2
    const step = 1 / 64
    // x ∈ {−1, 0, 1} steps: 2 steps wide, a point.
    const two = trace(valley(0, step), wide)
    expect(two.chemins).toEqual([])
    expect(two.points).toHaveLength(1)
    // x ∈ {−1, 0, 1, 2} steps: 3 steps wide (2,3 px), a line.
    const three = trace(valley(step / 2, 1.5 * step), wide)
    expect(three.points).toEqual([])
    expect(three.chemins).toHaveLength(1)
  })

  it('should refine a same-sign cell only when its dip below the corners could reach zero', () => {
    // F = (x − a)² + b, with a the middle of a column of coarse cells of `square`: in those
    // cells the corners are b + h²/4 and the centre b, so the dip is h²/4 and the rule
    // "min |F| < 4 dip" reads b < h². No zero anywhere: only the cost tells.
    const h = 10 / 32
    const a = -5 + 16.5 * h
    const cost = (b: number) => {
      let calls = 0
      const t = trace((x) => {
        calls++
        return (x - a) ** 2 + b
      })
      expect(t).toEqual({ chemins: [], points: [] })
      return calls
    }
    const coarse = cost(2 * h * h)
    expect(cost(h * h)).toBe(coarse) // at the threshold: not refined
    expect(cost(h * h * (1 - 2 ** -10))).toBeGreaterThan(coarse) // just under: refined
  })

  it('should size the lattice from the corners of a view centred on the SVG origin', () => {
    // viewBox "-200 -200 400 400": the window's corners map to ±200, whose sum is 0.
    const toSvg = (x: number, y: number) => {
      const p = square.toSvg(x, y)
      return { x: p.x - 200, y: p.y - 200 }
    }
    const t = traceImplicite((x, y) => x * x + y * y - 4, square.fenetre, toSvg)
    expect(t.chemins).toHaveLength(1)
    expect(closed(t.chemins[0])).toBe(true)
    for (const p of t.chemins[0]) {
      const { x, y } = square.toWorld({ x: p.x + 200, y: p.y + 200 })
      expect(Math.abs(Math.hypot(x, y) - 2) * square.sx).toBeLessThan(1)
    }
  })

  it('should not join a lattice vertex to an unrelated edge crossing (x − 3)(y + 3,3) = 0', () => {
    // x = 3 is a lattice column of `wide`, so its crossings are vertices; y = −3,3 is not a
    // lattice row, so its crossings are on edges. Every chord must lie on one of the lines.
    const t = trace((x, y) => (x - 3) * (y + 3.3), wide)
    expect(t.chemins.length).toBeGreaterThanOrEqual(2)
    for (const line of t.chemins) {
      for (let i = 1; i < line.length; i++) {
        const m = wide.toWorld({
          x: (line[i - 1].x + line[i].x) / 2,
          y: (line[i - 1].y + line[i].y) / 2,
        })
        expect(Math.min(Math.abs(m.x - 3), Math.abs(m.y + 3.3)) * wide.sx).toBeLessThan(1)
      }
    }
  })

  it('should give one point, not two, for solutions under a pixel less than a pixel apart', () => {
    // Two loops of radius 0,16 px whose centres are 0,8 px apart: each becomes a dot, and the
    // two dots fall on the same pixel, so a single point is drawn.
    const loop = (cx: number) => (x: number, y: number) => (x - cx) ** 2 + y * y - 1e-5
    const a = loop(0)
    const b = loop(0.016)
    const t = trace((x, y) => a(x, y) * b(x, y), wide)
    expect(t.chemins).toEqual([])
    expect(t.points).toHaveLength(1)
  })
})
