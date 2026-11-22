// The rules a solid block must follow beyond its JSON schema (ADR 0039 §8), in one place:
// scripts/check-content.mjs reports them in English for the catalogue, the teacher editor in
// French before publication. Each issue is a code plus the facts its message needs.
//
// No imports: check-content loads this file with Node's type stripping, which does not resolve
// extensionless relative imports.

export const SOLID_KINDS = [
  'pave',
  'cube',
  'prisme',
  'cylindre',
  'pyramide',
  'cone',
  'boule',
] as const
export const SOLID_MAX_BASE_VERTICES = 12
export const SOLID_MAX_SPHERE_LINES = 12

/** The dimensions each kind requires, all strictly positive. */
export const SOLID_DIMENSIONS: Record<string, readonly string[]> = {
  pave: ['width', 'height', 'depth'],
  cube: ['edge'],
  prisme: ['depth'],
  cylindre: ['radius', 'height'],
  pyramide: ['height'],
  cone: ['radius', 'height'],
  boule: ['radius'],
}

/** The section planes each kind accepts; a ball's section has no `parallelTo`. */
export const SOLID_SECTION_PLANES: Record<string, readonly string[]> = {
  pave: ['base', 'front', 'side'],
  cube: ['base', 'front', 'side'],
  prisme: ['base'],
  cylindre: ['base', 'axis'],
  pyramide: ['base'],
  cone: ['base'],
  boule: [],
}

export const SPHERE_ONLY_FIELDS = ['equator', 'parallels', 'meridians', 'points'] as const

export type SolidIssue =
  | { code: 'UNKNOWN_KIND'; path: 'kind'; kind: string }
  | { code: 'DIMENSION_NOT_POSITIVE'; path: string; field: string }
  | { code: 'BASE_SIZE'; path: 'base'; count: number; max: number }
  | { code: 'BASE_NOT_CONVEX'; path: 'base' }
  | { code: 'NAMES_COUNT'; path: 'names'; kind: string; expected: number; count: number }
  | { code: 'BLANK_NAME'; path: string; index: number }
  | { code: 'DUPLICATE_NAME'; path: string; name: string }
  | { code: 'SECTION_PLANE'; path: 'section.parallelTo'; kind: string; plane: string }
  | {
      code: 'SECTION_OUT_OF_RANGE'
      path: 'section.at'
      at: number
      min: number
      max: number
      minIncluded: boolean
    }
  | { code: 'SPHERE_ONLY_FIELD'; path: string; field: string }
  | { code: 'LATITUDE_OUT_OF_RANGE'; path: string; value: number }
  | { code: 'LONGITUDE_OUT_OF_RANGE'; path: string; value: number }
  | { code: 'TOO_MANY_LINES'; path: string; count: number; max: number }

export type SolidIssueCode = SolidIssue['code']

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** How many names a solid takes: its vertices, its centres (cylinder, cone, ball). */
export function solidNameCount(block: Record<string, unknown>): number {
  const base = Array.isArray(block.base) ? block.base.length : 0
  switch (block.kind) {
    case 'pave':
    case 'cube':
      return 8
    case 'prisme':
      return 2 * base
    case 'pyramide':
      return base + 1
    case 'cylindre':
    case 'cone':
      return 2
    case 'boule':
      return 1
    default:
      return 0
  }
}

// A convex polygon turns the same way at every vertex; collinear neighbours are degenerate.
function isStrictlyConvex(pts: Array<{ x: number; y: number }>): boolean {
  let sign = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const c = pts[(i + 2) % pts.length]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-9) return false
    if (sign === 0) sign = Math.sign(cross)
    else if (Math.sign(cross) !== sign) return false
  }
  // A star turns the same way at every vertex too: its angles add up to more than one turn.
  let turn = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const c = pts[(i + 2) % pts.length]
    const u = Math.atan2(b.y - a.y, b.x - a.x)
    const v = Math.atan2(c.y - b.y, c.x - b.x)
    let d = v - u
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    turn += d
  }
  return Math.abs(Math.abs(turn) - 2 * Math.PI) < 1e-6
}

/** The interval `at` must lie in, for a section of this solid on this plane. */
function sectionRange(
  block: Record<string, unknown>,
  plane: string
): { min: number; max: number; minIncluded: boolean } | null {
  const get = (field: string) => num(block[field]) ?? 0
  switch (block.kind) {
    case 'pave':
      return {
        min: 0,
        max: plane === 'front' ? get('depth') : plane === 'side' ? get('width') : get('height'),
        minIncluded: false,
      }
    case 'cube':
      return { min: 0, max: get('edge'), minIncluded: false }
    case 'prisme':
      return { min: 0, max: get('depth'), minIncluded: false }
    case 'cylindre':
      return plane === 'axis'
        ? { min: 0, max: get('radius'), minIncluded: true }
        : { min: 0, max: get('height'), minIncluded: false }
    case 'pyramide':
    case 'cone':
      return { min: 0, max: get('height'), minIncluded: false }
    case 'boule':
      return { min: -get('radius'), max: get('radius'), minIncluded: false }
    default:
      return null
  }
}

