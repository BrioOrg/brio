// --- Spec types (mirror the JSON schema) ---

export type LabelPlacement =
  | 'auto'
  | 'above'
  | 'below'
  | 'left'
  | 'right'
  | 'above-left'
  | 'above-right'
  | 'below-left'
  | 'below-right'

export type FigurePoint = {
  name: string
  x: number
  y: number
  /** false hides the dot (a point that only builds a curve or an axis end). */
  dot?: boolean
  /** false hides the name; the name still identifies the point in the spec. */
  showName?: boolean
  label?: { placement?: LabelPlacement }
}

export type FigureSegment = {
  from: string
  to: string
}

export type FigurePolygon = {
  vertices: string[]
}

export type FigureCircle =
  | { center: string; through: string; radius?: never }
  | { center: string; radius: number; through?: never }

export type FigureAngleMark = {
  vertex: string
  from: string
  to: string
  right?: boolean
}

export type FigureLengthMark = {
  segment: string
  ticks: 1 | 2 | 3
}

export type FigureLabel = {
  text: string
  x: number
  y: number
}

export type FigureNumberLine = {
  from: number
  to: number
  step: number
  labelEvery?: number
  marks?: Array<{ value: number; label?: string }>
}

export type FigurePolyline = {
  points: string[]
}

export type FigureAxis = {
  from: number
  to: number
  step: number
  labelEvery?: number
  title?: string
}

export type FigureAxes = {
  x: FigureAxis
  y: FigureAxis
  grid?: boolean
}

export type CoordinateSpace = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export type FigureSpec = {
  coordinateSpace?: CoordinateSpace
  points?: FigurePoint[]
  segments?: FigureSegment[]
  polygons?: FigurePolygon[]
  circles?: FigureCircle[]
  angleMarks?: FigureAngleMark[]
  lengthMarks?: FigureLengthMark[]
  labels?: FigureLabel[]
  numberLines?: FigureNumberLine[]
  polylines?: FigurePolyline[]
  axes?: FigureAxes
}

// --- Drawing model (SVG-ready, all coordinates in SVG pixels) ---

export type DrawingSegment = { x1: number; y1: number; x2: number; y2: number }
export type DrawingPolygon = { points: string }
export type DrawingCircle = { cx: number; cy: number; r: number }
export type DrawingRightAngleSquare = { points: string }
export type DrawingAngleArc = { d: string }
export type DrawingLengthTick = { lines: DrawingSegment[] }
export type DrawingDot = { cx: number; cy: number }
export type DrawingPointLabel = {
  text: string
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  baseline: 'auto' | 'hanging' | 'middle'
}
export type DrawingFreeLabel = { text: string; x: number; y: number }
export type DrawingNumberLine = {
  axis: DrawingSegment
  ticks: Array<{
    x1: number
    y1: number
    x2: number
    y2: number
    label?: string
    labelX: number
    labelY: number
    // Numbers sit below the line ('hanging'); a mark's own label sits above it ('auto').
    labelBaseline: 'auto' | 'hanging'
  }>
}

export type DrawingPolyline = { points: string }
/** A positioned text with its own anchor and baseline (axis numbers, titles, the origin). */
export type DrawingText = DrawingPointLabel
export type DrawingAxis = {
  line: DrawingSegment
  arrow: DrawingPolygon
  ticks: Array<DrawingSegment & { label?: DrawingText }>
  title?: DrawingText
}
export type DrawingAxes = {
  x: DrawingAxis
  y: DrawingAxis
  grid: DrawingSegment[]
  origin: DrawingText
}

export type DrawingModel = {
  viewBox: string
  segments: DrawingSegment[]
  polygons: DrawingPolygon[]
  circles: DrawingCircle[]
  rightAngleSquares: DrawingRightAngleSquare[]
  angleArcs: DrawingAngleArc[]
  lengthTicks: DrawingLengthTick[]
  dots: DrawingDot[]
  pointLabels: DrawingPointLabel[]
  freeLabels: DrawingFreeLabel[]
  numberLines: DrawingNumberLine[]
  polylines: DrawingPolyline[]
  axes: DrawingAxes | null
}

