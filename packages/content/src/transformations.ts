// Plane transformations, vectors, lines and rays in a `figure` block (ADR 0041).
//
// The author names the points and says which transformation applies to which of them; this module
// computes the images (A → A′), the figure they form, the textbook construction marks, and the
// motion the interactive mode plays from the source to the image. figure.ts draws everything with
// its own primitives: an image layer is an ordinary FigureSpec in the same frame.
//
// Type imports only: check-content loads this file with Node's type stripping, which erases
// `import type` but does not resolve extensionless runtime imports.

import type {
  DrawingPointLabel,
  DrawingStroke,
  FigureCircle,
  FigureLineStyle,
  FigurePoint,
  FigurePolygon,
  FigurePolyline,
  FigureSegment,
  FigureSpec,
  LabelPlacement,
} from './figure'

// --- Spec types (mirror the JSON schema) ---

export type TransformationKind =
  'symetrie-axiale' | 'symetrie-centrale' | 'translation' | 'rotation' | 'homothetie'

export type FigureTransformation = (
  | { kind: 'symetrie-axiale'; axis: [string, string] }
  | { kind: 'symetrie-centrale'; center: string }
  | { kind: 'translation'; from: string; to: string }
  /** Angle in degrees, counter-clockwise when positive (sens direct). */
  | { kind: 'rotation'; center: string; angle: number }
  | { kind: 'homothetie'; center: string; ratio: number }
) & {
  /** The points whose images are taken; the image figure is everything drawn on them. */
  source: string[]
  /** Appended to a source name to name its image. Defaults to a prime (U+2032): A → A′. */
  suffix?: string
  /** `construction`: the textbook construction marks, for every source point or for those listed. */
  show?: { construction?: boolean | string[] }
}

export type FigureVector = {
  from: string
  to: string
  /** TeX, rendered by KaTeX next to the arrow: "\\vec{u}", "\\overrightarrow{AB}". */
  label?: string
  style?: FigureLineStyle
}

/** A line (droite) through two points, drawn across the whole frame. */
export type FigureLine = {
  through: [string, string]
  /** Its name, written near one end: "(d)". */
  label?: string
  style?: FigureLineStyle
}

/** A ray (demi-droite) from its origin through a point, to the edge of the frame. */
export type FigureRay = {
  from: string
  through: string
  style?: FigureLineStyle
}

// --- Geometry ---

type Pt2 = { x: number; y: number }
type ToSvg = (lx: number, ly: number) => Pt2

const EPS = 1e-9
export const PRIME = '′'
const DOUBLE_PRIME = '″'

function req(map: ReadonlyMap<string, Pt2>, name: string): Pt2 {
  const p = map.get(name)
  if (!p) throw new Error(`Point "${name}" not found in figure spec`)
  return p
}

/** An affine map of the plane: (x, y) ↦ (a·x + c·y + e, b·x + d·y + f), as SVG writes it. */
export type Affine = [a: number, b: number, c: number, d: number, e: number, f: number]

/**
 * The motion from the identity to a transformation, in logical coordinates, as data: the drawing
 * model crosses from a Server Component to the client, so it cannot carry functions.
 */
export type TransformationMotion =
  | { kind: 'translation'; dx: number; dy: number }
  | { kind: 'rotation'; cx: number; cy: number; degrees: number }
  | { kind: 'homothetie'; cx: number; cy: number; ratio: number }
  /** A reflection in the line through (px, py) with unit normal (nx, ny). */
  | { kind: 'symetrie-axiale'; px: number; py: number; nx: number; ny: number }

export function motionOf(
  t: FigureTransformation,
  map: ReadonlyMap<string, Pt2>
): TransformationMotion {
  switch (t.kind) {
    case 'translation': {
      const a = req(map, t.from)
      const b = req(map, t.to)
      return { kind: 'translation', dx: b.x - a.x, dy: b.y - a.y }
    }
    case 'rotation': {
      const c = req(map, t.center)
      return { kind: 'rotation', cx: c.x, cy: c.y, degrees: t.angle }
    }
    case 'symetrie-centrale': {
      // A half-turn: textbooks call it a demi-tour, and that is how it moves.
      const c = req(map, t.center)
      return { kind: 'rotation', cx: c.x, cy: c.y, degrees: 180 }
    }
    case 'homothetie': {
      const c = req(map, t.center)
      return { kind: 'homothetie', cx: c.x, cy: c.y, ratio: t.ratio }
    }
    case 'symetrie-axiale': {
      const a = req(map, t.axis[0])
      const b = req(map, t.axis[1])
      const l = Math.hypot(b.x - a.x, b.y - a.y)
      if (l < EPS)
        throw new Error(`Axe de symétrie (${t.axis.join('')}) : les deux points sont confondus`)
      return {
        kind: 'symetrie-axiale',
        px: a.x,
        py: a.y,
        nx: -(b.y - a.y) / l,
        ny: (b.x - a.x) / l,
      }
    }
  }
}

