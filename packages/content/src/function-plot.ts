// Curves of functions given by their expression, in a figure with axes (ADR 0038). Pure: the
// spec and the figure's transform in, an SVG-ready model out. The web renderer only maps it.

import { parseExpression, type Expression } from './expression'
import type { DrawingAxes, DrawingSegment, DrawingText } from './figure'
import type { Tone } from './tone'

// --- Spec types (mirror the JSON schema) ---

export type FigureFunction = {
  /** One letter, optionally followed by a digit: f, g, h, f1. Readings refer to it. */
  name: string
  /** The expression of f(x), as written on paper: "2x + 1", "x² − 3", "1/x", "√x", "a x + b". */
  expr: string
  /** Where f is drawn, inside the x axis. Default: the whole x axis. */
  domain?: [number, number]
  /** true writes 𝒞_f next to the curve; a string writes that text instead ("Tarif A"). */
  label?: boolean | string
  style?: 'solid' | 'dashed'
  /**
   * A maths tone (ADR 0037): the curve and its name take it, to match the same tone in the
   * formula of the prose (`\tone{n}{…}`). Without it, the curve is in ink.
   */
  tone?: Tone
}

/** Reading the image of x (x given), or the antecedents of y (y given, solved numerically). */
export type FigureReading =
  { function: string; x: number; y?: never } | { function: string; y: number; x?: never }

/** A letter of the expressions that a slider moves; a printed page uses `value`. */
export type FigureParameter = {
  name: string
  min: number
  max: number
  step: number
  value: number
}

type Window = { xMin: number; xMax: number; yMin: number; yMax: number }

/** The part of a figure spec this module reads. */
export type FunctionPlotSpec = {
  axes?: { x: { from: number; to: number }; y: { from: number; to: number } }
  functions?: FigureFunction[]
  readings?: FigureReading[]
  parameters?: FigureParameter[]
}

// --- Drawing model ---

export type DrawingFunctionCurve = {
  name: string
  d: string
  dashed: boolean
  tone?: Tone
}
/** Centred on (x, y): the script C and its subscript, or the author's own text. */
export type DrawingCurveLabel = {
  name: string
  x: number
  y: number
  tone?: Tone
} & ({ kind: 'curve'; subscript: string } | { kind: 'text'; text: string })
export type DrawingReading = {
  guides: DrawingSegment[]
  dots: Array<{ cx: number; cy: number }>
  values: DrawingText[]
}
export type DrawingFunctionPlot = {
  curves: DrawingFunctionCurve[]
  labels: DrawingCurveLabel[]
  readings: DrawingReading[]
}

type Pt = { x: number; y: number }
type ToSvg = (lx: number, ly: number) => Pt
type Box = { left: number; top: number; right: number; bottom: number }

// --- Compiling the spec ---

/** The letters a slider can move: their default values, overridden by the ones given. */
export function parameterScope(
  spec: FunctionPlotSpec,
  overrides: Readonly<Record<string, number>> = {}
): Record<string, number> {
  const scope: Record<string, number> = {}
  for (const p of spec.parameters ?? []) {
    const v = overrides[p.name]
    scope[p.name] = typeof v === 'number' && Number.isFinite(v) ? v : p.value
  }
  return scope
}

export type CompiledFunction = {
  fn: FigureFunction
  expression: Expression
  /** Where it is drawn and read: its domain inside the x axis. */
  from: number
  to: number
}

/** Each function's parsed expression; throws a French message on the first unreadable one. */
export function compileFunctions(spec: FunctionPlotSpec): Map<string, CompiledFunction> {
  const variables = ['x', ...(spec.parameters ?? []).map((p) => p.name)]
  const out = new Map<string, CompiledFunction>()
  const xAxis = spec.axes?.x ?? { from: -Infinity, to: Infinity }
  for (const fn of spec.functions ?? []) {
    const parsed = parseExpression(fn.expr, { variables })
    if (!parsed.ok) throw new Error(`Fonction ${fn.name} : ${parsed.error.message}`)
    const [a, b] = fn.domain ?? [xAxis.from, xAxis.to]
    out.set(fn.name, {
      fn,
      expression: parsed.expression,
      from: Math.max(a, xAxis.from),
      to: Math.min(b, xAxis.to),
    })
  }
  return out
}