/**
 * Every rule a solid block breaks, in reading order. Paths are relative to the block:
 * `base[2]`, `points[0].latitude`. An empty list means the solid is fine.
 */
export function checkSolid(block: Record<string, unknown>): SolidIssue[] {
  const issues: SolidIssue[] = []
  const kind = typeof block.kind === 'string' ? block.kind : ''
  if (!(SOLID_KINDS as readonly string[]).includes(kind)) {
    issues.push({ code: 'UNKNOWN_KIND', path: 'kind', kind })
    return issues
  }

  for (const field of SOLID_DIMENSIONS[kind]) {
    const v = num(block[field])
    if (v === null || v <= 0) issues.push({ code: 'DIMENSION_NOT_POSITIVE', path: field, field })
  }

  if (kind === 'prisme' || kind === 'pyramide') {
    const base = Array.isArray(block.base) ? block.base : []
    const pts = base.map((p) => (isRecord(p) ? { x: num(p.x) ?? NaN, y: num(p.y) ?? NaN } : null))
    if (base.length < 3 || base.length > SOLID_MAX_BASE_VERTICES) {
      issues.push({
        code: 'BASE_SIZE',
        path: 'base',
        count: base.length,
        max: SOLID_MAX_BASE_VERTICES,
      })
    } else if (
      pts.some((p) => p === null || !Number.isFinite(p.x) || !Number.isFinite(p.y)) ||
      !isStrictlyConvex(pts as Array<{ x: number; y: number }>)
    ) {
      issues.push({ code: 'BASE_NOT_CONVEX', path: 'base' })
    }
  }

  const seen = new Set<string>()
  const claim = (name: unknown, path: string, index: number) => {
    const text = typeof name === 'string' ? name.trim() : ''
    if (text === '') issues.push({ code: 'BLANK_NAME', path, index })
    else if (seen.has(text)) issues.push({ code: 'DUPLICATE_NAME', path, name: text })
    seen.add(text)
  }
  if (Array.isArray(block.names)) {
    const expected = solidNameCount(block)
    if (block.names.length !== expected) {
      issues.push({ code: 'NAMES_COUNT', path: 'names', kind, expected, count: block.names.length })
    }
    block.names.forEach((name, i) => claim(name, `names[${i}]`, i))
  }

  if (kind === 'boule') {
    const lines = (field: 'parallels' | 'meridians', ok: (v: number) => boolean) => {
      const values = Array.isArray(block[field]) ? (block[field] as unknown[]) : []
      if (values.length > SOLID_MAX_SPHERE_LINES) {
        issues.push({
          code: 'TOO_MANY_LINES',
          path: field,
          count: values.length,
          max: SOLID_MAX_SPHERE_LINES,
        })
      }
      values.forEach((v, i) => {
        const n = num(v)
        if (n !== null && ok(n)) return
        const path = `${field}[${i}]`
        issues.push(
          field === 'parallels'
            ? { code: 'LATITUDE_OUT_OF_RANGE', path, value: n ?? NaN }
            : { code: 'LONGITUDE_OUT_OF_RANGE', path, value: n ?? NaN }
        )
      })
    }
    // A parallel at ±90° is a pole, not a line.
    lines('parallels', (v) => v > -90 && v < 90)
    lines('meridians', (v) => v >= -180 && v <= 180)
    const points = Array.isArray(block.points) ? block.points : []
    points.forEach((p, i) => {
      const point = isRecord(p) ? p : {}
      claim(point.name, `points[${i}].name`, i)
      const lat = num(point.latitude)
      const lon = num(point.longitude)
      if (lat === null || lat < -90 || lat > 90) {
        issues.push({
          code: 'LATITUDE_OUT_OF_RANGE',
          path: `points[${i}].latitude`,
          value: lat ?? NaN,
        })
      }
      if (lon === null || lon < -180 || lon > 180) {
        issues.push({
          code: 'LONGITUDE_OUT_OF_RANGE',
          path: `points[${i}].longitude`,
          value: lon ?? NaN,
        })
      }
    })
  } else {
    for (const field of SPHERE_ONLY_FIELDS) {
      if (block[field] !== undefined) issues.push({ code: 'SPHERE_ONLY_FIELD', path: field, field })
    }
  }

  if (isRecord(block.section)) {
    const parallelTo = block.section.parallelTo
    const allowed = SOLID_SECTION_PLANES[kind]
    const plane = typeof parallelTo === 'string' ? parallelTo : kind === 'boule' ? '' : 'base'
    if (kind === 'boule' ? parallelTo !== undefined : !allowed.includes(plane)) {
      issues.push({
        code: 'SECTION_PLANE',
        path: 'section.parallelTo',
        kind,
        plane: String(parallelTo),
      })
    } else {
      const range = sectionRange(block, plane)
      const at = num(block.section.at)
      if (
        range &&
        (at === null ||
          at > range.max - 1e-9 ||
          (range.minIncluded ? at < range.min : at < range.min + 1e-9))
      ) {
        issues.push({ code: 'SECTION_OUT_OF_RANGE', path: 'section.at', at: at ?? NaN, ...range })
      }
    }
  }

  return issues
}