/**
 * The map at progress `t` (0: identity, 1: the transformation). A translation slides, a rotation
 * turns about its centre, a homothety scales from its centre (through it when the ratio is
 * negative), a reflection folds over its axis: the figure flattens onto the axis, then opens.
 */
export function affineAt(m: TransformationMotion, t: number): Affine {
  switch (m.kind) {
    case 'translation':
      return [1, 0, 0, 1, t * m.dx, t * m.dy]
    case 'rotation': {
      const r = (m.degrees * t * Math.PI) / 180
      const cos = Math.cos(r)
      const sin = Math.sin(r)
      return [cos, sin, -sin, cos, m.cx - cos * m.cx + sin * m.cy, m.cy - sin * m.cx - cos * m.cy]
    }
    case 'homothetie': {
      const s = 1 + (m.ratio - 1) * t
      return [s, 0, 0, s, (1 - s) * m.cx, (1 - s) * m.cy]
    }
    case 'symetrie-axiale': {
      // P ↦ P − 2t((P − P₀)·n)n
      const k = 2 * t
      const { nx, ny } = m
      const pn = m.px * nx + m.py * ny
      return [
        1 - k * nx * nx,
        -k * nx * ny,
        -k * nx * ny,
        1 - k * ny * ny,
        k * pn * nx,
        k * pn * ny,
      ]
    }
  }
}

export function applyAffine(m: Affine, p: Pt2): Pt2 {
  const [a, b, c, d, e, f] = m
  return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f }
}

/** The image of a point by a transformation: the motion at its end, without float noise (cos π). */
export function imageOf(t: FigureTransformation, p: Pt2, map: ReadonlyMap<string, Pt2>): Pt2 {
  return imageBy(motionOf(t, map), p)
}

function imageBy(m: TransformationMotion, p: Pt2): Pt2 {
  const q = applyAffine(affineAt(m, 1), p)
  return { x: Number(q.x.toFixed(10)), y: Number(q.y.toFixed(10)) }
}

/** The same map seen on screen: `frame` is the figure's logical-to-SVG mapping (axis-aligned). */
export type SvgFrame = { ox: number; oy: number; sx: number; sy: number }

export function frameOf(toSvg: ToSvg): SvgFrame {
  const o = toSvg(0, 0)
  return { ox: o.x, oy: o.y, sx: toSvg(1, 0).x - o.x, sy: toSvg(0, 1).y - o.y }
}

/** S·M·S⁻¹ with S the frame: the matrix to put on an SVG group, at progress `t`. */
export function svgAffineAt(m: TransformationMotion, t: number, f: SvgFrame): Affine {
  const [a, b, c, d, e, g] = affineAt(m, t)
  // svg = (ox + sx·x, oy + sy·y) — sy is negative: the Y axis points down on screen.
  const a2 = a
  const b2 = (b * f.sy) / f.sx
  const c2 = (c * f.sx) / f.sy
  const d2 = d
  const e2 = f.ox + f.sx * e - a2 * f.ox - c2 * f.oy
  const f2 = f.oy + f.sy * g - b2 * f.ox - d2 * f.oy
  return [a2, b2, c2, d2, e2, f2]
}

export function svgMatrix(m: Affine): string {
  return `matrix(${m.map((v) => Number(v.toFixed(4))).join(' ')})`
}

/** The name of an image: A → A′, A′ → A″. */
export function imageName(name: string, suffix: string = PRIME): string {
  const raw = name + suffix
  return raw.endsWith(PRIME + PRIME) ? raw.slice(0, -2) + DOUBLE_PRIME : raw
}

// --- Expansion into ordinary figure specs ---

export type TransformationLayer = {
  /** The image figure: its points named, its polygons, segments, polylines and circles. */
  image: FigureSpec
  /** The construction marks, drawn dashed and muted. Empty when not asked for. */
  construction: FigureSpec
  /** The source figure without names: what moves to the image in the interactive mode. */
  ghost: FigureSpec
  motion: TransformationMotion
}

