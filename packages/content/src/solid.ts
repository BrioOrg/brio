// A solid the student can turn (ADR 0039): the block's spec becomes a 3D geometry once, and the
// geometry is projected to SVG paths for each view. Orthographic projection, hidden edges dashed
// as in the perspective cavalière solids of `figure` (ADR 0013, amendment #215).
//
// World axes: x to the right, y away from the viewer (depth), z up. A view turns the solid about
// the vertical axis (yaw) and tilts the eye above the horizontal plane (pitch).

// --- Spec types (mirror the JSON schema) ---

export type SolidKind = 'pave' | 'cube' | 'prisme' | 'cylindre' | 'pyramide' | 'cone' | 'boule'

/** A point of a plane figure: the front face of a prism, the base of a pyramid seen from above. */
export type SolidPlanePoint = { x: number; y: number }

/**
 * The plane of a section. `base`: parallel to the solid's base (for a prism, its front face);
 * `front` and `side`: parallel to the front and left faces of a pavé or cube; `axis`: parallel to
 * the axis of a cylinder. A ball's section has no `parallelTo`: it is parallel to the equator.
 */
export type SolidSectionPlane = 'base' | 'front' | 'side' | 'axis'

export type SolidSection = {
  parallelTo?: SolidSectionPlane
  /** Distance from the face it is parallel to, from the axis, or (ball) from the centre. */
  at: number
}

export type SpherePoint = { name: string; latitude: number; longitude: number }

type SolidCommon = {
  /** Vertex and centre names, in the order the schema gives for each kind. */
  names?: string[]
  section?: SolidSection
}

export type SolidSpec = SolidCommon &
  (
    | { kind: 'pave'; width: number; height: number; depth: number }
    | { kind: 'cube'; edge: number }
    | { kind: 'prisme'; base: SolidPlanePoint[]; depth: number }
    | { kind: 'cylindre'; radius: number; height: number }
    | { kind: 'pyramide'; base: SolidPlanePoint[]; height: number; apex?: SolidPlanePoint }
    | { kind: 'cone'; radius: number; height: number }
    | {
        kind: 'boule'
        radius: number
        equator?: boolean
        /** Latitudes in degrees, north positive. */
        parallels?: number[]
        /** Longitudes in degrees, east positive; each meridian runs from pole to pole. */
        meridians?: number[]
        points?: SpherePoint[]
      }
  )

/** Yaw and pitch in degrees. */
export type SolidView = { yaw: number; pitch: number }

// --- Frame (SVG-ready, in the viewBox's pixels) ---

export type SolidShade = 'top' | 'front' | 'side'

export type SolidLabel = {
  text: string
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  baseline: 'auto' | 'hanging' | 'middle'
}

/**
 * One view of a solid, as path data. The number of labels never changes from one view to the
 * next, so a renderer can update its elements in place while the solid turns.
 */
export type SolidFrame = {
  /** Faces turned towards the viewer, by shade. */
  fills: Record<SolidShade, string>
  hidden: string
  visible: string
  sectionFill: string
  sectionHidden: string
  sectionVisible: string
  /** Centres and points of a sphere the viewer can see… */
  dots: string
  /** …and points on the far side of a sphere. */
  hiddenDots: string
  labels: SolidLabel[]
}

// --- Constants ---

export const SOLID_SIZE = 320
export const SOLID_VIEWBOX = `0 0 ${SOLID_SIZE} ${SOLID_SIZE}`
/** Like the textbook's view: from the front, a little from above and from the right. */
export const SOLID_INITIAL_VIEW: SolidView = { yaw: -22, pitch: 20 }

const PADDING = 30
const CURVE_SEGMENTS = 64
const SPHERE_SEGMENTS = 96
/** From a point to the centre of its name: about the size of a capital, plus a gap. */
const LABEL_OFFSET = 11
const DOT_LABEL_OFFSET = 12
/** A name this far from every stroke reads cleanly; beyond, the side away from the solid wins. */
const LABEL_CLEARANCE = 9
const DOT_RADIUS = 2.2
const DRAG_DEGREES_PER_PX = 0.5
const KEY_STEP_DEGREES = 15
const EPS = 1e-9
/** Light from the upper left, in front: decides which flat face gets which shade. */
const LIGHT = normalize({ x: -0.3, y: 0.8, z: 0.5 })

// --- Vectors ---

type Vec3 = { x: number; y: number; z: number }

function v3(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}
function sub(a: Vec3, b: Vec3): Vec3 {
  return v3(a.x - b.x, a.y - b.y, a.z - b.z)
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}
function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)
}
function length(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z)
}
function normalize(a: Vec3): Vec3 {
  const l = length(a)
  return l < EPS ? v3(0, 0, 0) : v3(a.x / l, a.y / l, a.z / l)
}
function centroid(points: Vec3[]): Vec3 {
  const n = points.length || 1
  return v3(
    points.reduce((s, p) => s + p.x, 0) / n,
    points.reduce((s, p) => s + p.y, 0) / n,
    points.reduce((s, p) => s + p.z, 0) / n
  )
}
const rad = (deg: number) => (deg * Math.PI) / 180

