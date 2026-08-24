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
  }>
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

export function buildDrawingModel(spec: FigureSpec): DrawingModel {
  const pointMap = new Map<string, Pt2>(
    (spec.points ?? []).map((p) => [p.name, { x: p.x, y: p.y }])
  )

  const viewport = computeViewport(spec)
  const toSvg = makeTransform(viewport)

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
    dots.push({ cx: sv.x, cy: sv.y })
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
        label: isLabelTick ? String(value) : undefined,
        labelX: sv.x,
        labelY: sv.y + 18,
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
        labelY: sv.y + 20,
      })
    }

    return { axis, ticks }
  })

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
  }
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