export type TransformationsExpansion = {
  /** Every image point, hidden: added to the figure so others can name them and the frame fits them. */
  points: FigurePoint[]
  layers: TransformationLayer[]
}

// Construction points are never named on the page; a NUL prefix keeps them apart from any name.
const HELPER = '\u0000'

function hidden(name: string, p: Pt2): FigurePoint {
  return { name, x: p.x, y: p.y, dot: false, showName: false }
}

/**
 * An image and the copy that moves to it wear the image colour (ADR 0041 §4): a tone or a soft fill
 * on the source element (ADR 0037) stays on the source.
 */
function inkOnly<T extends object>(element: T): T {
  const copy: T & { tone?: unknown; fill?: unknown } = { ...element }
  delete copy.tone
  delete copy.fill
  return copy
}

function within(names: readonly string[], set: ReadonlySet<string>): boolean {
  return names.every((n) => set.has(n))
}

/** The 8 placements, by the direction (in logical coordinates, Y up) the label should go. */
export function placementToward(dx: number, dy: number): LabelPlacement {
  if (Math.hypot(dx, dy) < EPS) return 'auto'
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4))
  const bySector: Record<number, LabelPlacement> = {
    0: 'right',
    1: 'above-right',
    2: 'above',
    3: 'above-left',
    4: 'left',
    [-4]: 'left',
    [-3]: 'below-left',
    [-2]: 'below',
    [-1]: 'below-right',
  }
  return bySector[sector]
}

const PLACEMENT_DIRECTIONS: Partial<Record<LabelPlacement, [number, number]>> = {
  right: [1, 0],
  'above-right': [1, 1],
  above: [0, 1],
  'above-left': [-1, 1],
  left: [-1, 0],
  'below-left': [-1, -1],
  below: [0, -1],
  'below-right': [1, -1],
}

function centroid(pts: Pt2[]): Pt2 {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  }
}

function constructed(t: FigureTransformation): ReadonlySet<string> {
  const c = t.show?.construction
  if (c === true) return new Set(t.source)
  if (Array.isArray(c)) return new Set(c)
  return new Set()
}

/** Where an image name goes: away from the image figure, or away from the centre or the axis. */
function imagePlacement(
  image: Pt2,
  images: Pt2[],
  source: FigurePoint | undefined,
  motion: TransformationMotion
): LabelPlacement {
  // The author placed the source name where it is free: the image name goes where the
  // transformation sends that spot (mirrored, turned, or through the centre).
  const placed = source?.label?.placement
  if (placed && placed !== 'auto' && PLACEMENT_DIRECTIONS[placed]) {
    const [dx, dy] = PLACEMENT_DIRECTIONS[placed]
    const [a, b, c, d] = affineAt(motion, 1)
    return placementToward(a * dx + c * dy, b * dx + d * dy)
  }
  if (images.length >= 3) {
    const g = centroid(images)
    return placementToward(image.x - g.x, image.y - g.y)
  }
  switch (motion.kind) {
    case 'rotation':
    case 'homothetie': {
      const away = placementToward(image.x - motion.cx, image.y - motion.cy)
      if (away !== 'auto') return away
      break
    }
    case 'symetrie-axiale': {
      const side = (image.x - motion.px) * motion.nx + (image.y - motion.py) * motion.ny
      return placementToward(Math.sign(side) * motion.nx, Math.sign(side) * motion.ny)
    }
    case 'translation':
      break
  }
  return source?.label?.placement ?? 'auto'
}

/**
 * Turns `spec.transformations` into image points and one layer per transformation. Processed in
 * order: a later transformation may take an earlier image as its source (A′ → A″).
 */