// --- Geometry (view-independent, built once per spec) ---

/** When a stroke is seen: through one of its faces, by the outward normal of a sphere, or never. */
type Visibility = { kind: 'faces'; faces: number[] } | { kind: 'inside' }

type Stroke = {
  a: number
  b: number
  vis: Visibility
  /** Between two faces of a curved surface: drawn only on the outline, where they turn apart. */
  silhouette?: [number, number]
  layer: 'edge' | 'section'
}

type Face = { vertices: number[]; normal: Vec3; smooth: boolean }

type NamedPoint = {
  name: string
  point: number
  dot: boolean
  /** On a sphere: hidden when its normal points away from the viewer. */
  onSphere: boolean
}

/** A curve drawn on a sphere, as point indices; split at the outline in each view. */
type SphereCurve = { ids: number[]; closed: boolean; layer: 'edge' | 'section' }

export type SolidGeometry = {
  points: Vec3[]
  faces: Face[]
  strokes: Stroke[]
  sphereCurves: SphereCurve[]
  /** Section polygon, as point indices in order around it. */
  section: number[] | null
  sphereRadius: number | null
  named: NamedPoint[]
  /** Centre of the bounding box: the solid turns about it. */
  center: Vec3
  /** Pixels per unit: the bounding sphere fits the frame, so no view crops the solid. */
  scale: number
}

type MeshBuilder = {
  points: Vec3[]
  faces: Face[]
}

function newellNormal(points: Vec3[], ids: number[]): Vec3 {
  let nx = 0
  let ny = 0
  let nz = 0
  for (let i = 0; i < ids.length; i++) {
    const a = points[ids[i]]
    const b = points[ids[(i + 1) % ids.length]]
    nx += (a.y - b.y) * (a.z + b.z)
    ny += (a.z - b.z) * (a.x + b.x)
    nz += (a.x - b.x) * (a.y + b.y)
  }
  return normalize(v3(nx, ny, nz))
}

/** Adds a face of a convex solid, its normal turned outwards (away from the solid's centre). */
function addFace(mesh: MeshBuilder, ids: number[], inside: Vec3, smooth = false): void {
  const normal = newellNormal(mesh.points, ids)
  const c = centroid(ids.map((i) => mesh.points[i]))
  const outward = dot(normal, sub(c, inside)) >= 0
  mesh.faces.push({
    vertices: outward ? ids : [...ids].reverse(),
    normal: outward ? normal : v3(-normal.x, -normal.y, -normal.z),
    smooth,
  })
}

function addPoint(mesh: MeshBuilder, p: Vec3): number {
  mesh.points.push(p)
  return mesh.points.length - 1
}

/** A prism: `front` in the plane y = 0, extruded to y = depth. Vertices: front, then back. */
function prismMesh(front: Vec3[], depth: number): MeshBuilder {
  const n = front.length
  const points = [...front, ...front.map((p) => v3(p.x, p.y + depth, p.z))]
  const mesh: MeshBuilder = { points, faces: [] }
  const inside = centroid(points)
  addFace(mesh, range(n), inside)
  addFace(
    mesh,
    range(n).map((i) => n + i),
    inside
  )
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    addFace(mesh, [i, j, n + j, n + i], inside)
  }
  return mesh
}

/** A pyramid on `base` (plane z = 0) with its apex last. */
function pyramidMesh(base: Vec3[], apex: Vec3): MeshBuilder {
  const n = base.length
  const mesh: MeshBuilder = { points: [...base, apex], faces: [] }
  const inside = centroid([centroid(base), apex])
  addFace(mesh, range(n), inside)
  for (let i = 0; i < n; i++) addFace(mesh, [i, (i + 1) % n, n], inside)
  return mesh
}

/** A ring of `CURVE_SEGMENTS` points; half a step off the x axis, so no plane x = 0 or y = 0 meets a vertex. */
function ring(radius: number, z: number): Vec3[] {
  return range(CURVE_SEGMENTS).map((i) => {
    const t = ((i + 0.5) * 2 * Math.PI) / CURVE_SEGMENTS
    return v3(radius * Math.cos(t), radius * Math.sin(t), z)
  })
}

function cylinderMesh(radius: number, height: number): MeshBuilder {
  const n = CURVE_SEGMENTS
  const mesh: MeshBuilder = { points: [...ring(radius, 0), ...ring(radius, height)], faces: [] }
  const inside = v3(0, 0, height / 2)
  addFace(mesh, range(n), inside)
  addFace(
    mesh,
    range(n).map((i) => n + i),
    inside
  )
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    addFace(mesh, [i, j, n + j, n + i], inside, true)
  }
  return mesh
}