// SVG canvas constants (pixels)
const CANVAS_SIZE = 320
const PADDING = 32
const RIGHT_SQUARE_PX = 12
const ARC_RADIUS_PX = 20
const TICK_HALF_LEN_PX = 6
const TICK_SPACING_PX = 5
const LABEL_OFFSET_PX = 14
const MARGIN_RATIO = 0.15
// Repère: the same margin on all four sides, so two axes with equal spans get equal scales.
const AXES_PADDING = 44
const AXIS_OVERSHOOT_PX = 14
const ARROW_LEN_PX = 8
const ARROW_HALF_WIDTH_PX = 4
const AXIS_TICK_HALF_LEN_PX = 4
const AXIS_LABEL_GAP_PX = 6

type Pt2 = { x: number; y: number }

function len(v: Pt2): number {
  return Math.hypot(v.x, v.y)
}

function normalize(v: Pt2): Pt2 {
  const l = len(v)
  if (l < 1e-12) return { x: 0, y: 0 }
  return { x: v.x / l, y: v.y / l }
}

function computeViewport(spec: FigureSpec): CoordinateSpace {
  if (spec.axes) {
    const { x, y } = spec.axes
    return { xMin: x.from, xMax: x.to, yMin: y.from, yMax: y.to }
  }
  if (spec.coordinateSpace) return spec.coordinateSpace

  const xs: number[] = []
  const ys: number[] = []

  for (const p of spec.points ?? []) {
    xs.push(p.x)
    ys.push(p.y)
  }
  for (const lbl of spec.labels ?? []) {
    xs.push(lbl.x)
    ys.push(lbl.y)
  }
  for (const nl of spec.numberLines ?? []) {
    xs.push(nl.from, nl.to)
    ys.push(0)
  }

  if (xs.length === 0) return { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }

  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)

  const dx = xMax - xMin || 1
  const dy = yMax - yMin || 1
  const m = Math.max(dx, dy) * MARGIN_RATIO

  return { xMin: xMin - m, xMax: xMax + m, yMin: yMin - m, yMax: yMax + m }
}

// A repère gives each axis its own scale and fills the frame; any other figure keeps one scale
// for both axes (ADR 0013, amended by #214).
function makeAxesTransform(vp: CoordinateSpace): (lx: number, ly: number) => Pt2 {
  const available = CANVAS_SIZE - 2 * AXES_PADDING
  const scaleX = available / (vp.xMax - vp.xMin)
  const scaleY = available / (vp.yMax - vp.yMin)
  return (lx, ly) => ({
    x: AXES_PADDING + (lx - vp.xMin) * scaleX,
    y: AXES_PADDING + (vp.yMax - ly) * scaleY,
  })
}

function makeTransform(vp: CoordinateSpace): (lx: number, ly: number) => Pt2 {
  const available = CANVAS_SIZE - 2 * PADDING
  const dx = vp.xMax - vp.xMin
  const dy = vp.yMax - vp.yMin
  const scale = Math.min(available / dx, available / dy)
  const renderedW = dx * scale
  const renderedH = dy * scale
  const ox = PADDING + (available - renderedW) / 2
  const oy = PADDING + (available - renderedH) / 2

  return (lx, ly) => ({
    x: ox + (lx - vp.xMin) * scale,
    // Y inversion: math Y increases upward, SVG Y increases downward
    y: oy + (vp.yMax - ly) * scale,
  })
}

function requirePoint(map: Map<string, Pt2>, name: string): Pt2 {
  const p = map.get(name)
  if (!p) throw new Error(`Point "${name}" not found in figure spec`)
  return p
}