export function expandTransformations(spec: FigureSpec): TransformationsExpansion {
  const transformations = spec.transformations ?? []
  if (transformations.length === 0) return { points: [], layers: [] }

  const pointMap = new Map<string, Pt2>(
    (spec.points ?? []).map((p) => [p.name, { x: p.x, y: p.y }])
  )
  const authored = new Map((spec.points ?? []).map((p) => [p.name, p]))
  const added: FigurePoint[] = []
  const layers: TransformationLayer[] = []

  // Everything drawn so far, which an image figure copies when all its points are in the source.
  let polygons: FigurePolygon[] = spec.polygons ?? []
  let segments: FigureSegment[] = spec.segments ?? []
  let polylines: FigurePolyline[] = spec.polylines ?? []
  let circles: FigureCircle[] = spec.circles ?? []

  transformations.forEach((t, index) => {
    const motion = motionOf(t, pointMap)
    const suffix = t.suffix ?? PRIME
    const rename = new Map(t.source.map((n) => [n, imageName(n, suffix)]))
    const sourceSet = new Set(t.source)

    const imagePts = t.source.map((n) => imageBy(motion, req(pointMap, n)))
    const invariant = t.source.map((n, i) => {
      const p = req(pointMap, n)
      return Math.hypot(p.x - imagePts[i].x, p.y - imagePts[i].y) < 1e-9
    })

    const newPoints: FigurePoint[] = t.source.map((n, i) => {
      const name = rename.get(n) as string
      const p = imagePts[i]
      if (invariant[i]) return hidden(name, p)
      const placement = imagePlacement(p, imagePts, authored.get(n), motion)
      return { name, x: p.x, y: p.y, label: { placement } }
    })

    // Context for references: every point known so far, hidden, then this layer's own.
    const context = [...pointMap].map(([n, p]) => hidden(n, p))
    for (const p of newPoints) pointMap.set(p.name, { x: p.x, y: p.y })
    added.push(...newPoints.map((p) => hidden(p.name, p)))

    const renameAll = (names: string[]) => names.map((n) => rename.get(n) as string)
    const imgPolygons = polygons
      .filter((p) => within(p.vertices, sourceSet))
      .map((p) => ({ ...inkOnly(p), vertices: renameAll(p.vertices) }))
    const imgSegments = segments
      .filter((s) => sourceSet.has(s.from) && sourceSet.has(s.to))
      .map((s) => ({
        ...inkOnly(s),
        from: rename.get(s.from) as string,
        to: rename.get(s.to) as string,
      }))
    const imgPolylines = polylines
      .filter((p) => within(p.points, sourceSet))
      .map((p) => ({ ...inkOnly(p), points: renameAll(p.points) }))
    const imgCircles: FigureCircle[] = circles
      .filter(
        (c) => sourceSet.has(c.center) && (c.through === undefined || sourceSet.has(c.through))
      )
      .map((c) =>
        c.through !== undefined
          ? { center: rename.get(c.center) as string, through: rename.get(c.through) as string }
          : {
              center: rename.get(c.center) as string,
              radius: c.radius * (motion.kind === 'homothetie' ? Math.abs(motion.ratio) : 1),
            }
      )

    const image: FigureSpec = {
      points: [...context, ...newPoints],
      polygons: imgPolygons,
      segments: imgSegments,
      polylines: imgPolylines,
      circles: imgCircles,
    }

    const ghost: FigureSpec = {
      points: context.map((p) => (sourceSet.has(p.name) ? { ...p, dot: true } : p)),
      polygons: polygons.filter((p) => within(p.vertices, sourceSet)).map(inkOnly),
      segments: segments.filter((s) => sourceSet.has(s.from) && sourceSet.has(s.to)).map(inkOnly),
      polylines: polylines.filter((p) => within(p.points, sourceSet)).map(inkOnly),
      circles: circles.filter(
        (c) => sourceSet.has(c.center) && (c.through === undefined || sourceSet.has(c.through))
      ),
    }

    const construction = buildConstruction(t, motion, index, {
      context: [...context, ...newPoints.map((p) => hidden(p.name, p))],
      names: t.source.filter((n, i) => constructed(t).has(n) && !invariant[i]),
      rename,
      pointMap,
    })

    layers.push({ image, construction, ghost, motion })

    // An image figure is drawn: a later transformation can take it as its source.
    polygons = [...polygons, ...imgPolygons]
    segments = [...segments, ...imgSegments]
    polylines = [...polylines, ...imgPolylines]
    circles = [...circles, ...imgCircles]
  })

  return { points: added, layers }
}

type ConstructionInput = {
  context: FigurePoint[]
  names: string[]
  rename: ReadonlyMap<string, string>
  pointMap: ReadonlyMap<string, Pt2>
}

/**
 * The marks a textbook draws to construct the image of each point:
 * - axial: the dashed perpendicular from M to M′, its foot H with a right angle, MH = HM′ coded;
 * - central: the dashed segment [MM′] through O, MO = OM′ coded;
 * - rotation: dashed [OM] and [OM′], the compass arc from M to M′, the angle marked at O;
 * - homothety: the dashed line through O, M and M′;
 * - translation: a dashed arrow from M to M′, parallel to the vector.
 * Each point gets its own code (1, 2, 3 ticks) so equal lengths pair up at a glance.
 */