function coneMesh(radius: number, height: number): MeshBuilder {
  const n = CURVE_SEGMENTS
  const mesh: MeshBuilder = { points: [...ring(radius, 0), v3(0, 0, height)], faces: [] }
  const inside = v3(0, 0, height / 4)
  addFace(mesh, range(n), inside)
  for (let i = 0; i < n; i++) addFace(mesh, [i, (i + 1) % n, n], inside, true)
  return mesh
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

/** Every edge of a mesh, with the faces on each side. */
function meshEdges(faces: Face[]): Array<{ a: number; b: number; faces: number[] }> {
  const edges = new Map<string, { a: number; b: number; faces: number[] }>()
  faces.forEach((face, f) => {
    const vs = face.vertices
    vs.forEach((a, i) => {
      const b = vs[(i + 1) % vs.length]
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      const edge = edges.get(key)
      if (edge) edge.faces.push(f)
      else edges.set(key, { a: Math.min(a, b), b: Math.max(a, b), faces: [f] })
    })
  })
  return [...edges.values()]
}

function edgeStrokes(faces: Face[]): Stroke[] {
  return meshEdges(faces).map((e) => {
    const [f, g] = e.faces
    const smooth = g !== undefined && faces[f].smooth && faces[g].smooth
    return {
      a: e.a,
      b: e.b,
      vis: { kind: 'faces', faces: e.faces },
      ...(smooth ? { silhouette: [f, g] as [number, number] } : {}),
      layer: 'edge' as const,
    }
  })
}

/** A plane n·p = c. */
type Plane = { n: Vec3; c: number }

function sectionPlane(spec: SolidSpec): Plane | null {
  const s = spec.section
  if (!s) return null
  const plane = s.parallelTo ?? 'base'
  if (spec.kind === 'boule') return { n: v3(0, 0, 1), c: s.at }
  if (spec.kind === 'prisme') return { n: v3(0, 1, 0), c: s.at }
  if (plane === 'front') return { n: v3(0, 1, 0), c: s.at }
  if (plane === 'side') return { n: v3(1, 0, 0), c: s.at }
  // A frontal plane in front of the axis: the rectangle faces the viewer.
  if (plane === 'axis') return { n: v3(0, 1, 0), c: -s.at }
  return { n: v3(0, 0, 1), c: s.at }
}

/**
 * The section of a convex mesh by a plane: one segment per face it crosses, seen when that face
 * is, and the polygon they close. A vertex on the plane counts as just above it, so a section is
 * always a clean polygon.
 */
function meshSection(
  mesh: MeshBuilder,
  plane: Plane
): { strokes: Stroke[]; polygon: number[] } | null {
  const side = mesh.points.map((p) => {
    const d = dot(plane.n, p) - plane.c
    return Math.abs(d) < EPS ? EPS : d
  })
  const crossing = new Map<string, number>()
  const crossPoint = (a: number, b: number): number => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    const known = crossing.get(key)
    if (known !== undefined) return known
    const t = side[a] / (side[a] - side[b])
    const id = addPoint(mesh, lerp(mesh.points[a], mesh.points[b], t))
    crossing.set(key, id)
    return id
  }
  const strokes: Stroke[] = []
  const faceCount = mesh.faces.length
  for (let f = 0; f < faceCount; f++) {
    const vs = mesh.faces[f].vertices
    const ends: number[] = []
    vs.forEach((a, i) => {
      const b = vs[(i + 1) % vs.length]
      if (side[a] > 0 !== side[b] > 0) ends.push(crossPoint(a, b))
    })
    if (ends.length === 2) {
      strokes.push({ a: ends[0], b: ends[1], vis: { kind: 'faces', faces: [f] }, layer: 'section' })
    }
  }
  if (strokes.length < 3) return null
  const polygon = chain(strokes.map((s) => [s.a, s.b] as [number, number]))[0]?.ids ?? []
  return { strokes, polygon }
}