/** f as a function of x alone, the parameters fixed. NaN where it is not defined. */
export function bindFunction(
  compiled: CompiledFunction,
  scope: Readonly<Record<string, number>>
): (x: number) => number {
  const vars: Record<string, number> = { ...scope, x: 0 }
  return (x) => {
    vars.x = x
    return compiled.expression.evaluate(vars)
  }
}

// --- Adaptive sampling ---

const INITIAL_INTERVALS = 160
const MAX_DEPTH = 16
/** A chord is accepted when the curve's midpoint is this close to it, in pixels. */
const TOLERANCE_PX = 0.2
/** At the deepest level, a step this tall is a discontinuity (a pole), not a steep curve. */
const JUMP_PX = 8
const EVALUATION_BUDGET = 60000
const SIMPLIFY_PX = 0.08

function deviation(a: Pt, m: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l = Math.hypot(dx, dy)
  if (l < 1e-9) return Math.hypot(m.x - a.x, m.y - a.y)
  return Math.abs((m.x - a.x) * dy - (m.y - a.y) * dx) / l
}

/**
 * Samples f on [a, b] into polylines in SVG pixels, clipped to the axes window. Each polyline is
 * a piece where f is defined and continuous: the path stops where f is not defined (√x for
 * x < 0) and on either side of a pole (1/x), so no vertical line ever crosses an asymptote.
 */