function buildConstruction(
  t: FigureTransformation,
  motion: TransformationMotion,
  layerIndex: number,
  { context, names, rename, pointMap }: ConstructionInput
): FigureSpec {
  const points = [...context]
  const segments: FigureSegment[] = []
  const spec: FigureSpec = {
    points,
    segments,
    angleMarks: [],
    lengthMarks: [],
    arcs: [],
    vectors: [],
  }
  const dashed = 'dashed' as const

  names.forEach((m, i) => {
    const mi = rename.get(m) as string
    const ticks = ((i % 3) + 1) as 1 | 2 | 3
    switch (t.kind) {
      case 'symetrie-axiale': {
        if (motion.kind !== 'symetrie-axiale') return
        const p = req(pointMap, m)
        const q = req(pointMap, mi)
        const foot = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
        const h = `${HELPER}H${layerIndex}.${i}`
        const along = `${HELPER}D${layerIndex}.${i}`
        points.push(
          hidden(h, foot),
          hidden(along, { x: foot.x - motion.ny, y: foot.y + motion.nx })
        )
        segments.push({ from: m, to: h, style: dashed }, { from: h, to: mi, style: dashed })
        spec.lengthMarks?.push({ segment: m + h, ticks }, { segment: h + mi, ticks })
        spec.angleMarks?.push({ vertex: h, from: m, to: along, right: true })
        return
      }
      case 'symetrie-centrale':
        segments.push(
          { from: m, to: t.center, style: dashed },
          { from: t.center, to: mi, style: dashed }
        )
        spec.lengthMarks?.push({ segment: m + t.center, ticks }, { segment: t.center + mi, ticks })
        return
      case 'rotation': {
        segments.push(
          { from: t.center, to: m, style: dashed },
          { from: t.center, to: mi, style: dashed }
        )
        // Arcs go counter-clockwise: a clockwise rotation's arc runs from the image back.
        const [from, to] = t.angle > 0 ? [m, mi] : [mi, m]
        spec.arcs?.push({ center: t.center, from, to, style: dashed })
        const right = Math.abs(Math.abs(t.angle) - 90) < 1e-9
        spec.angleMarks?.push({ vertex: t.center, from: m, to: mi, right })
        return
      }
      case 'homothetie': {
        // The dashed line covers O, M and M′, whatever their order on it.
        const o = req(pointMap, t.center)
        const along = (n: string) => {
          const p = req(pointMap, n)
          const dir = req(pointMap, m)
          return (p.x - o.x) * (dir.x - o.x) + (p.y - o.y) * (dir.y - o.y)
        }
        const sorted = [t.center, m, mi].sort((a, b) => along(a) - along(b))
        segments.push({ from: sorted[0], to: sorted[2], style: dashed })
        return
      }
      case 'translation':
        spec.vectors?.push({ from: m, to: mi, style: dashed })
        return
    }
  })
  return spec
}

// --- Lines, rays and vectors, on screen ---

/** A rectangle in SVG pixels: what lines and rays are cut to. */
export type SvgBox = { x1: number; y1: number; x2: number; y2: number }

/**
 * The parameter range [t0, t1] of p + t·d inside the box (Liang–Barsky), or null when the line
 * misses it.
 */
function clip(p: Pt2, d: Pt2, box: SvgBox, t0: number, t1: number): [number, number] | null {
  const checks: [number, number][] = [
    [-d.x, p.x - box.x1],
    [d.x, box.x2 - p.x],
    [-d.y, p.y - box.y1],
    [d.y, box.y2 - p.y],
  ]
  for (const [den, num] of checks) {
    if (Math.abs(den) < EPS) {
      if (num < 0) return null
      continue
    }
    const r = num / den
    if (den < 0) t0 = Math.max(t0, r)
    else t1 = Math.min(t1, r)
  }
  return t0 <= t1 ? [t0, t1] : null
}

const LINE_LABEL_BACK_PX = 16
const LINE_LABEL_SIDE_PX = 10