function computeLabelPosition(
  dot: Pt2,
  placement: LabelPlacement
): {
  x: number
  y: number
  anchor: DrawingPointLabel['anchor']
  baseline: DrawingPointLabel['baseline']
} {
  const o = LABEL_OFFSET_PX
  switch (placement) {
    case 'above':
      return { x: dot.x, y: dot.y - o, anchor: 'middle', baseline: 'auto' }
    case 'below':
      return { x: dot.x, y: dot.y + o, anchor: 'middle', baseline: 'hanging' }
    case 'left':
      return { x: dot.x - o, y: dot.y, anchor: 'end', baseline: 'middle' }
    case 'right':
      return { x: dot.x + o, y: dot.y, anchor: 'start', baseline: 'middle' }
    case 'above-left':
      return { x: dot.x - o, y: dot.y - o, anchor: 'end', baseline: 'auto' }
    case 'above-right':
      return { x: dot.x + o, y: dot.y - o, anchor: 'start', baseline: 'auto' }
    case 'below-left':
      return { x: dot.x - o, y: dot.y + o, anchor: 'end', baseline: 'hanging' }
    case 'below-right':
      return { x: dot.x + o, y: dot.y + o, anchor: 'start', baseline: 'hanging' }
    default:
      // 'auto': place above-right as a safe default
      return { x: dot.x + o, y: dot.y - o, anchor: 'start', baseline: 'auto' }
  }
}

function findSegment(name: string, segments: FigureSegment[]): FigureSegment | undefined {
  return segments.find((s) => s.from + s.to === name || s.to + s.from === name)
}

function fmt(n: number): string {
  return n.toFixed(2)
}

/**
 * Formats a number the way a French maths page writes it: a true minus sign (−, U+2212) and a
 * decimal comma. Rounds away floating-point noise first, so 0.1 + 0.2 prints as "0,3".
 */
export function formatNumber(n: number): string {
  const rounded = Number(n.toFixed(10))
  const text = String(Math.abs(rounded)).replace('.', ',')
  return rounded < 0 ? `\u2212${text}` : text
}