export function sampleCurve(
  f: (x: number) => number,
  a: number,
  b: number,
  win: Window,
  toSvg: ToSvg
): Pt[][] {
  const pieces: Pt[][] = []
  if (!(b > a)) return pieces
  let current: Pt[] | null = null
  let budget = EVALUATION_BUDGET
  const evaluate = (x: number) => {
    budget--
    return f(x)
  }
  const emit = (x: number, y: number) => {
    if (!current) {
      current = []
      pieces.push(current)
    }
    current.push(toSvg(x, y))
  }
  const cut = () => {
    current = null
  }
  const side = (y: number) => (y > win.yMax ? 1 : y < win.yMin ? -1 : 0)

  // Between a defined x and an undefined one, the last defined point before the edge.
  const edge = (xd: number, yd: number, xu: number): Pt => {
    for (let i = 0; i < 48; i++) {
      const xm = (xd + xu) / 2
      const ym = evaluate(xm)
      if (Number.isFinite(ym)) {
        xd = xm
        yd = ym
      } else {
        xu = xm
      }
    }
    return { x: xd, y: yd }
  }

  // Emits the points after (x0, y0) up to (x1, y1), cutting the path where f is not defined.
  const refine = (x0: number, y0: number, x1: number, y1: number, depth: number): void => {
    const d0 = Number.isFinite(y0)
    const d1 = Number.isFinite(y1)
    if (!d0 && !d1) {
      // A defined island narrower than a sampling step, e.g. √(x(1 − x)) around 0,5.
      if (depth < 4 && budget > 0) {
        const xm = (x0 + x1) / 2
        const ym = evaluate(xm)
        if (Number.isFinite(ym)) {
          refine(x0, y0, xm, ym, depth + 1)
          refine(xm, ym, x1, y1, depth + 1)
        }
      }
      return
    }
    if (d0 && !d1) {
      const e = edge(x0, y0, x1)
      smooth(x0, y0, e.x, e.y, depth)
      cut()
      return
    }
    if (!d0 && d1) {
      const e = edge(x1, y1, x0)
      cut()
      emit(e.x, e.y)
      smooth(e.x, e.y, x1, y1, depth)
      return
    }
    smooth(x0, y0, x1, y1, depth)
  }

  // Both ends defined; the current piece ends at (x0, y0).
  const smooth = (x0: number, y0: number, x1: number, y1: number, depth: number): void => {
    if (!(x1 > x0)) return
    const xm = (x0 + x1) / 2
    const ym = evaluate(xm)
    if (!Number.isFinite(ym)) {
      refine(x0, y0, xm, ym, depth + 1)
      refine(xm, ym, x1, y1, depth + 1)
      return
    }
    const s0 = side(y0)
    if (s0 !== 0 && s0 === side(y1) && s0 === side(ym)) {
      // Wholly above (or below) the window: the clipping drops it, no need for detail.
      emit(x1, y1)
      return
    }
    const p0 = toSvg(x0, y0)
    const p1 = toSvg(x1, y1)
    if (depth >= MAX_DEPTH || budget <= 0) {
      if (budget > 0 && Math.abs(p1.y - p0.y) > JUMP_PX) cut()
      emit(x1, y1)
      return
    }
    const pm = toSvg(xm, ym)
    const between = (pm.y - p0.y) * (pm.y - p1.y) <= 0
    if (deviation(p0, pm, p1) <= TOLERANCE_PX && between) {
      emit(x1, y1)
      return
    }
    smooth(x0, y0, xm, ym, depth + 1)
    smooth(xm, ym, x1, y1, depth + 1)
  }

  let xPrev = a
  let yPrev = evaluate(a)
  if (Number.isFinite(yPrev)) emit(a, yPrev)
  for (let i = 1; i <= INITIAL_INTERVALS; i++) {
    const x = i === INITIAL_INTERVALS ? b : a + ((b - a) * i) / INITIAL_INTERVALS
    const y = evaluate(x)
    refine(xPrev, yPrev, x, y, 0)
    xPrev = x
    yPrev = y
  }

  const tl = toSvg(win.xMin, win.yMax)
  const br = toSvg(win.xMax, win.yMin)
  const rect: Box = { left: tl.x, top: tl.y, right: br.x, bottom: br.y }
  return pieces
    .flatMap((piece) => clipPolyline(piece, rect))
    .map(simplify)
    .filter((p) => p.length >= 2)
}