function sphereFromSpec(
  spec: Extract<SolidSpec, { kind: 'boule' }>
): Pick<SolidGeometry, 'points' | 'sphereCurves' | 'section' | 'named'> {
  const r = spec.radius
  const points: Vec3[] = [v3(0, 0, 0)]
  const sphereCurves: SphereCurve[] = []
  // Longitude 0 faces the viewer at yaw 0; east is to the viewer's right.
  const onSphere = (lat: number, lon: number) =>
    v3(
      r * Math.cos(rad(lat)) * Math.sin(rad(lon)),
      -r * Math.cos(rad(lat)) * Math.cos(rad(lon)),
      r * Math.sin(rad(lat))
    )
  const curve = (pts: Vec3[], layer: SphereCurve['layer']) => {
    const first = points.length
    points.push(...pts)
    const ids = range(pts.length).map((i) => first + i)
    sphereCurves.push({ ids, closed: true, layer })
    return ids
  }
  const parallel = (lat: number) =>
    range(SPHERE_SEGMENTS).map((i) => onSphere(lat, (i * 360) / SPHERE_SEGMENTS))
  if (spec.equator) curve(parallel(0), 'edge')
  for (const lat of spec.parallels ?? []) curve(parallel(lat), 'edge')
  // A meridian is drawn with the opposite one, as the whole great circle through the poles: its
  // far half is dashed like the far half of the equator.
  for (const lon of spec.meridians ?? []) {
    curve(
      range(SPHERE_SEGMENTS).map((i) => {
        const t = -90 + (i * 360) / SPHERE_SEGMENTS
        return t <= 90 ? onSphere(t, lon) : onSphere(180 - t, lon + 180)
      }),
      'edge'
    )
  }

  let section: number[] | null = null
  if (spec.section) {
    const d = spec.section.at
    const rho = Math.sqrt(Math.max(0, r * r - d * d))
    section = curve(
      range(SPHERE_SEGMENTS).map((i) => {
        const t = (i * 2 * Math.PI) / SPHERE_SEGMENTS
        return v3(rho * Math.cos(t), rho * Math.sin(t), d)
      }),
      'section'
    )
  }

  const named: NamedPoint[] = []
  if (spec.names?.[0]) named.push({ name: spec.names[0], point: 0, dot: true, onSphere: false })
  for (const p of spec.points ?? []) {
    points.push(onSphere(p.latitude, p.longitude))
    named.push({ name: p.name, point: points.length - 1, dot: true, onSphere: true })
  }
  return { points, sphereCurves, section, named }
}

function planeToWorld(p: SolidPlanePoint, z = 0): Vec3 {
  return v3(p.x, p.y, z)
}

/**
 * The 3D geometry of a solid: points, faces with outward normals, the strokes to draw and when
 * each one is seen. Built once per spec; `projectSolid` turns it into a frame for any view.
 */
export function buildSolidGeometry(spec: SolidSpec): SolidGeometry {
  if (spec.kind === 'boule') {
    if (!(spec.radius > 0)) throw new Error('Boule : le rayon doit être positif')
    const sphere = sphereFromSpec(spec)
    return {
      ...sphere,
      faces: [],
      strokes: [],
      sphereRadius: spec.radius,
      center: v3(0, 0, 0),
      scale: (SOLID_SIZE / 2 - PADDING) / spec.radius,
    }
  }

  let mesh: MeshBuilder
  const named: NamedPoint[] = []
  const extraStrokes: Stroke[] = []
  const names = spec.names ?? []
  const nameVertices = (count: number) => {
    names.slice(0, count).forEach((name, i) => {
      if (name) named.push({ name, point: i, dot: false, onSphere: false })
    })
  }

  switch (spec.kind) {
    case 'pave':
    case 'cube': {
      const [w, h, d] =
        spec.kind === 'cube'
          ? [spec.edge, spec.edge, spec.edge]
          : [spec.width, spec.height, spec.depth]
      if (!(w > 0 && h > 0 && d > 0))
        throw new Error('Pavé : les dimensions doivent être positives')
      mesh = prismMesh([v3(0, 0, 0), v3(w, 0, 0), v3(w, 0, h), v3(0, 0, h)], d)
      nameVertices(8)
      break
    }
    case 'prisme': {
      if (spec.base.length < 3 || !(spec.depth > 0)) {
        throw new Error(
          'Prisme : il faut une base d’au moins trois sommets et une profondeur positive'
        )
      }
      // The base is the front face in true size: x to the right, y up.
      mesh = prismMesh(
        spec.base.map((p) => v3(p.x, 0, p.y)),
        spec.depth
      )
      nameVertices(2 * spec.base.length)
      break
    }
    case 'pyramide': {
      if (spec.base.length < 3 || !(spec.height > 0)) {
        throw new Error(
          'Pyramide : il faut une base d’au moins trois sommets et une hauteur positive'
        )
      }
      const base = spec.base.map((p) => planeToWorld(p))
      const foot = spec.apex ? planeToWorld(spec.apex) : centroid(base)
      mesh = pyramidMesh(base, v3(foot.x, foot.y, spec.height))
      nameVertices(base.length + 1)
      break
    }
    case 'cylindre': {
      if (!(spec.radius > 0 && spec.height > 0)) {
        throw new Error('Cylindre : le rayon et la hauteur doivent être positifs')
      }
      mesh = cylinderMesh(spec.radius, spec.height)
      if (names.length > 0) {
        const o = addPoint(mesh, v3(0, 0, 0))
        const o2 = addPoint(mesh, v3(0, 0, spec.height))
        extraStrokes.push({ a: o, b: o2, vis: { kind: 'inside' }, layer: 'edge' })
        if (names[0]) named.push({ name: names[0], point: o, dot: true, onSphere: false })
        if (names[1]) named.push({ name: names[1], point: o2, dot: true, onSphere: false })
      }
      break
    }
    case 'cone': {
      if (!(spec.radius > 0 && spec.height > 0)) {
        throw new Error('Cône : le rayon et la hauteur doivent être positifs')
      }
      mesh = coneMesh(spec.radius, spec.height)
      const apex = CURVE_SEGMENTS
      if (names.length > 0) {
        const o = addPoint(mesh, v3(0, 0, 0))
        extraStrokes.push({ a: o, b: apex, vis: { kind: 'inside' }, layer: 'edge' })
        if (names[0]) named.push({ name: names[0], point: o, dot: true, onSphere: false })
        if (names[1]) named.push({ name: names[1], point: apex, dot: false, onSphere: false })
      }
      break
    }
  }

  const strokes = [...edgeStrokes(mesh.faces), ...extraStrokes]
  const plane = sectionPlane(spec)
  const cut = plane ? meshSection(mesh, plane) : null
  if (cut) strokes.push(...cut.strokes)

  const shape = mesh.points.slice(0, solidPointCount(spec))
  const lo = v3(
    Math.min(...shape.map((p) => p.x)),
    Math.min(...shape.map((p) => p.y)),
    Math.min(...shape.map((p) => p.z))
  )
  const hi = v3(
    Math.max(...shape.map((p) => p.x)),
    Math.max(...shape.map((p) => p.y)),
    Math.max(...shape.map((p) => p.z))
  )
  const center = lerp(lo, hi, 0.5)
  const reach = Math.max(...shape.map((p) => length(sub(p, center))))
  return {
    points: mesh.points,
    faces: mesh.faces,
    strokes,
    sphereCurves: [],
    section: cut?.polygon ?? null,
    sphereRadius: null,
    named,
    center,
    scale: (SOLID_SIZE / 2 - PADDING) / reach,
  }
}