export function drawLines(
  spec: Pick<FigureSpec, 'lines' | 'rays'>,
  pointMap: ReadonlyMap<string, Pt2>,
  toSvg: ToSvg,
  box: SvgBox
): { strokes: DrawingStroke[]; labels: DrawingPointLabel[] } {
  const strokes: DrawingStroke[] = []
  const labels: DrawingPointLabel[] = []
  const svgOf = (n: string) => {
    const p = req(pointMap, n)
    return toSvg(p.x, p.y)
  }

  for (const line of spec.lines ?? []) {
    const a = svgOf(line.through[0])
    const b = svgOf(line.through[1])
    const d = { x: b.x - a.x, y: b.y - a.y }
    const l = Math.hypot(d.x, d.y)
    if (l < EPS)
      throw new Error(`Droite (${line.through.join('')}) : les deux points sont confondus`)
    const range = clip(a, d, box, -Infinity, Infinity)
    if (!range) continue
    const [t0, t1] = range
    strokes.push({
      x1: a.x + t0 * d.x,
      y1: a.y + t0 * d.y,
      x2: a.x + t1 * d.x,
      y2: a.y + t1 * d.y,
      dashed: line.style === 'dashed',
    })
    if (line.label) labels.push(lineLabel(line.label, a, d, l, t1))
  }

  for (const ray of spec.rays ?? []) {
    const a = svgOf(ray.from)
    const b = svgOf(ray.through)
    const d = { x: b.x - a.x, y: b.y - a.y }
    if (Math.hypot(d.x, d.y) < EPS) {
      throw new Error(`Demi-droite [${ray.from}${ray.through}) : les deux points sont confondus`)
    }
    const range = clip(a, d, box, 0, Infinity)
    if (!range) continue
    strokes.push({
      x1: a.x + range[0] * d.x,
      y1: a.y + range[0] * d.y,
      x2: a.x + range[1] * d.x,
      y2: a.y + range[1] * d.y,
      dashed: ray.style === 'dashed',
    })
  }
  return { strokes, labels }
}

/** A line's name sits near its far end, beside it, on its left (or above a horizontal line). */
function lineLabel(text: string, a: Pt2, d: Pt2, l: number, tEnd: number): DrawingPointLabel {
  const u = { x: d.x / l, y: d.y / l }
  let n = { x: u.y, y: -u.x }
  if (n.y > 0 || (Math.abs(n.y) < EPS && n.x > 0)) n = { x: -n.x, y: -n.y }
  const end = { x: a.x + tEnd * d.x, y: a.y + tEnd * d.y }
  return {
    text,
    x: end.x - u.x * LINE_LABEL_BACK_PX + n.x * LINE_LABEL_SIDE_PX,
    y: end.y - u.y * LINE_LABEL_BACK_PX + n.y * LINE_LABEL_SIDE_PX,
    anchor: n.x > 0.38 ? 'start' : n.x < -0.38 ? 'end' : 'middle',
    baseline: n.y < -0.38 ? 'auto' : n.y > 0.38 ? 'hanging' : 'middle',
  }
}

/** A vector: its shaft stops where the arrowhead begins, so the tip stays sharp. */
export type DrawingVector = {
  x1: number
  y1: number
  x2: number
  y2: number
  head: string
  dashed: boolean
  label: { tex: string; x: number; y: number } | null
}

// The arrowhead in proportion to a 1.5 px stroke: about 5 strokes long, 4 wide.
const VECTOR_HEAD_LEN_PX = 7.5
const VECTOR_HEAD_HALF_WIDTH_PX = 3
const VECTOR_LABEL_OFFSET_PX = 13

export function drawVectors(
  vectors: FigureVector[],
  pointMap: ReadonlyMap<string, Pt2>,
  toSvg: ToSvg,
  /** The figure's centre on screen: a label goes on the side away from it. */
  centre: Pt2
): DrawingVector[] {
  return vectors.map((v) => {
    const pa = req(pointMap, v.from)
    const pb = req(pointMap, v.to)
    const a = toSvg(pa.x, pa.y)
    const b = toSvg(pb.x, pb.y)
    const l = Math.hypot(b.x - a.x, b.y - a.y)
    if (l < EPS) throw new Error(`Vecteur ${v.from}${v.to} : les deux points sont confondus`)
    const u = { x: (b.x - a.x) / l, y: (b.y - a.y) / l }
    const n = { x: -u.y, y: u.x }
    const headLen = Math.min(VECTOR_HEAD_LEN_PX, l / 2)
    const base = { x: b.x - u.x * headLen, y: b.y - u.y * headLen }
    const w = VECTOR_HEAD_HALF_WIDTH_PX
    const head = [
      [b.x, b.y],
      [base.x + n.x * w, base.y + n.y * w],
      [base.x - n.x * w, base.y - n.y * w],
    ]
      .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
      .join(' ')
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const side = (mid.x - centre.x) * n.x + (mid.y - centre.y) * n.y >= 0 ? 1 : -1
    return {
      x1: a.x,
      y1: a.y,
      x2: base.x,
      y2: base.y,
      head,
      dashed: v.style === 'dashed',
      label: v.label
        ? {
            tex: v.label,
            x: mid.x + side * n.x * VECTOR_LABEL_OFFSET_PX,
            y: mid.y + side * n.y * VECTOR_LABEL_OFFSET_PX,
          }
        : null,
    }
  })
}