/** Liang–Barsky: the part of segment pq inside the box, or null. */
function clipSegment(p: Pt, q: Pt, box: Box): [Pt, Pt] | null {
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

function samePoint(a: Pt, b: Pt): boolean {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9
}

function clipPolyline(points: Pt[], box: Box): Pt[][] {
  const runs: Pt[][] = []
  let run: Pt[] | null = null
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
 * Drops the points that lie on the chord of their neighbours, checked against every dropped
 * point since the last one kept (a straight line keeps its two ends).
 */
function simplify(points: Pt[]): Pt[] {
  if (points.length <= 2) return points
  const out: Pt[] = [points[0]]
  let anchor = 0
  for (let i = 2; i < points.length; i++) {
    let fits = true
    for (let k = anchor + 1; k < i && fits; k++) {
      fits = deviation(points[anchor], points[k], points[i]) <= SIMPLIFY_PX
    }
    if (!fits) {
      anchor = i - 1
      out.push(points[anchor])
    }
  }
  out.push(points[points.length - 1])
  return out
}

function pathOf(points: Pt[]): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')
}

// --- Solving f(x) = y ---

const SOLVE_SAMPLES = 800

/**
 * The x of [a, b] where f(x) = target: sign changes refined by bisection (a pole, where f jumps
 * across the target without reaching it, is rejected), and the points where the curve only
 * touches the line (x² = 0). Rounded to 1e-9, so 2,0000000001 reads 2.
 */
export function solveFor(f: (x: number) => number, target: number, a: number, b: number): number[] {
  if (!(b > a)) return []
  const g = (x: number) => f(x) - target
  const xs: number[] = []
  const gs: number[] = []
  for (let i = 0; i <= SOLVE_SAMPLES; i++) {
    const x = a + ((b - a) * i) / SOLVE_SAMPLES
    xs.push(x)
    gs.push(g(x))
  }
  const accept = (x: number) =>
    Number.isFinite(g(x)) && Math.abs(g(x)) <= 1e-7 * (1 + Math.abs(target))
  const roots: number[] = []
  for (let i = 0; i <= SOLVE_SAMPLES; i++) {
    if (gs[i] === 0) roots.push(xs[i])
    if (i === 0) continue
    const [ga, gb] = [gs[i - 1], gs[i]]
    if (!Number.isFinite(ga) || !Number.isFinite(gb)) continue
    if (ga * gb < 0) {
      let [lo, hi] = [xs[i - 1], xs[i]]
      for (let k = 0; k < 80; k++) {
        const mid = (lo + hi) / 2
        const gm = g(mid)
        if (!Number.isFinite(gm)) break
        if (Math.sign(gm) === Math.sign(ga)) lo = mid
        else hi = mid
      }
      const r = (lo + hi) / 2
      if (accept(r)) roots.push(r)
    }
    // A touching point: |g| has a local minimum between two samples of the same sign.
    if (i < SOLVE_SAMPLES) {
      const gc = gs[i + 1]
      if (
        Number.isFinite(gc) &&
        ga * gb > 0 &&
        gb * gc > 0 &&
        Math.abs(gb) <= Math.abs(ga) &&
        Math.abs(gb) <= Math.abs(gc)
      ) {
        let [lo, hi] = [xs[i - 1], xs[i + 1]]
        for (let k = 0; k < 100; k++) {
          const m1 = lo + (hi - lo) / 3
          const m2 = hi - (hi - lo) / 3
          if (Math.abs(g(m1)) < Math.abs(g(m2))) hi = m2
          else lo = m1
        }
        const r = (lo + hi) / 2
        if (Math.abs(g(r)) <= 1e-9 * (1 + Math.abs(target))) roots.push(r)
      }
    }
  }
  roots.sort((p, q) => p - q)
  const out: number[] = []
  for (const r of roots) {
    const snapped = Math.round(r * 1e9) / 1e9
    if (out.length === 0 || snapped - out[out.length - 1] > (b - a) * 1e-6) out.push(snapped)
  }
  return out
}

// --- Numbers written on the figure ---

function frenchNumber(n: number): string {
  const rounded = Number(n.toFixed(10))
  const text = String(Math.abs(rounded)).replace('.', ',')
  return rounded < 0 ? `−${text}` : text
}

/** A value read on the graph: to the hundredth, with ≈ when it is not exact. */
export function formatReadingValue(v: number): string {
  const r = Math.round(v * 100) / 100
  const exact = Math.abs(v - r) < 1e-9
  return exact ? frenchNumber(r) : `≈ ${frenchNumber(r)}`
}

// --- Placing text without collisions ---

const READING_FONT_PX = 11
const CHAR_PX = 6.2
const VALUE_GAP_PX = 10
const LABEL_GAP_PX = 5
/** Around a read value, the room where no graduation number stays (see clearReadValues). */
const READ_VALUE_MARGIN_PX = 10

function textBox(t: DrawingText, fontPx = READING_FONT_PX): Box {
  const w = t.text.length * CHAR_PX * (fontPx / READING_FONT_PX)
  const h = fontPx + 2
  const left = t.anchor === 'start' ? t.x : t.anchor === 'end' ? t.x - w : t.x - w / 2
  const top = t.baseline === 'hanging' ? t.y : t.baseline === 'auto' ? t.y - h : t.y - h / 2
  return { left, top, right: left + w, bottom: top + h }
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

function inflate(b: Box, by: number): Box {
  return { left: b.left - by, top: b.top - by, right: b.right + by, bottom: b.bottom + by }
}

function boxCrosses(box: Box, polyline: Pt[]): boolean {
  for (let i = 1; i < polyline.length; i++) {
    if (clipSegment(polyline[i - 1], polyline[i], box)) return true
  }
  return false
}

const CURVE_LABEL_FRACTIONS = [0.88, 0.76, 0.64, 0.94, 0.52, 0.4, 0.28, 0.16, 0.06]

function curveLabelSize(fn: FigureFunction): { w: number; h: number } {
  if (typeof fn.label === 'string') return { w: fn.label.length * 6.6, h: 15 }
  return { w: 12 + 6 * fn.name.length, h: 18 }
}

/** A point at a fraction of the arc length of the pieces, with the direction of the curve. */
function pointAlong(pieces: Pt[][], fraction: number): { p: Pt; t: Pt } | null {
  const lengths = pieces.map((piece) =>
    piece.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - piece[i].x, q.y - piece[i].y), 0)
  )
  const total = lengths.reduce((s, l) => s + l, 0)
  if (total < 1) return null
  let remaining = fraction * total
  for (let k = 0; k < pieces.length; k++) {
    const piece = pieces[k]
    if (remaining > lengths[k]) {
      remaining -= lengths[k]
      continue
    }
    for (let i = 1; i < piece.length; i++) {
      const a = piece[i - 1]
      const b = piece[i]
      const l = Math.hypot(b.x - a.x, b.y - a.y)
      if (remaining <= l || i === piece.length - 1) {
        const u = l < 1e-9 ? 0 : Math.min(1, remaining / l)
        return {
          p: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u },
          t: l < 1e-9 ? { x: 1, y: 0 } : { x: (b.x - a.x) / l, y: (b.y - a.y) / l },
        }
      }
      remaining -= l
    }
  }
  return null
}