export function buildDrawingModel(spec: FigureSpec): DrawingModel {
  const pointMap = new Map<string, Pt2>(
    (spec.points ?? []).map((p) => [p.name, { x: p.x, y: p.y }])
  )

  const viewport = computeViewport(spec)
  const toSvg = spec.axes ? makeAxesTransform(viewport) : makeTransform(viewport)

  // Segments
  const segments: DrawingSegment[] = (spec.segments ?? []).map((seg) => {
    const p1 = requirePoint(pointMap, seg.from)
    const p2 = requirePoint(pointMap, seg.to)
    const s1 = toSvg(p1.x, p1.y)
    const s2 = toSvg(p2.x, p2.y)
    return { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y }
  })

  // Polygons
  const polygons: DrawingPolygon[] = (spec.polygons ?? []).map((poly) => {
    const pts = poly.vertices.map((name) => {
      const p = requirePoint(pointMap, name)
      const s = toSvg(p.x, p.y)
      return `${fmt(s.x)},${fmt(s.y)}`
    })
    return { points: pts.join(' ') }
  })

  // Circles
  const circles: DrawingCircle[] = (spec.circles ?? []).map((circle) => {
    const center = requirePoint(pointMap, circle.center)
    const sc = toSvg(center.x, center.y)
    let r: number
    if (circle.through !== undefined) {
      const through = requirePoint(pointMap, circle.through)
      const st = toSvg(through.x, through.y)
      r = Math.hypot(st.x - sc.x, st.y - sc.y)
    } else {
      const edgeSvg = toSvg(center.x + circle.radius, center.y)
      r = Math.abs(edgeSvg.x - sc.x)
    }
    return { cx: sc.x, cy: sc.y, r }
  })

  // Angle marks
  const rightAngleSquares: DrawingRightAngleSquare[] = []
  const angleArcs: DrawingAngleArc[] = []

  for (const am of spec.angleMarks ?? []) {
    const vertex = requirePoint(pointMap, am.vertex)
    const fromPt = requirePoint(pointMap, am.from)
    const toPt = requirePoint(pointMap, am.to)
    const sv = toSvg(vertex.x, vertex.y)
    const sf = toSvg(fromPt.x, fromPt.y)
    const st = toSvg(toPt.x, toPt.y)
    const arm1 = normalize({ x: sf.x - sv.x, y: sf.y - sv.y })
    const arm2 = normalize({ x: st.x - sv.x, y: st.y - sv.y })

    if (am.right) {
      // Open L-shaped square: p1 → p2 → p3
      const p1 = { x: sv.x + arm1.x * RIGHT_SQUARE_PX, y: sv.y + arm1.y * RIGHT_SQUARE_PX }
      const p3 = { x: sv.x + arm2.x * RIGHT_SQUARE_PX, y: sv.y + arm2.y * RIGHT_SQUARE_PX }
      const p2 = { x: p1.x + arm2.x * RIGHT_SQUARE_PX, y: p1.y + arm2.y * RIGHT_SQUARE_PX }
      rightAngleSquares.push({
        points: `${fmt(p1.x)},${fmt(p1.y)} ${fmt(p2.x)},${fmt(p2.y)} ${fmt(p3.x)},${fmt(p3.y)}`,
      })
    } else {
      const arcStart = { x: sv.x + arm1.x * ARC_RADIUS_PX, y: sv.y + arm1.y * ARC_RADIUS_PX }
      const arcEnd = { x: sv.x + arm2.x * ARC_RADIUS_PX, y: sv.y + arm2.y * ARC_RADIUS_PX }
      // 2D cross product to determine sweep direction
      const cross = arm1.x * arm2.y - arm1.y * arm2.x
      const sweep = cross < 0 ? 0 : 1
      angleArcs.push({
        d: `M ${fmt(arcStart.x)} ${fmt(arcStart.y)} A ${ARC_RADIUS_PX} ${ARC_RADIUS_PX} 0 0 ${sweep} ${fmt(arcEnd.x)} ${fmt(arcEnd.y)}`,
      })
    }
  }

  // Length ticks
  const lengthTicks: DrawingLengthTick[] = (spec.lengthMarks ?? []).map((lm) => {
    const rawSeg = findSegment(lm.segment, spec.segments ?? [])
    if (!rawSeg) throw new Error(`Segment "${lm.segment}" not found in segments`)

    const p1 = requirePoint(pointMap, rawSeg.from)
    const p2 = requirePoint(pointMap, rawSeg.to)
    const s1 = toSvg(p1.x, p1.y)
    const s2 = toSvg(p2.x, p2.y)

    const mx = (s1.x + s2.x) / 2
    const my = (s1.y + s2.y) / 2
    const segLen = Math.hypot(s2.x - s1.x, s2.y - s1.y)
    if (segLen < 1) return { lines: [] }

    const dx = (s2.x - s1.x) / segLen
    const dy = (s2.y - s1.y) / segLen
    const px = -dy
    const py = dx

    const lines: DrawingSegment[] = []
    for (let i = 0; i < lm.ticks; i++) {
      const offset = (i - (lm.ticks - 1) / 2) * TICK_SPACING_PX
      const tx = mx + dx * offset
      const ty = my + dy * offset
      lines.push({
        x1: tx + px * TICK_HALF_LEN_PX,
        y1: ty + py * TICK_HALF_LEN_PX,
        x2: tx - px * TICK_HALF_LEN_PX,
        y2: ty - py * TICK_HALF_LEN_PX,
      })
    }
    return { lines }
  })

  // Point dots and labels
  const dots: DrawingDot[] = []
  const pointLabels: DrawingPointLabel[] = []
  for (const p of spec.points ?? []) {
    const sv = toSvg(p.x, p.y)
    if (p.dot !== false) dots.push({ cx: sv.x, cy: sv.y })
    if (p.showName === false) continue
    const placement = p.label?.placement ?? 'auto'
    const pos = computeLabelPosition(sv, placement)
    pointLabels.push({ text: p.name, ...pos })
  }

  // Free labels
  const freeLabels: DrawingFreeLabel[] = (spec.labels ?? []).map((lbl) => {
    const s = toSvg(lbl.x, lbl.y)
    return { text: lbl.text, x: s.x, y: s.y }
  })

  // Number lines
  const numberLines: DrawingNumberLine[] = (spec.numberLines ?? []).map((nl) => {
    const s1 = toSvg(nl.from, 0)
    const s2 = toSvg(nl.to, 0)
    const axis: DrawingSegment = { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y }

    const labelEvery = nl.labelEvery ?? nl.step
    const ticks: DrawingNumberLine['ticks'] = []
    const epsilon = nl.step * 1e-9

    let value = nl.from
    while (value <= nl.to + epsilon) {
      const sv = toSvg(value, 0)
      const stepsFromStart = (value - nl.from) / labelEvery
      const isLabelTick = Math.abs(stepsFromStart - Math.round(stepsFromStart)) < 1e-9
      ticks.push({
        x1: sv.x,
        y1: sv.y - 6,
        x2: sv.x,
        y2: sv.y + 6,
        label: isLabelTick ? formatNumber(value) : undefined,
        labelX: sv.x,
        labelY: sv.y + 18,
        labelBaseline: 'hanging',
      })
      value = nl.from + Math.round((value - nl.from) / nl.step + 1) * nl.step
    }

    for (const mark of nl.marks ?? []) {
      const sv = toSvg(mark.value, 0)
      ticks.push({
        x1: sv.x,
        y1: sv.y - 8,
        x2: sv.x,
        y2: sv.y + 8,
        label: mark.label,
        labelX: sv.x,
        labelY: sv.y - 12,
        labelBaseline: 'auto',
      })
    }

    return { axis, ticks }
  })

  // Polylines
  const polylines: DrawingPolyline[] = (spec.polylines ?? []).map((pl) => ({
    points: pl.points
      .map((name) => {
        const p = requirePoint(pointMap, name)
        const s = toSvg(p.x, p.y)
        return `${fmt(s.x)},${fmt(s.y)}`
      })
      .join(' '),
  }))

  const axes = spec.axes ? buildAxes(spec.axes, toSvg) : null

  return {
    viewBox: `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`,
    segments,
    polygons,
    circles,
    rightAngleSquares,
    angleArcs,
    lengthTicks,
    dots,
    pointLabels,
    freeLabels,
    numberLines,
    polylines,
    axes,
  }
}

