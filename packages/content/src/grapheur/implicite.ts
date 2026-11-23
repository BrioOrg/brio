// Implicit curves F(x, y) = 0 for the graphing calculator (ADR 0049). Pure: a function, a
// window and the window's affine transform in, SVG-ready polylines out. No dependency, no DOM.
//
// Outline:
// 1. A coarse grid of about 32 × 32 cells, square in pixels, is refined breadth first (a
//    quadtree) where F changes sign, vanishes, is undefined on a part, or bends enough towards
//    zero to hide one (a double zero), down to cells of about 1 px.
// 2. Marching squares on the finest cells, with linear interpolation on the edges and saddles
//    decided by the value at the centre. A crossing is kept only if F really tends to 0 there:
//    a change of sign across a pole (1/(x − 1), tan) is rejected.
// 3. Double zeros ((x − 1)², (x² + y² − 4)²) are found as lattice points where |F| is a local
//    minimum along an axis and, by its slope, at most half a step from 0. They are linked into
//    lines; a cluster no larger than two steps is an isolated solution (x² + y² = 0): a point.
// 4. Segments are stitched into polylines by the identity of their ends (an edge or a lattice
//    vertex, never a rounded coordinate), clipped to the frame and simplified as in
//    `function-plot.ts`. Every loop runs in a fixed order: the output is deterministic.
// Evaluations are counted: past the budget nothing is refined further, so nothing freezes.

import type { Pt } from '../function-plot'

export type Fenetre = { xMin: number; xMax: number; yMin: number; yMax: number }
/** A point in SVG pixels: the `Pt` of `function-plot.ts`. */
export type PointSvg = Pt
/** `chemins`: polylines in SVG pixels; `points`: isolated solutions (x² + y² = 0). */
export type TraceImplicite = { chemins: PointSvg[][]; points: PointSvg[] }
export type OptionsImplicite = { budget?: number }

/** Default cap on evaluations of F for one curve. */
export const BUDGET_IMPLICITE = 200000
/** No budget asked for goes above this: about a second of work, never a freeze. */
export const BUDGET_IMPLICITE_MAX = 1000000
/** Coarse cells along the longer side of the view. */
const COARSE_CELLS = 32
/** Finest cells are at most this size, in pixels. */
const FINEST_PX = 1
/** Deepest quadtree level, whatever the view size (a 4 096 px wide view still reaches 1 px). */
const MAX_DEPTH = 12
/** Share of the budget the refinement may use; the rest checks crossings and double zeros. */
const REFINE_SHARE = 0.8
/** Regula falsi steps allowed to show that F tends to 0 at a crossing. */
const CROSSING_STEPS = 3
/** A double zero is accepted this many lattice steps from its point at most. */
const TOUCH_STEPS = 0.5
/** The same when the point ties with a neighbour: a parabola halfway is at 0,125. */
const TIE_STEPS = 0.25
/** A cluster of double zeros at most this many steps wide is one isolated point. */
const POINT_STEPS = 2
/** A cell with no sign change is refined when its smallest |F| is under this many dips. */
const DIP_FACTOR = 4
/** Same tolerance as `function-plot.ts`. */
const SIMPLIFY_PX = 0.08
/** A polyline no larger than this, in pixels, would not show as a stroke: it is a point. */
const DOT_PX = 1

type Box = { left: number; top: number; right: number; bottom: number }
type Cell = { i: number; j: number; size: number }
type Crossing = { id: number; x: number; y: number }

/**
 * Traces F(x, y) = 0 over `fenetre`. `versSvg` maps the window to SVG pixels and must be affine
 * (y may point down, as in SVG): pixel sizes are taken from it at the window's corners. `F`
 * returns NaN (or ±Infinity) where it is not defined; one that throws is treated the same way.
 * At most `options.budget` evaluations of F (default BUDGET_IMPLICITE, capped at
 * BUDGET_IMPLICITE_MAX); past it the curve is drawn as far as it was refined.
 */