function placeCurveLabel(
  fn: FigureFunction,
  pieces: Pt[][],
  allCurves: Pt[][],
  obstacles: Box[],
  rect: Box
): DrawingCurveLabel | null {
  const { w, h } = curveLabelSize(fn)
  for (const fraction of CURVE_LABEL_FRACTIONS) {
    const at = pointAlong(pieces, fraction)
    if (!at) return null
    // Above the curve first (smaller y on screen), then below.
    const n = { x: -at.t.y, y: at.t.x }
    const normals = n.y <= 0 ? [n, { x: -n.x, y: -n.y }] : [{ x: -n.x, y: -n.y }, n]
    for (const nv of normals) {
      const reach = LABEL_GAP_PX + (Math.abs(nv.x) * w) / 2 + (Math.abs(nv.y) * h) / 2
      const c = { x: at.p.x + nv.x * reach, y: at.p.y + nv.y * reach }
      const box: Box = {
        left: c.x - w / 2,
        top: c.y - h / 2,
        right: c.x + w / 2,
        bottom: c.y + h / 2,
      }
      if (
        box.left < rect.left ||
        box.right > rect.right ||
        box.top < rect.top ||
        box.bottom > rect.bottom
      ) {
        continue
      }
      const padded = inflate(box, 1.5)
      if (allCurves.some((poly) => boxCrosses(padded, poly))) continue
      if (obstacles.some((o) => overlaps(padded, o))) continue
      obstacles.push(box)
      const placed = { name: fn.name, x: c.x, y: c.y, ...(fn.tone ? { tone: fn.tone } : {}) }
      return typeof fn.label === 'string'
        ? { ...placed, kind: 'text', text: fn.label }
        : { ...placed, kind: 'curve', subscript: fn.name }
    }
  }
  return null
}

// --- The plot ---