/** Values k × step (k integer) inside [from, to]: ticks are aligned on the origin. */
function axisValues(axis: FigureAxis): number[] {
  const first = Math.ceil(axis.from / axis.step - 1e-9)
  const last = Math.floor(axis.to / axis.step + 1e-9)
  const values: number[] = []
  for (let k = first; k <= last; k++) values.push(k * axis.step)
  return values
}

function isMultiple(value: number, of: number): boolean {
  const q = value / of
  return Math.abs(q - Math.round(q)) < 1e-9
}

function buildAxes(spec: FigureAxes, toSvg: (lx: number, ly: number) => Pt2): DrawingAxes {
  const { x, y } = spec
  const origin = toSvg(0, 0)
  const xValues = axisValues(x)
  const yValues = axisValues(y)

  const xStart = toSvg(x.from, 0)
  const xEnd = toSvg(x.to, 0)
  const xTip = { x: xEnd.x + AXIS_OVERSHOOT_PX, y: origin.y }
  const xAxis: DrawingAxis = {
    line: { x1: xStart.x, y1: origin.y, x2: xTip.x, y2: xTip.y },
    arrow: {
      points: [
        [xTip.x, xTip.y],
        [xTip.x - ARROW_LEN_PX, xTip.y - ARROW_HALF_WIDTH_PX],
        [xTip.x - ARROW_LEN_PX, xTip.y + ARROW_HALF_WIDTH_PX],
      ]
        .map(([a, b]) => `${fmt(a)},${fmt(b)}`)
        .join(' '),
    },
    ticks: xValues.map((v) => {
      const sv = toSvg(v, 0)
      const labelled = v !== 0 && isMultiple(v, x.labelEvery ?? x.step)
      return {
        x1: sv.x,
        y1: sv.y - AXIS_TICK_HALF_LEN_PX,
        x2: sv.x,
        y2: sv.y + AXIS_TICK_HALF_LEN_PX,
        label: labelled
          ? {
              text: formatNumber(v),
              x: sv.x,
              y: sv.y + AXIS_TICK_HALF_LEN_PX + AXIS_LABEL_GAP_PX,
              anchor: 'middle',
              baseline: 'hanging',
            }
          : undefined,
      }
    }),
    title: x.title
      ? {
          text: x.title,
          x: xTip.x,
          y: xTip.y - AXIS_LABEL_GAP_PX - ARROW_HALF_WIDTH_PX,
          anchor: 'end',
          baseline: 'auto',
        }
      : undefined,
  }

  const yStart = toSvg(0, y.from)
  const yEnd = toSvg(0, y.to)
  const yTip = { x: origin.x, y: yEnd.y - AXIS_OVERSHOOT_PX }
  const yAxis: DrawingAxis = {
    line: { x1: origin.x, y1: yStart.y, x2: yTip.x, y2: yTip.y },
    arrow: {
      points: [
        [yTip.x, yTip.y],
        [yTip.x - ARROW_HALF_WIDTH_PX, yTip.y + ARROW_LEN_PX],
        [yTip.x + ARROW_HALF_WIDTH_PX, yTip.y + ARROW_LEN_PX],
      ]
        .map(([a, b]) => `${fmt(a)},${fmt(b)}`)
        .join(' '),
    },
    ticks: yValues.map((v) => {
      const sv = toSvg(0, v)
      const labelled = v !== 0 && isMultiple(v, y.labelEvery ?? y.step)
      return {
        x1: sv.x - AXIS_TICK_HALF_LEN_PX,
        y1: sv.y,
        x2: sv.x + AXIS_TICK_HALF_LEN_PX,
        y2: sv.y,
        label: labelled
          ? {
              text: formatNumber(v),
              x: sv.x - AXIS_TICK_HALF_LEN_PX - AXIS_LABEL_GAP_PX,
              y: sv.y,
              anchor: 'end',
              baseline: 'middle',
            }
          : undefined,
      }
    }),
    title: y.title
      ? {
          text: y.title,
          x: yTip.x + AXIS_LABEL_GAP_PX + ARROW_HALF_WIDTH_PX,
          y: yTip.y,
          anchor: 'start',
          baseline: 'middle',
        }
      : undefined,
  }

  const grid: DrawingSegment[] = []
  if (spec.grid) {
    for (const v of xValues) {
      const bottom = toSvg(v, y.from)
      const top = toSvg(v, y.to)
      grid.push({ x1: bottom.x, y1: bottom.y, x2: top.x, y2: top.y })
    }
    for (const v of yValues) {
      const left = toSvg(x.from, v)
      const right = toSvg(x.to, v)
      grid.push({ x1: left.x, y1: left.y, x2: right.x, y2: right.y })
    }
  }

  // A single "0" below-left of the crossing, instead of one on each axis.
  const originLabel: DrawingText = {
    text: '0',
    x: origin.x - AXIS_LABEL_GAP_PX,
    y: origin.y + AXIS_LABEL_GAP_PX,
    anchor: 'end',
    baseline: 'hanging',
  }

  return { x: xAxis, y: yAxis, grid, origin: originLabel }
}

// --- Geometry validation helpers (used by check-content.mjs and tests) ---

export function dotProduct(v1: Pt2, v2: Pt2): number {
  return v1.x * v2.x + v1.y * v2.y
}

export function euclideanLength(p1: Pt2, p2: Pt2): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y)
}

export function angleDegrees(vertex: Pt2, fromPt: Pt2, toPt: Pt2): number {
  const arm1 = { x: fromPt.x - vertex.x, y: fromPt.y - vertex.y }
  const arm2 = { x: toPt.x - vertex.x, y: toPt.y - vertex.y }
  const l1 = len(arm1)
  const l2 = len(arm2)
  if (l1 < 1e-12 || l2 < 1e-12) return NaN
  const cosA = Math.max(-1, Math.min(1, dotProduct(arm1, arm2) / (l1 * l2)))
  return (Math.acos(cosA) * 180) / Math.PI
}

export function isCollinear(pts: Pt2[]): boolean {
  if (pts.length < 3) return true
  const [p0, p1] = pts
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  for (let i = 2; i < pts.length; i++) {
    const cross = (pts[i].x - p0.x) * dy - (pts[i].y - p0.y) * dx
    if (Math.abs(cross) > 1e-9) return false
  }
  return true
}