/** The points of the solid itself, before centres and section points were added. */
function solidPointCount(spec: SolidSpec): number {
  switch (spec.kind) {
    case 'pave':
    case 'cube':
      return 8
    case 'prisme':
      return 2 * spec.base.length
    case 'pyramide':
      return spec.base.length + 1
    case 'cylindre':
      return 2 * CURVE_SEGMENTS
    case 'cone':
      return CURVE_SEGMENTS + 1
    case 'boule':
      return 1
  }
}

// --- Projection (per view) ---

type Camera = {
  /** The direction the eye looks in, in the solid's own coordinates. */
  look: Vec3
  toScreen: (p: Vec3) => { x: number; y: number }
  /** A normal in the eye's frame: x right, y up, z towards the eye. */
  toEye: (n: Vec3) => Vec3
}

function camera(g: SolidGeometry, view: SolidView): Camera {
  const yaw = rad(view.yaw)
  const pitch = rad(view.pitch)
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const half = SOLID_SIZE / 2
  // Turn about z by the yaw, then look along (0, cos pitch, −sin pitch).
  const turn = (p: Vec3) => v3(p.x * cy - p.y * sy, p.x * sy + p.y * cy, p.z)
  return {
    look: v3(cp * sy, cp * cy, -sp),
    toScreen: (p) => {
      const q = turn(sub(p, g.center))
      return { x: half + q.x * g.scale, y: half - (q.y * sp + q.z * cp) * g.scale }
    },
    toEye: (n) => {
      const q = turn(n)
      return v3(q.x, q.y * sp + q.z * cp, -(q.y * cp - q.z * sp))
    },
  }
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** Joins segments that share an end into polylines, so a dash pattern runs on along a curve. */
function chain(segments: Array<[number, number]>): Array<{ ids: number[]; closed: boolean }> {
  const links = new Map<number, number[]>()
  segments.forEach(([a, b], i) => {
    links.set(a, [...(links.get(a) ?? []), i])
    links.set(b, [...(links.get(b) ?? []), i])
  })
  const used = new Array<boolean>(segments.length).fill(false)
  const walk = (start: number, first: number) => {
    const ids = [start]
    let at = start
    let seg: number | undefined = first
    while (seg !== undefined) {
      used[seg] = true
      const [a, b] = segments[seg]
      at = a === at ? b : a
      ids.push(at)
      seg = links.get(at)?.find((s) => !used[s])
    }
    return ids
  }
  const lines: Array<{ ids: number[]; closed: boolean }> = []
  // Open runs first, from their ends; what is left are loops.
  for (const [point, segs] of links) {
    if (segs.length !== 1 || used[segs[0]]) continue
    lines.push({ ids: walk(point, segs[0]), closed: false })
  }
  segments.forEach(([a], i) => {
    if (used[i]) return
    const ids = walk(a, i)
    const closed = ids.length > 2 && ids[0] === ids[ids.length - 1]
    lines.push({ ids: closed ? ids.slice(0, -1) : ids, closed })
  })
  return lines
}

function polylinePath(
  lines: Array<{ ids: number[]; closed: boolean }>,
  screen: Array<{ x: number; y: number }>
): string {
  return lines
    .map(({ ids, closed }) => {
      const pts = ids.map((i) => `${f1(screen[i].x)} ${f1(screen[i].y)}`)
      return `M${pts.join('L')}${closed ? 'Z' : ''}`
    })
    .join('')
}

function dotPath(points: Array<{ x: number; y: number }>): string {
  const r = DOT_RADIUS
  return points
    .map(
      (p) => `M${f1(p.x - r)} ${f1(p.y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
    )
    .join('')
}

function shadeOf(eyeNormal: Vec3): SolidShade {
  const light = dot(eyeNormal, LIGHT)
  if (light > 0.55) return 'top'
  if (light > 0) return 'front'
  return 'side'
}

export type SolidStrokeState = {
  a: number
  b: number
  layer: 'edge' | 'section'
  visible: boolean
}

function facingFaces(g: SolidGeometry, cam: Camera): boolean[] {
  return g.faces.map((f) => dot(f.normal, cam.look) < -EPS)
}

function strokesSeen(g: SolidGeometry, cam: Camera, facing: boolean[]): SolidStrokeState[] {
  const seen = (vis: Visibility): boolean => {
    if (vis.kind === 'inside') return false
    return vis.faces.some((f) => facing[f])
  }
  const states: SolidStrokeState[] = []
  for (const s of g.strokes) {
    // An edge between two faces of a curved surface is drawn only where they turn apart.
    if (s.silhouette && facing[s.silhouette[0]] === facing[s.silhouette[1]]) continue
    states.push({ a: s.a, b: s.b, layer: s.layer, visible: seen(s.vis) })
  }
  return states
}

/**
 * The strokes drawn in a view and whether each is seen, by point index. Point indices of a
 * polyhedron are its vertices in `names` order. For tests and for anyone checking a drawing.
 */
export function solidStrokes(g: SolidGeometry, view: SolidView): SolidStrokeState[] {
  const cam = camera(g, view)
  return strokesSeen(g, cam, facingFaces(g, cam))
}

type ScreenPoint = { x: number; y: number }

export type SolidRun = {
  layer: 'edge' | 'section'
  visible: boolean
  points: ScreenPoint[]
  /** A closed loop, entirely on one side of the outline. */
  closed: boolean
  /** Whether each end is where the curve crosses the outline. */
  cutAtStart: boolean
  cutAtEnd: boolean
}

/**
 * The curves on a sphere, cut exactly where they cross the outline (where the sphere's normal is
 * perpendicular to the eye's direction): the near part is seen, the far part dashed.
 */
function sphereRuns(g: SolidGeometry, cam: Camera): SolidRun[] {
  const runs: SolidRun[] = []
  for (const curve of g.sphereCurves) {
    const pts = curve.ids.map((i) => g.points[i])
    const side = pts.map((p) => dot(p, cam.look))
    // Samples along the loop, with a cut inserted wherever the side changes.
    const samples: Array<{ p: Vec3; cut: boolean }> = []
    pts.forEach((a, i) => {
      const j = (i + 1) % pts.length
      samples.push({ p: a, cut: false })
      if (side[i] < 0 !== side[j] < 0) {
        const t = side[i] / (side[i] - side[j])
        samples.push({ p: lerp(a, pts[j], t), cut: true })
      }
    })
    const firstCut = samples.findIndex((x) => x.cut)
    if (firstCut < 0) {
      runs.push({
        layer: curve.layer,
        visible: side[0] < 0,
        points: pts.map(cam.toScreen),
        closed: true,
        cutAtStart: false,
        cutAtEnd: false,
      })
      continue
    }
    const loop = [...samples.slice(firstCut), ...samples.slice(0, firstCut), samples[firstCut]]
    let current: Vec3[] = [loop[0].p]
    let visible = false
    for (let k = 1; k < loop.length; k++) {
      const x = loop[k]
      if (!x.cut) visible = dot(x.p, cam.look) < 0
      current.push(x.p)
      if (x.cut) {
        runs.push({
          layer: curve.layer,
          visible,
          points: current.map(cam.toScreen),
          closed: false,
          cutAtStart: true,
          cutAtEnd: true,
        })
        current = [x.p]
      }
    }
  }
  return runs
}

/** The curves of a sphere in a view, cut at its outline. For tests. */
export function solidSphereRuns(g: SolidGeometry, view: SolidView): SolidRun[] {
  return sphereRuns(g, camera(g, view))
}

function runPath(runs: SolidRun[]): string {
  return runs
    .map(
      (r) => 'M' + r.points.map((p) => `${f1(p.x)} ${f1(p.y)}`).join('L') + (r.closed ? 'Z' : '')
    )
    .join('')
}

/** Projects the geometry for one view: what is seen, what is hidden, where each name goes. */
export function projectSolid(g: SolidGeometry, view: SolidView): SolidFrame {
  const cam = camera(g, view)
  const screen = g.points.map(cam.toScreen)
  const facing = facingFaces(g, cam)

  const fills: Record<SolidShade, string[]> = { top: [], front: [], side: [] }
  g.faces.forEach((face, i) => {
    if (!facing[i]) return
    const shade = face.smooth ? 'front' : shadeOf(cam.toEye(face.normal))
    fills[shade].push(
      'M' + face.vertices.map((v) => `${f1(screen[v].x)} ${f1(screen[v].y)}`).join('L') + 'Z'
    )
  })

  const buckets = {
    edge: { visible: [] as Array<[number, number]>, hidden: [] as Array<[number, number]> },
    section: { visible: [] as Array<[number, number]>, hidden: [] as Array<[number, number]> },
  }
  // Every stroke drawn, on screen: a name keeps clear of all of them.
  const obstacles: Array<[ScreenPoint, ScreenPoint]> = []
  for (const s of strokesSeen(g, cam, facing)) {
    buckets[s.layer][s.visible ? 'visible' : 'hidden'].push([s.a, s.b])
    obstacles.push([screen[s.a], screen[s.b]])
  }
  const runs = sphereRuns(g, cam)
  for (const run of runs) {
    for (let i = 1; i < run.points.length; i++) obstacles.push([run.points[i - 1], run.points[i]])
  }
  const pick = (layer: SolidRun['layer'], visible: boolean) =>
    runPath(runs.filter((r) => r.layer === layer && r.visible === visible))

  let visible = polylinePath(chain(buckets.edge.visible), screen) + pick('edge', true)
  const center = cam.toScreen(g.center)
  const outline = g.sphereRadius !== null ? { c: center, r: g.sphereRadius * g.scale } : null
  if (g.sphereRadius !== null) {
    // The outline of a ball is always a circle, always seen.
    const r = g.sphereRadius * g.scale
    const circle = `M${f1(center.x - r)} ${f1(center.y)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`
    visible = circle + visible
    fills.front.push(circle)
  }

  const dots: Array<{ x: number; y: number }> = []
  const hiddenDots: Array<{ x: number; y: number }> = []
  const placed: ScreenPoint[] = []
  const labels = g.named.map((n) => {
    const at = screen[n.point]
    if (n.dot) {
      const behind = n.onSphere && dot(normalize(g.points[n.point]), cam.look) > 0
      ;(behind ? hiddenDots : dots).push(at)
    }
    const label = placeLabel(n.name, at, {
      strokes: obstacles,
      outline,
      labels: placed,
      away: sub2(at, center),
      offset: n.dot ? DOT_LABEL_OFFSET : LABEL_OFFSET,
    })
    placed.push(label)
    return label
  })

  return {
    fills: { top: fills.top.join(''), front: fills.front.join(''), side: fills.side.join('') },
    hidden: polylinePath(chain(buckets.edge.hidden), screen) + pick('edge', false),
    visible,
    sectionFill: g.section
      ? 'M' + g.section.map((i) => `${f1(screen[i].x)} ${f1(screen[i].y)}`).join('L') + 'Z'
      : '',
    sectionHidden: polylinePath(chain(buckets.section.hidden), screen) + pick('section', false),
    sectionVisible: polylinePath(chain(buckets.section.visible), screen) + pick('section', true),
    dots: dotPath(dots),
    hiddenDots: dotPath(hiddenDots),
    labels,
  }
}

function sub2(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: a.x - b.x, y: a.y - b.y }
}

function distanceToSegment(p: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 < EPS ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** The eight places a name can take around its point, clockwise from the right. */
const LABEL_DIRECTIONS = range(8).map((k) => ({
  x: Math.cos((k * Math.PI) / 4),
  y: Math.sin((k * Math.PI) / 4),
}))

/**
 * A name is centred on one of eight places around its point: the one farthest from every stroke
 * drawn in this view (seen or dashed), from the outline of a ball and from the names already
 * placed. Once a place is clear enough, the side facing away from the solid wins.
 */
function placeLabel(
  text: string,
  at: ScreenPoint,
  around: {
    strokes: Array<[ScreenPoint, ScreenPoint]>
    outline: { c: ScreenPoint; r: number } | null
    labels: ScreenPoint[]
    away: ScreenPoint
    offset: number
  }
): SolidLabel {
  const awayLength = Math.hypot(around.away.x, around.away.y)
  const away =
    awayLength < 1
      ? { x: Math.SQRT1_2, y: -Math.SQRT1_2 }
      : {
          x: around.away.x / awayLength,
          y: around.away.y / awayLength,
        }
  let best = { score: -Infinity, c: at }
  for (const u of LABEL_DIRECTIONS) {
    const c = { x: at.x + u.x * around.offset, y: at.y + u.y * around.offset }
    let clearance = Infinity
    for (const [a, b] of around.strokes) clearance = Math.min(clearance, distanceToSegment(c, a, b))
    if (around.outline) {
      const d = Math.hypot(c.x - around.outline.c.x, c.y - around.outline.c.y)
      clearance = Math.min(clearance, Math.abs(d - around.outline.r))
    }
    for (const l of around.labels)
      clearance = Math.min(clearance, Math.hypot(c.x - l.x, c.y - l.y) - 8)
    const score = Math.min(clearance, LABEL_CLEARANCE) + (u.x * away.x + u.y * away.y)
    if (score > best.score + 1e-9) best = { score, c }
  }
  return {
    text,
    x: Math.round(best.c.x * 10) / 10,
    y: Math.round(best.c.y * 10) / 10,
    anchor: 'middle',
    baseline: 'middle',
  }
}

// --- Views (pure helpers for the interaction) ---

function wrapDegrees(deg: number): number {
  const w = ((((deg + 180) % 360) + 360) % 360) - 180
  return w === -180 ? 180 : w
}

/** Keeps the yaw in ]−180, 180] and the pitch between straight below and straight above. */
export function clampView(view: SolidView): SolidView {
  return { yaw: wrapDegrees(view.yaw), pitch: Math.max(-90, Math.min(90, view.pitch)) }
}

/** The view after a drag of (dx, dy) pixels: right turns the front to the right, down shows the top. */
export function dragView(view: SolidView, dx: number, dy: number): SolidView {
  return clampView({
    yaw: view.yaw + dx * DRAG_DEGREES_PER_PX,
    pitch: view.pitch + dy * DRAG_DEGREES_PER_PX,
  })
}

export type SolidKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

/** One arrow key turns the solid by 15°, in the direction a drag the same way would. */
export function stepView(view: SolidView, key: SolidKey): SolidView {
  const s = KEY_STEP_DEGREES
  switch (key) {
    case 'ArrowLeft':
      return clampView({ ...view, yaw: view.yaw - s })
    case 'ArrowRight':
      return clampView({ ...view, yaw: view.yaw + s })
    case 'ArrowUp':
      return clampView({ ...view, pitch: view.pitch - s })
    case 'ArrowDown':
      return clampView({ ...view, pitch: view.pitch + s })
  }
}

/** Velocity in degrees per millisecond, from a drag velocity in pixels per millisecond. */
export function dragVelocity(vx: number, vy: number): SolidView {
  return { yaw: vx * DRAG_DEGREES_PER_PX, pitch: vy * DRAG_DEGREES_PER_PX }
}

/**
 * The solid keeps turning after a flick and slows down: the velocity decays with time constant
 * `tau` (ms). Returns the next view and velocity, or a null velocity once it has stopped.
 */
export function coastView(
  view: SolidView,
  velocity: SolidView,
  dt: number,
  tau: number
): { view: SolidView; velocity: SolidView | null } {
  const decay = Math.exp(-dt / tau)
  // Distance covered while the velocity decays from v to v·decay: v·tau·(1 − decay).
  const k = tau * (1 - decay)
  const next = clampView({
    yaw: view.yaw + velocity.yaw * k,
    pitch: view.pitch + velocity.pitch * k,
  })
  const v = { yaw: velocity.yaw * decay, pitch: velocity.pitch * decay }
  const stopped = Math.hypot(v.yaw, v.pitch) < 0.005
  return { view: next, velocity: stopped ? null : v }
}

/** The view a fraction `t` of the way from `from` to `to`, the yaw by the shorter way round. */
export function interpolateView(from: SolidView, to: SolidView, t: number): SolidView {
  const dyaw = wrapDegrees(to.yaw - from.yaw)
  return clampView({ yaw: from.yaw + dyaw * t, pitch: from.pitch + (to.pitch - from.pitch) * t })
}

export function sameView(a: SolidView, b: SolidView): boolean {
  return Math.abs(wrapDegrees(a.yaw - b.yaw)) < 0.01 && Math.abs(a.pitch - b.pitch) < 0.01
}