function readingValue(
  text: string,
  at: Pt,
  axis: 'x' | 'y',
  origin: Pt,
  fromBelow: boolean
): DrawingText {
  if (axis === 'x') {
    // Under the axis like the graduations, unless the guide comes up from below the axis.
    return fromBelow
      ? { text, x: at.x, y: origin.y - VALUE_GAP_PX + 4, anchor: 'middle', baseline: 'auto' }
      : { text, x: at.x, y: origin.y + VALUE_GAP_PX, anchor: 'middle', baseline: 'hanging' }
  }
  // Left of the axis like the graduations, unless the guide comes from the left.
  return fromBelow
    ? { text, x: origin.x + VALUE_GAP_PX, y: at.y, anchor: 'start', baseline: 'middle' }
    : { text, x: origin.x - VALUE_GAP_PX, y: at.y, anchor: 'end', baseline: 'middle' }
}

function nonZero(s: DrawingSegment): boolean {
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 0.5
}

/**
 * Curves, their names and the readings of a figure with axes. Throws a French message when an
 * expression cannot be read (the editor shows it; check-content stops it before publication).
 */
export function buildFunctionPlot(
  spec: FunctionPlotSpec,
  toSvg: ToSvg,
  parameterValues: Readonly<Record<string, number>> = {}
): DrawingFunctionPlot | null {
  if (!spec.axes || (spec.functions ?? []).length === 0) return null
  const win: Window = {
    xMin: spec.axes.x.from,
    xMax: spec.axes.x.to,
    yMin: spec.axes.y.from,
    yMax: spec.axes.y.to,
  }
  const compiled = compileFunctions(spec)
  const scope = parameterScope(spec, parameterValues)
  const origin = toSvg(0, 0)
  const tl = toSvg(win.xMin, win.yMax)
  const br = toSvg(win.xMax, win.yMin)
  const rect: Box = { left: tl.x, top: tl.y, right: br.x, bottom: br.y }

  const sampled = [...compiled.values()].map((c) => ({
    c,
    f: bindFunction(c, scope),
    pieces: sampleCurve(bindFunction(c, scope), c.from, c.to, win, toSvg),
  }))
  const curves: DrawingFunctionCurve[] = sampled.flatMap(({ c, pieces }) =>
    pieces.map((piece) => ({
      name: c.fn.name,
      d: pathOf(piece),
      dashed: c.fn.style === 'dashed',
      ...(c.fn.tone ? { tone: c.fn.tone } : {}),
    }))
  )

  const readings: DrawingReading[] = []
  for (const r of spec.readings ?? []) {
    const entry = sampled.find((s) => s.c.fn.name === r.function)
    if (!entry) continue
    const inside = (x: number, y: number) =>
      x >= win.xMin - 1e-9 && x <= win.xMax + 1e-9 && y >= win.yMin - 1e-9 && y <= win.yMax + 1e-9
    const reading: DrawingReading = { guides: [], dots: [], values: [] }
    if (r.x !== undefined) {
      const y = entry.f(r.x)
      if (!Number.isFinite(y) || r.x < entry.c.from - 1e-9 || r.x > entry.c.to + 1e-9) continue
      if (!inside(r.x, y)) continue
      const p = toSvg(r.x, y)
      const foot = toSvg(r.x, 0)
      const side = toSvg(0, y)
      reading.guides.push(
        { x1: foot.x, y1: foot.y, x2: p.x, y2: p.y },
        { x1: p.x, y1: p.y, x2: side.x, y2: side.y }
      )
      reading.dots.push({ cx: p.x, cy: p.y })
      if (Math.abs(r.x) > 1e-12) {
        reading.values.push(readingValue(formatReadingValue(r.x), p, 'x', origin, y < 0))
      }
      if (Math.abs(y) > 1e-12) {
        reading.values.push(readingValue(formatReadingValue(y), p, 'y', origin, r.x < 0))
      }
    } else {
      const roots = solveFor(entry.f, r.y, entry.c.from, entry.c.to)
      if (roots.length === 0 || !inside(roots[0], r.y)) continue
      const lo = Math.min(0, ...roots)
      const hi = Math.max(0, ...roots)
      const a = toSvg(lo, r.y)
      const b = toSvg(hi, r.y)
      const axisAt = toSvg(0, r.y)
      // The value sits left of the y axis like its graduation, unless every antecedent is on
      // the left: then it moves right, where no guide comes. A guide from the left stops short
      // of the value instead of running through it.
      const value =
        Math.abs(r.y) > 1e-12
          ? readingValue(formatReadingValue(r.y), axisAt, 'y', origin, hi <= 1e-12)
          : null
      if (value) reading.values.push(value)
      const valueOnLeft = value !== null && value.anchor === 'end'
      if (lo < 0 && valueOnLeft) {
        const stop = textBox(value).left - 3
        reading.guides.push({ x1: a.x, y1: a.y, x2: Math.max(a.x, stop), y2: a.y })
        reading.guides.push({ x1: axisAt.x, y1: a.y, x2: b.x, y2: b.y })
      } else {
        reading.guides.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
      }
      for (const x of roots) {
        const p = toSvg(x, r.y)
        const foot = toSvg(x, 0)
        reading.guides.push({ x1: p.x, y1: p.y, x2: foot.x, y2: foot.y })
        reading.dots.push({ cx: p.x, cy: p.y })
        if (Math.abs(x) > 1e-12) {
          reading.values.push(readingValue(formatReadingValue(x), p, 'x', origin, r.y < 0))
        }
      }
    }
    reading.guides = reading.guides.filter(nonZero)
    readings.push(reading)
  }

  // What a curve's name must not cover: the axes, their graduations, the readings.
  const obstacles: Box[] = [
    { left: rect.left, top: origin.y - 2, right: rect.right, bottom: origin.y + 20 },
    { left: origin.x - 30, top: rect.top, right: origin.x + 2, bottom: rect.bottom },
    ...readings.flatMap((r) => [
      ...r.values.map((v) => textBox(v)),
      ...r.guides.map((g) =>
        inflate(
          {
            left: Math.min(g.x1, g.x2),
            top: Math.min(g.y1, g.y2),
            right: Math.max(g.x1, g.x2),
            bottom: Math.max(g.y1, g.y2),
          },
          2
        )
      ),
    ]),
  ]
  const allCurves = sampled.flatMap((s) => s.pieces)
  const labels: DrawingCurveLabel[] = []
  for (const { c, pieces } of sampled) {
    if (!c.fn.label) continue
    const label = placeCurveLabel(c.fn, pieces, allCurves, obstacles, rect)
    if (label) labels.push(label)
  }

  return { curves, labels, readings }
}