// --- Rules beyond the JSON schema (ADR 0041 §8) ---
//
// Read by scripts/check-content.mjs (worded in English for the catalogue) and by the teacher
// editor (in French, before publication), as chart-rules.ts is. Each issue is a code, a path
// relative to the figure's `spec`, and the facts its message needs.

export type FigureGeometryIssue =
  | { code: 'UNKNOWN_POINT'; path: string; name: string }
  | { code: 'SAME_POINTS'; path: string; names: [string, string] }
  | { code: 'EMPTY_SOURCE'; path: string }
  | { code: 'DUPLICATE_SOURCE'; path: string; name: string }
  | { code: 'IDENTITY'; path: string; kind: TransformationKind }
  | { code: 'ZERO_RATIO'; path: string }
  | { code: 'ANGLE_RANGE'; path: string; angle: number }
  | { code: 'IMAGE_NAME_TAKEN'; path: string; name: string }
  | { code: 'CONSTRUCTION_NOT_IN_SOURCE'; path: string; name: string }
  | { code: 'AXIS_NOT_DRAWN'; path: string; names: [string, string] }
  | { code: 'UNEQUAL_SCALES'; path: string }
  | { code: 'BLANK_LABEL'; path: string }

export type FigureGeometryIssueCode = FigureGeometryIssue['code']

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function list(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter(isRecord) : []
}

/** The axes of a repère have their own scales unless their spans are equal (ADR 0013, #214). */
function unequalScales(spec: Record<string, unknown>): boolean {
  const axes = spec.axes
  if (!isRecord(axes) || !isRecord(axes.x) || !isRecord(axes.y)) return false
  const span = (a: Record<string, unknown>) => Number(a.to) - Number(a.from)
  return Math.abs(span(axes.x) - span(axes.y)) > 1e-9
}

/**
 * Checks `transformations`, `vectors`, `lines` and `rays` of a figure spec: every point named
 * exists, two points that define a direction are distinct, a transformation is not the identity,
 * image names are free, a symmetry axis is drawn, and construction marks (right angles, equal
 * lengths) are not drawn in a repère whose two axes have different scales.
 */