export function traceImplicite(
  F: (x: number, y: number) => number,
  fenetre: Fenetre,
  versSvg: (x: number, y: number) => PointSvg,
  options?: OptionsImplicite
): TraceImplicite {
  const empty: TraceImplicite = { chemins: [], points: [] }
  const { xMin, xMax, yMin, yMax } = fenetre
  if (![xMin, xMax, yMin, yMax].every(Number.isFinite) || !(xMax > xMin) || !(yMax > yMin)) {
    return empty
  }
  const tl = versSvg(xMin, yMax)
  const br = versSvg(xMax, yMin)
  const widthPx = Math.abs(br.x - tl.x)
  const heightPx = Math.abs(br.y - tl.y)
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || !(widthPx > 0 && heightPx > 0)) {
    return empty
  }
  const frame: Box = {
    left: Math.min(tl.x, br.x),
    top: Math.min(tl.y, br.y),
    right: Math.max(tl.x, br.x),
    bottom: Math.max(tl.y, br.y),
  }
  const requested = options?.budget
  const budget =
    requested !== undefined && Number.isFinite(requested)
      ? Math.min(BUDGET_IMPLICITE_MAX, Math.max(0, Math.floor(requested)))
      : BUDGET_IMPLICITE

  // --- Lattice ---
  // Cells square in pixels: the longer side gets COARSE_CELLS, the other as many as fit.
  const coarsePx = Math.max(widthPx, heightPx) / COARSE_CELLS
  const nx = Math.max(1, Math.round(widthPx / coarsePx))
  const ny = Math.max(1, Math.round(heightPx / coarsePx))
  const cellPx = Math.max(widthPx / nx, heightPx / ny)
  const depthMax = Math.min(MAX_DEPTH, Math.max(0, Math.ceil(Math.log2(cellPx / FINEST_PX))))
  // Lattice units per coarse cell: the centre of a finest cell is still a lattice point.
  const unit = 2 ** (depthMax + 1)
  const NX = nx * unit
  const NY = ny * unit
  const finest = 2
  const xOf = (i: number) => (i === NX ? xMax : xMin + ((xMax - xMin) * i) / NX)
  const yOf = (j: number) => (j === NY ? yMax : yMin + ((yMax - yMin) * j) / NY)
  const keyOf = (i: number, j: number) => i * (NY + 1) + j

  let used = 0
  const evaluate = (x: number, y: number): number => {
    if (used >= budget) return NaN
    used++
    let v: number
    try {
      v = F(x, y)
    } catch {
      return NaN
    }
    return Number.isFinite(v) ? v : NaN
  }
  const cache = new Map<number, number>()
  const value = (i: number, j: number): number => {
    const k = keyOf(i, j)
    const known = cache.get(k)
    if (known !== undefined) return known
    const v = evaluate(xOf(i), yOf(j))
    cache.set(k, v)
    return v
  }
  const known = (i: number, j: number) => cache.has(keyOf(i, j))
  /** 1 when (i, j) would cost an evaluation, else 0. */
  const cost = (i: number, j: number) => (cache.has(keyOf(i, j)) ? 0 : 1)

  // --- 1. Quadtree, breadth first ---
  const refineLimit = Math.floor(budget * REFINE_SHARE)
  const leaves: Cell[] = []
  const finestCells: Cell[] = []
  let level: Cell[] = []
  if ((nx + 1) * (ny + 1) > budget) return empty
  for (let a = 0; a <= nx; a++) {
    for (let b = 0; b <= ny; b++) value(a * unit, b * unit)
  }
  for (let a = 0; a < nx; a++) {
    for (let b = 0; b < ny; b++) level.push({ i: a * unit, j: b * unit, size: unit })
  }

  for (let depth = 0; level.length > 0; depth++) {
    if (depth === depthMax) {
      for (const c of level) finestCells.push(c)
      break
    }
    let centres = 0
    for (const c of level) centres += cost(c.i + c.size / 2, c.j + c.size / 2)
    if (used + centres > refineLimit) {
      // Out of budget: this level is drawn as it is.
      for (const c of level) leaves.push(c)
      break
    }
    const refine = level.filter(needsRefinement)
    let mids = 0
    for (const c of refine) {
      const h = c.size / 2
      mids +=
        cost(c.i + h, c.j) +
        cost(c.i + c.size, c.j + h) +
        cost(c.i + h, c.j + c.size) +
        cost(c.i, c.j + h)
    }
    if (used + mids > refineLimit) {
      for (const c of refine) leaves.push(c)
      break
    }
    const next: Cell[] = []
    for (const c of refine) {
      const h = c.size / 2
      next.push(
        { i: c.i, j: c.j, size: h },
        { i: c.i + h, j: c.j, size: h },
        { i: c.i, j: c.j + h, size: h },
        { i: c.i + h, j: c.j + h, size: h }
      )
    }
    level = next
  }

  function needsRefinement(c: Cell): boolean {
    const s = c.size
    const f0 = value(c.i, c.j)
    const f1 = value(c.i + s, c.j)
    const f2 = value(c.i + s, c.j + s)
    const f3 = value(c.i, c.j + s)
    const fc = value(c.i + s / 2, c.j + s / 2)
    const undefinedCount =
      +Number.isNaN(f0) +
      +Number.isNaN(f1) +
      +Number.isNaN(f2) +
      +Number.isNaN(f3) +
      +Number.isNaN(fc)
    if (undefinedCount === 5) return false
    if (undefinedCount > 0) return true
    const positive = +(f0 >= 0) + +(f1 >= 0) + +(f2 >= 0) + +(f3 >= 0) + +(fc >= 0)
    if (positive !== 0 && positive !== 5) return true
    // F vanishes on a sample: a zero on the lattice, maybe the edge of a V (|x − 1| = 0) that
    // the dip below cannot see. F ≡ 0 has no curve to find.
    const zeros = +(f0 === 0) + +(f1 === 0) + +(f2 === 0) + +(f3 === 0) + +(fc === 0)
    if (zeros > 0) return zeros < 5
    // Same sign everywhere. F bilinear on the cell keeps that sign inside it; only the part of
    // F that bends towards zero (its dip below the corners' mean at the centre) can hide one.
    const a0 = Math.abs(f0)
    const a1 = Math.abs(f1)
    const a2 = Math.abs(f2)
    const a3 = Math.abs(f3)
    const ac = Math.abs(fc)
    const dip = (a0 + a1 + a2 + a3) / 4 - ac
    if (!(dip > 1e-12 * Math.max(a0, a1, a2, a3, ac))) return false
    return Math.min(a0, a1, a2, a3, ac) < DIP_FACTOR * dip
  }

  // --- 2. Marching squares ---
  // Node ids are numbers: an edge is its midpoint's key, doubled, plus 1 when vertical (every
  // marched cell has the same size, so that is unambiguous); a lattice vertex is −(key + 1).
  const vertexId = (i: number, j: number) => -(keyOf(i, j) + 1)
  const crossings = new Map<number, Crossing | null>()
  const nodes = new Map<number, PointSvg>()
  const segments: number[] = []
  const linked = new Map<number, number[]>()
  const addSegment = (a: Crossing | null, b: Crossing | null) => {
    if (!a || !b || a.id === b.id) return
    // Once only: a row of zeros on the lattice is the edge of the cells on both of its sides.
    const fromA = linked.get(a.id)
    if (fromA?.includes(b.id)) return
    if (fromA) fromA.push(b.id)
    else linked.set(a.id, [b.id])
    const fromB = linked.get(b.id)
    if (fromB) fromB.push(a.id)
    else linked.set(b.id, [a.id])
    if (!nodes.has(a.id)) nodes.set(a.id, versSvg(a.x, a.y))
    if (!nodes.has(b.id)) nodes.set(b.id, versSvg(b.x, b.y))
    segments.push(a.id, b.id)
  }

  // The zero on the edge from (ia, ja) to (ib, jb), or null when F does not tend to 0 there.
  const crossing = (ia: number, ja: number, ib: number, jb: number): Crossing | null => {
    const id = keyOf((ia + ib) / 2, (ja + jb) / 2) * 2 + (ia === ib ? 1 : 0)
    const cached = crossings.get(id)
    if (cached !== undefined) return cached
    const result = solveEdge(id, ia, ja, ib, jb)
    crossings.set(id, result)
    return result
  }
  const solveEdge = (
    id: number,
    ia: number,
    ja: number,
    ib: number,
    jb: number
  ): Crossing | null => {
    let fa = value(ia, ja)
    let fb = value(ib, jb)
    if (fa === 0) return { id: vertexId(ia, ja), x: xOf(ia), y: yOf(ja) }
    if (fb === 0) return { id: vertexId(ib, jb), x: xOf(ib), y: yOf(jb) }
    let ax = xOf(ia)
    let ay = yOf(ja)
    let bx = xOf(ib)
    let by = yOf(jb)
    const signA = fa > 0
    for (let step = 0; step < CROSSING_STEPS; step++) {
      const t = fa / (fa - fb)
      const px = ax + t * (bx - ax)
      const py = ay + t * (by - ay)
      const fp = evaluate(px, py)
      if (Number.isNaN(fp)) return null
      // Continuity: across a pole, |F| between the brackets never drops below both ends.
      if (Math.abs(fp) < Math.min(Math.abs(fa), Math.abs(fb))) return { id, x: px, y: py }
      if (fp > 0 === signA) {
        ax = px
        ay = py
        fa = fp
      } else {
        bx = px
        by = py
        fb = fp
      }
    }
    return null
  }

  const changes = (fa: number, fb: number) =>
    !Number.isNaN(fa) && !Number.isNaN(fb) && fa >= 0 !== fb >= 0

  const march = (c: Cell) => {
    const s = c.size
    const i0 = c.i
    const j0 = c.j
    const i1 = i0 + s
    const j1 = j0 + s
    // Corners a (bottom left), b, c, d counterclockwise; edges bottom, right, top, left.
    const fa = value(i0, j0)
    const fb = value(i1, j0)
    const fc = value(i1, j1)
    const fd = value(i0, j1)
    const bottom = changes(fa, fb)
    const right = changes(fb, fc)
    const top = changes(fc, fd)
    const left = changes(fd, fa)
    const count = +bottom + +right + +top + +left
    if (count === 2) {
      const ends: Array<Crossing | null> = []
      if (bottom) ends.push(crossing(i0, j0, i1, j0))
      if (right) ends.push(crossing(i1, j0, i1, j1))
      if (top) ends.push(crossing(i1, j1, i0, j1))
      if (left) ends.push(crossing(i0, j1, i0, j0))
      addSegment(ends[0], ends[1])
      return
    }
    if (count !== 4) return
    // Saddle: the centre tells which pair of opposite corners is joined.
    const ci = i0 + s / 2
    const cj = j0 + s / 2
    const centre = known(ci, cj) || used < budget ? value(ci, cj) : NaN
    const e0 = crossing(i0, j0, i1, j0)
    const e1 = crossing(i1, j0, i1, j1)
    const e2 = crossing(i1, j1, i0, j1)
    const e3 = crossing(i0, j1, i0, j0)
    if (centre === 0) {
      const mid: Crossing = { id: vertexId(ci, cj), x: xOf(ci), y: yOf(cj) }
      for (const e of [e0, e1, e2, e3]) addSegment(e, mid)
      return
    }
    if (!Number.isNaN(centre) && centre >= 0 === fa >= 0) {
      // a and c joined through the centre: b and d are cut off.
      addSegment(e0, e1)
      addSegment(e2, e3)
    } else {
      addSegment(e3, e0)
      addSegment(e1, e2)
    }
  }

  for (const c of leaves) march(c)
  for (const c of finestCells) march(c)

  // --- 3. Double zeros ---
  const touches = new Map<number, { i: number; j: number; v: number }>()
  const touchChecked = new Set<number>()
  const inLattice = (i: number, j: number) => i >= 0 && j >= 0 && i <= NX && j <= NY
  const valley = (i: number, j: number, di: number, dj: number, p: number): boolean => {
    const il = i - di
    const jl = j - dj
    const ir = i + di
    const jr = j + dj
    if (!inLattice(il, jl) || !inLattice(ir, jr)) return false
    if (used + cost(il, jl) + cost(ir, jr) > budget) return false
    const l = value(il, jl)
    const r = value(ir, jr)
    if (Number.isNaN(l) || Number.isNaN(r) || l === 0 || r === 0 || l > 0 !== r > 0) return false
    if (p !== 0 && p > 0 !== l > 0) return false
    const al = Math.abs(l)
    const ar = Math.abs(r)
    const ap = Math.abs(p)
    // A local minimum (ties go to the lower index, so a zero halfway counts once)…
    if (!(ap <= al && ap < ar)) return false
    // …and close enough to 0 for its slope: within TOUCH_STEPS of a V or a parabola's zero.
    // A tie is a parabola's zero halfway, or a plateau beside a jump (floor): only the first
    // is that close for its slope.
    return ap <= (ap === al ? TIE_STEPS : TOUCH_STEPS) * Math.max(al - ap, ar - ap)
  }
  // A double zero changes sign in no direction. Without this, a simple zero where the curve is
  // tangent to an axis (x² + y² = 4 at (2, 0), seen along y) would pass for one.
  const oneSign = (i: number, j: number): boolean => {
    let positive = false
    let negative = false
    for (const [a, b] of [
      [i - finest, j],
      [i + finest, j],
      [i, j - finest],
      [i, j + finest],
    ]) {
      if (!inLattice(a, b)) continue
      if (used + cost(a, b) > budget) return false
      const v = value(a, b)
      if (v > 0) positive = true
      else if (v < 0) negative = true
    }
    return !(positive && negative)
  }
  const checkTouch = (i: number, j: number) => {
    const k = keyOf(i, j)
    if (touchChecked.has(k)) return
    touchChecked.add(k)
    const p = value(i, j)
    if ((valley(i, j, finest, 0, p) || valley(i, j, 0, finest, p)) && oneSign(i, j)) {
      touches.set(k, { i, j, v: Math.abs(p) })
    }
  }
  for (const c of finestCells) {
    const s = c.size
    const f0 = value(c.i, c.j)
    const f1 = value(c.i + s, c.j)
    const f2 = value(c.i + s, c.j + s)
    const f3 = value(c.i, c.j + s)
    if (Number.isNaN(f0) || Number.isNaN(f1) || Number.isNaN(f2) || Number.isNaN(f3)) continue
    const positive = +(f0 >= 0) + +(f1 >= 0) + +(f2 >= 0) + +(f3 >= 0)
    if (positive !== 0 && positive !== 4) continue
    checkTouch(c.i, c.j)
    checkTouch(c.i + s, c.j)
    checkTouch(c.i + s, c.j + s)
    checkTouch(c.i, c.j + s)
  }

  const points: PointSvg[] = []
  if (touches.size > 0) {
    const order = [...touches.keys()].sort((p, q) => p - q)
    const parent = new Map<number, number>(order.map((k) => [k, k]))
    const root = (k: number): number => {
      let r = k
      while (parent.get(r) !== r) r = parent.get(r) as number
      parent.set(k, r)
      return r
    }
    const links: Array<[number, number]> = []
    const has = (i: number, j: number) =>
      i >= 0 && j >= 0 && i <= NX && j <= NY && touches.has(keyOf(i, j))
    for (const k of order) {
      const { i, j } = touches.get(k) as { i: number; j: number }
      const near: Array<[number, number]> = []
      if (has(i + finest, j)) near.push([i + finest, j])
      if (has(i, j + finest)) near.push([i, j + finest])
      // A diagonal only where no square path exists already: keeps the lines one point wide.
      if (has(i + finest, j + finest) && !has(i + finest, j) && !has(i, j + finest)) {
        near.push([i + finest, j + finest])
      }
      if (has(i + finest, j - finest) && !has(i + finest, j) && !has(i, j - finest)) {
        near.push([i + finest, j - finest])
      }
      for (const [ni, nj] of near) {
        const n = keyOf(ni, nj)
        links.push([k, n])
        const rk = root(k)
        const rn = root(n)
        if (rk !== rn) parent.set(Math.max(rk, rn), Math.min(rk, rn))
      }
    }
    const groups = new Map<number, number[]>()
    for (const k of order) {
      const r = root(k)
      const g = groups.get(r)
      if (g) g.push(k)
      else groups.set(r, [k])
    }
    const isolated = new Set<number>()
    for (const [r, members] of groups) {
      const is = members.map((k) => (touches.get(k) as { i: number }).i)
      const js = members.map((k) => (touches.get(k) as { j: number }).j)
      const span = Math.max(Math.max(...is) - Math.min(...is), Math.max(...js) - Math.min(...js))
      if (span > POINT_STEPS * finest) continue
      isolated.add(r)
      let best = members[0]
      for (const k of members) {
        if ((touches.get(k) as { v: number }).v < (touches.get(best) as { v: number }).v) best = k
      }
      const t = touches.get(best) as { i: number; j: number }
      const p = versSvg(xOf(t.i), yOf(t.j))
      if (inside(p, frame)) points.push(p)
    }
    for (const [k, n] of links) {
      if (isolated.has(root(k))) continue
      const a = touches.get(k) as { i: number; j: number }
      const b = touches.get(n) as { i: number; j: number }
      addSegment(
        { id: vertexId(a.i, a.j), x: xOf(a.i), y: yOf(a.j) },
        { id: vertexId(b.i, b.j), x: xOf(b.i), y: yOf(b.j) }
      )
    }
  }

  // --- 4. Polylines ---
  const chemins: PointSvg[][] = []
  const lines = stitch(segments)
    .map((ids) => ids.map((id) => nodes.get(id) as PointSvg))
    .flatMap((line) => clipPolyline(line, frame))
    .map(simplify)
    .filter((line) => line.length >= 2)
  for (const line of lines) {
    const xs = line.map((p) => p.x)
    const ys = line.map((p) => p.y)
    const left = Math.min(...xs)
    const top = Math.min(...ys)
    const width = Math.max(...xs) - left
    const height = Math.max(...ys) - top
    if (width > DOT_PX || height > DOT_PX) {
      chemins.push(line)
      continue
    }
    // A solution smaller than a pixel (a loop round a vertex of the lattice, a crumb at the
    // frame's corner) would be a stroke of no length: a point, unless one is there already.
    const dot = { x: left + width / 2, y: top + height / 2 }
    if (!points.some((p) => Math.hypot(p.x - dot.x, p.y - dot.y) <= DOT_PX)) points.push(dot)
  }
  return { chemins, points }
}