/**
 * The axes with the graduation numbers a reading writes over removed: the reading's own value,
 * in the reading colour, replaces them (2,5 next to a printed 2 would be unreadable).
 */
export function clearReadValues(axes: DrawingAxes, plot: DrawingFunctionPlot | null): DrawingAxes {
  if (!plot || plot.readings.length === 0) return axes
  // Not only an overlap: a graduation number almost touching the value ("0,5" against "1")
  // reads as one number, so the margin is about a short number's width across, a little
  // along the axis.
  const taken = plot.readings.flatMap((r) =>
    r.values.map((v) => {
      const b = textBox(v)
      return {
        left: b.left - READ_VALUE_MARGIN_PX,
        right: b.right + READ_VALUE_MARGIN_PX,
        top: b.top - READ_VALUE_MARGIN_PX / 2,
        bottom: b.bottom + READ_VALUE_MARGIN_PX / 2,
      }
    })
  )
  const clear = (axis: DrawingAxes['x']): DrawingAxes['x'] => ({
    ...axis,
    ticks: axis.ticks.map((t) =>
      t.label && taken.some((b) => overlaps(b, textBox(t.label!))) ? { ...t, label: undefined } : t
    ),
  })
  return { ...axes, x: clear(axes.x), y: clear(axes.y) }
}