export function checkFigureGeometry(raw: unknown): FigureGeometryIssue[] {
  if (!isRecord(raw)) return []
  const issues: FigureGeometryIssue[] = []
  const points = new Map<string, Pt2>()
  for (const p of list(raw.points)) {
    if (typeof p.name === 'string') points.set(p.name, { x: Number(p.x), y: Number(p.y) })
  }

  const known = (name: unknown, path: string): Pt2 | null => {
    if (typeof name !== 'string') return null
    const p = points.get(name)
    if (!p) issues.push({ code: 'UNKNOWN_POINT', path, name })
    return p ?? null
  }
  const distinct = (a: unknown, b: unknown, path: string, pa: Pt2 | null, pb: Pt2 | null) => {
    if (pa && pb && Math.hypot(pa.x - pb.x, pa.y - pb.y) < EPS) {
      issues.push({ code: 'SAME_POINTS', path, names: [String(a), String(b)] })
      return false
    }
    return pa !== null && pb !== null
  }

  const drawnPairs = new Set<string>()
  const pair = (a: unknown, b: unknown) => [String(a), String(b)].sort().join('\u0000')
  for (const s of list(raw.segments)) drawnPairs.add(pair(s.from, s.to))
  for (const l of list(raw.lines)) {
    const t = strings(l.through)
    drawnPairs.add(pair(t[0], t[1]))
  }

  list(raw.transformations).forEach((t, i) => {
    const path = `transformations[${i}]`
    const kind = t.kind as TransformationKind
    let valid = true
    switch (kind) {
      case 'symetrie-axiale': {
        const [a, b] = strings(t.axis)
        valid = distinct(a, b, `${path}.axis`, known(a, `${path}.axis`), known(b, `${path}.axis`))
        if (valid && !drawnPairs.has(pair(a, b))) {
          issues.push({ code: 'AXIS_NOT_DRAWN', path: `${path}.axis`, names: [a, b] })
        }
        break
      }
      case 'symetrie-centrale':
        valid = known(t.center, `${path}.center`) !== null
        break
      case 'translation': {
        const pa = known(t.from, `${path}.from`)
        const pb = known(t.to, `${path}.to`)
        if (pa && pb && Math.hypot(pa.x - pb.x, pa.y - pb.y) < EPS) {
          issues.push({ code: 'IDENTITY', path, kind })
          valid = false
        } else valid = pa !== null && pb !== null
        break
      }
      case 'rotation': {
        valid = known(t.center, `${path}.center`) !== null
        const angle = Number(t.angle)
        if (!(Math.abs(angle) < 360)) {
          issues.push({ code: 'ANGLE_RANGE', path: `${path}.angle`, angle })
          valid = false
        } else if (Math.abs(angle) < EPS) {
          issues.push({ code: 'IDENTITY', path, kind })
          valid = false
        }
        break
      }
      case 'homothetie': {
        valid = known(t.center, `${path}.center`) !== null
        const ratio = Number(t.ratio)
        if (Math.abs(ratio) < EPS) {
          issues.push({ code: 'ZERO_RATIO', path: `${path}.ratio` })
          valid = false
        } else if (Math.abs(ratio - 1) < EPS) {
          issues.push({ code: 'IDENTITY', path, kind })
          valid = false
        }
        break
      }
      default:
        return
    }

    const source = strings(t.source)
    if (source.length === 0) issues.push({ code: 'EMPTY_SOURCE', path: `${path}.source` })
    const seen = new Set<string>()
    for (const name of source) {
      if (seen.has(name)) issues.push({ code: 'DUPLICATE_SOURCE', path: `${path}.source`, name })
      seen.add(name)
      if (!known(name, `${path}.source`)) valid = false
    }

    const show = isRecord(t.show) ? t.show : {}
    if (Array.isArray(show.construction)) {
      for (const name of strings(show.construction)) {
        if (!seen.has(name)) {
          issues.push({ code: 'CONSTRUCTION_NOT_IN_SOURCE', path: `${path}.show.construction`, name })
        }
      }
    }
    const constructs =
      show.construction === true ||
      (Array.isArray(show.construction) && show.construction.length > 0)
    if (constructs && kind !== 'translation' && kind !== 'homothetie' && unequalScales(raw)) {
      issues.push({ code: 'UNEQUAL_SCALES', path: `${path}.show.construction` })
    }

    // The images join the figure: the next transformation may use them, nobody may take their names.
    const suffix = typeof t.suffix === 'string' ? t.suffix : PRIME
    let motion: TransformationMotion | null = null
    if (valid) {
      try {
        motion = motionOf(t as unknown as FigureTransformation, points)
      } catch {
        motion = null
      }
    }
    for (const name of new Set(source)) {
      const image = imageName(name, suffix)
      if (points.has(image)) {
        issues.push({ code: 'IMAGE_NAME_TAKEN', path: `${path}.source`, name: image })
        continue
      }
      const p = points.get(name)
      if (motion && p) points.set(image, imageBy(motion, p))
    }
  })

  list(raw.vectors).forEach((v, i) => {
    const path = `vectors[${i}]`
    distinct(v.from, v.to, path, known(v.from, `${path}.from`), known(v.to, `${path}.to`))
    if (typeof v.label === 'string' && v.label.trim() === '') {
      issues.push({ code: 'BLANK_LABEL', path: `${path}.label` })
    }
  })
  list(raw.lines).forEach((l, i) => {
    const path = `lines[${i}]`
    const [a, b] = strings(l.through)
    distinct(a, b, `${path}.through`, known(a, `${path}.through`), known(b, `${path}.through`))
    if (typeof l.label === 'string' && l.label.trim() === '') {
      issues.push({ code: 'BLANK_LABEL', path: `${path}.label` })
    }
  })
  list(raw.rays).forEach((r, i) => {
    const path = `rays[${i}]`
    distinct(r.from, r.through, path, known(r.from, `${path}.from`), known(r.through, `${path}.through`))
  })

  return issues
}