/**
 * Joins segments sharing an end into polylines, in the order the segments came (`ends` holds
 * them flat, two ids each). A loop comes back to its first id, so a closed curve is one
 * polyline whose last point is its first.
 */
function stitch(ends: number[]): number[][] {
  const count = ends.length / 2
  const at = new Map<number, number[]>()
  for (let k = 0; k < ends.length; k++) {
    const list = at.get(ends[k])
    if (list) list.push(k >> 1)
    else at.set(ends[k], [k >> 1])
  }
  const used = new Array<boolean>(count).fill(false)
  const extend = (chain: number[]) => {
    for (;;) {
      const end = chain[chain.length - 1]
      const next = (at.get(end) as number[]).find((n) => !used[n])
      if (next === undefined) return
      used[next] = true
      const a = ends[2 * next]
      chain.push(a === end ? ends[2 * next + 1] : a)
    }
  }
  const lines: number[][] = []
  for (let n = 0; n < count; n++) {
    if (used[n]) continue
    used[n] = true
    const a = ends[2 * n]
    const forward = [a, ends[2 * n + 1]]
    extend(forward)
    if (forward[forward.length - 1] === a) {
      lines.push(forward)
      continue
    }
    const backward = [a]
    extend(backward)
    lines.push(backward.slice(1).reverse().concat(forward))
  }
  return lines
}

function inside(p: PointSvg, box: Box): boolean {
  return p.x >= box.left && p.x <= box.right && p.y >= box.top && p.y <= box.bottom
}

// --- Clipping and simplification, as in `function-plot.ts` ---

function deviation(a: PointSvg, m: PointSvg, b: PointSvg): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l = Math.hypot(dx, dy)
  if (l < 1e-9) return Math.hypot(m.x - a.x, m.y - a.y)
  return Math.abs((m.x - a.x) * dy - (m.y - a.y) * dx) / l
}

/** Liang–Barsky: the part of segment pq inside the box, or null. */
function clipSegment(p: PointSvg, q: PointSvg, box: Box): [PointSvg, PointSvg] | null {
  const dx = q.x - p.x
  const dy = q.y - p.y
  let t0 = 0
  let t1 = 1
  const tests: Array<[number, number]> = [
    [-dx, p.x - box.left],
    [dx, box.right - p.x],
    [-dy, p.y - box.top],
    [dy, box.bottom - p.y],
  ]
  for (const [pk, qk] of tests) {
    if (pk === 0) {
      if (qk < 0) return null
      continue
    }
    const r = qk / pk
    if (pk < 0) {
      if (r > t1) return null
      if (r > t0) t0 = r
    } else {
      if (r < t0) return null
      if (r < t1) t1 = r
    }
  }
  return [
    { x: p.x + t0 * dx, y: p.y + t0 * dy },
    { x: p.x + t1 * dx, y: p.y + t1 * dy },
  ]
}

function samePoint(a: PointSvg, b: PointSvg): boolean {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9
}

function clipPolyline(points: PointSvg[], box: Box): PointSvg[][] {
  const runs: PointSvg[][] = []
  let run: PointSvg[] | null = null
  for (let i = 1; i < points.length; i++) {
    const clipped = clipSegment(points[i - 1], points[i], box)
    if (!clipped) {
      run = null
      continue
    }
    const [c0, c1] = clipped
    if (!run || !samePoint(run[run.length - 1], c0)) {
      run = [c0]
      runs.push(run)
    }
    run.push(c1)
    if (!samePoint(c1, points[i])) run = null
  }
  return runs
}

/**
 * Ramer–Douglas–Peucker with the tolerance of `function-plot.ts`: every dropped point stays
 * within SIMPLIFY_PX of the chord that replaces it. Not the greedy pass of `function-plot.ts`,
 * which is quadratic on the long straight runs a grid produces (x = 3 is 800 points before).
 * A loop keeps its closing point: its first and last points are the same.
 */
function simplify(points: PointSvg[]): PointSvg[] {
  const n = points.length
  if (n <= 2) return points
  const keep = new Array<boolean>(n).fill(false)
  keep[0] = true
  keep[n - 1] = true
  const stack: Array<[number, number]> = [[0, n - 1]]
  while (stack.length > 0) {
    const [a, b] = stack.pop() as [number, number]
    let far = -1
    let worst = SIMPLIFY_PX
    for (let k = a + 1; k < b; k++) {
      const d = deviation(points[a], points[k], points[b])
      if (d > worst) {
        worst = d
        far = k
      }
    }
    if (far < 0) continue
    keep[far] = true
    stack.push([a, far], [far, b])
  }
  return points.filter((_, k) => keep[k])
}
