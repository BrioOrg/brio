#!/usr/bin/env node
/**
 * Validates chapter content files for two categories of problems:
 *
 * 1. richText delimiter balance — **bold**, *italic*, $...$ inline math.
 *    An unclosed delimiter renders as raw markup for students.
 *
 * 2. Figure spec correctness — structural and geometric:
 *    - All segment/polygon/angleMark/lengthMark references name a defined point.
 *    - No duplicate point names within a figure.
 *    - Every polygon has ≥ 3 non-collinear vertices.
 *    - Every angleMark with right:true measures 90° ± 0.5° at the given coordinates.
 *    - Every lengthMark references a segment that exists.
 *    - Segments sharing the same tick count have equal Euclidean length ± 1e-6 relative.
 *    - Every circle's center and through point (if given) are defined.
 *    - numberLines: from < to, step > 0, labelEvery > 0 and a multiple of step.
 *
 * Scanned: content/ (excluding referentiel) + docs/schema/examples/.
 * Zero dependencies; exits non-zero on any problem.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// --- Geometry helpers (duplicated from packages/content to keep zero dependencies) ---

function vecLen(v) {
  return Math.hypot(v.x, v.y)
}

function angleDegrees(vertex, from, to) {
  const arm1 = { x: from.x - vertex.x, y: from.y - vertex.y }
  const arm2 = { x: to.x - vertex.x, y: to.y - vertex.y }
  const l1 = vecLen(arm1)
  const l2 = vecLen(arm2)
  if (l1 < 1e-12 || l2 < 1e-12) return NaN
  const dot = arm1.x * arm2.x + arm1.y * arm2.y
  const cosA = Math.max(-1, Math.min(1, dot / (l1 * l2)))
  return (Math.acos(cosA) * 180) / Math.PI
}

function euclidean(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y)
}

function isCollinear(pts) {
  if (pts.length < 3) return true
  const dx = pts[1].x - pts[0].x
  const dy = pts[1].y - pts[0].y
  for (let i = 2; i < pts.length; i++) {
    const cross = (pts[i].x - pts[0].x) * dy - (pts[i].y - pts[0].y) * dx
    if (Math.abs(cross) > 1e-9) return false
  }
  return true
}

function findSegment(name, segments) {
  return segments.find((s) => s.from + s.to === name || s.to + s.from === name)
}

const repoRoot = new URL('..', import.meta.url).pathname

const errors = []

function fail(file, path, message) {
  errors.push(`${relative(repoRoot, file)} (${path}): ${message}`)
}

/**
 * Checks that **,  *, and $ delimiters are balanced in a richText string.
 * Escapes (\* and \$) are stripped before counting.
 */
function checkDelimiters(value, file, path) {
  // Strip escape sequences so they don't affect counts
  let s = value.replace(/\\\$/g, '').replace(/\\\*/g, '')

  // 1. Check $ balance
  const dollarCount = (s.match(/\$/g) ?? []).length
  if (dollarCount % 2 !== 0) {
    fail(file, path, `unbalanced $ delimiter (${dollarCount} found) in: ${JSON.stringify(value)}`)
    return
  }

  // 2. Remove balanced math spans, then check ** balance
  s = s.replace(/\$[^$]*\$/g, '')
  const boldMarkerCount = (s.match(/\*\*/g) ?? []).length
  if (boldMarkerCount % 2 !== 0) {
    fail(
      file,
      path,
      `unbalanced ** delimiter (${boldMarkerCount} markers found) in: ${JSON.stringify(value)}`,
    )
    return
  }

  // 3. Remove balanced bold spans, then check * balance
  s = s.replace(/\*\*[\s\S]*?\*\*/g, '')
  const italicCount = (s.match(/\*/g) ?? []).length
  if (italicCount % 2 !== 0) {
    fail(
      file,
      path,
      `unbalanced * delimiter (${italicCount} found) in: ${JSON.stringify(value)}`,
    )
  }
}

function walkStrings(node, file, path) {
  if (typeof node === 'string') {
    // Only check strings that contain potential richText markup
    if (/[*$]/.test(node)) {
      checkDelimiters(node, file, path)
    }
  } else if (Array.isArray(node)) {
    node.forEach((item, i) => walkStrings(item, file, `${path}[${i}]`))
  } else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      walkStrings(value, file, path ? `${path}.${key}` : key)
    }
  }
}

// --- Figure validation ---

function checkFigureBlock(block, file, blockPath) {
  const spec = block.spec
  if (!spec || typeof spec !== 'object') {
    fail(file, blockPath + '.spec', 'figure block is missing a spec object')
    return
  }

  const points = spec.points ?? []
  const segments = spec.segments ?? []

  // Build point map
  const pointMap = new Map()
  const seenNames = new Set()
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (seenNames.has(p.name)) {
      fail(file, `${blockPath}.spec.points[${i}]`, `duplicate point name "${p.name}"`)
    }
    seenNames.add(p.name)
    pointMap.set(p.name, { x: p.x, y: p.y })
  }

  function requirePt(name, path) {
    if (!pointMap.has(name)) {
      fail(file, path, `point "${name}" is not defined in spec.points`)
      return null
    }
    return pointMap.get(name)
  }

  // Segments
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const p = `${blockPath}.spec.segments[${i}]`
    requirePt(seg.from, p + '.from')
    requirePt(seg.to, p + '.to')
  }

  // Polygons
  for (let i = 0; i < (spec.polygons ?? []).length; i++) {
    const poly = spec.polygons[i]
    const p = `${blockPath}.spec.polygons[${i}]`
    if (poly.vertices.length < 3) {
      fail(file, p, 'polygon must have at least 3 vertices')
      continue
    }
    const pts = []
    let ok = true
    for (const name of poly.vertices) {
      const pt = requirePt(name, p + '.vertices')
      if (!pt) { ok = false; break }
      pts.push(pt)
    }
    if (ok && isCollinear(pts)) {
      fail(file, p, `polygon vertices [${poly.vertices.join(', ')}] are collinear (degenerate)`)
    }
  }

  // Circles
  for (let i = 0; i < (spec.circles ?? []).length; i++) {
    const c = spec.circles[i]
    const p = `${blockPath}.spec.circles[${i}]`
    requirePt(c.center, p + '.center')
    if (c.through !== undefined) requirePt(c.through, p + '.through')
    if (c.through === undefined && c.radius === undefined) {
      fail(file, p, 'circle must have either "through" or "radius"')
    }
    if (c.through !== undefined && c.radius !== undefined) {
      fail(file, p, 'circle must not have both "through" and "radius"')
    }
  }

  // Angle marks
  for (let i = 0; i < (spec.angleMarks ?? []).length; i++) {
    const am = spec.angleMarks[i]
    const p = `${blockPath}.spec.angleMarks[${i}]`
    const vertex = requirePt(am.vertex, p + '.vertex')
    const fromPt = requirePt(am.from, p + '.from')
    const toPt = requirePt(am.to, p + '.to')
    if (!vertex || !fromPt || !toPt) continue

    if (am.right) {
      const angle = angleDegrees(vertex, fromPt, toPt)
      if (isNaN(angle)) {
        fail(file, p, `right angle at "${am.vertex}": degenerate arm (zero length)`)
      } else if (Math.abs(angle - 90) > 0.5) {
        fail(
          file,
          p,
          `right angle at "${am.vertex}" (from "${am.from}" to "${am.to}") measures ${angle.toFixed(4)}°, expected 90° ± 0.5°`,
        )
      }
    }
  }

  // Length marks
  const tickGroups = new Map() // ticks → [length, ...]
  for (let i = 0; i < (spec.lengthMarks ?? []).length; i++) {
    const lm = spec.lengthMarks[i]
    const p = `${blockPath}.spec.lengthMarks[${i}]`
    const rawSeg = findSegment(lm.segment, segments)
    if (!rawSeg) {
      fail(file, p, `segment "${lm.segment}" not found in spec.segments`)
      continue
    }
    const p1 = pointMap.get(rawSeg.from)
    const p2 = pointMap.get(rawSeg.to)
    if (!p1 || !p2) continue
    const length = euclidean(p1, p2)
    if (!tickGroups.has(lm.ticks)) tickGroups.set(lm.ticks, [])
    tickGroups.get(lm.ticks).push({ length, segment: lm.segment, path: p })
  }

  for (const [ticks, group] of tickGroups) {
    if (group.length < 2) continue
    const ref = group[0].length
    for (let j = 1; j < group.length; j++) {
      const { length, segment, path } = group[j]
      const rel = ref > 1e-12 ? Math.abs(length - ref) / ref : Math.abs(length - ref)
      if (rel > 1e-6) {
        fail(
          file,
          path,
          `lengthMark ticks=${ticks}: segment "${segment}" has length ${length.toFixed(6)} but other segments in this group have length ${ref.toFixed(6)} — they are declared equal but are not`,
        )
      }
    }
  }

  // Number lines
  for (let i = 0; i < (spec.numberLines ?? []).length; i++) {
    const nl = spec.numberLines[i]
    const p = `${blockPath}.spec.numberLines[${i}]`
    if (nl.from >= nl.to) fail(file, p, `numberLine: from (${nl.from}) must be less than to (${nl.to})`)
    if (nl.step <= 0) fail(file, p, `numberLine: step must be > 0, got ${nl.step}`)
    if (nl.labelEvery !== undefined) {
      if (nl.labelEvery <= 0) {
        fail(file, p, `numberLine: labelEvery must be > 0, got ${nl.labelEvery}`)
      } else {
        const ratio = nl.labelEvery / nl.step
        if (Math.abs(ratio - Math.round(ratio)) > 1e-9) {
          fail(file, p, `numberLine: labelEvery (${nl.labelEvery}) must be a positive multiple of step (${nl.step})`)
        }
      }
    }
  }
}

function checkFigures(doc, file) {
  for (const section of doc.sections ?? []) {
    for (let i = 0; i < (section.blocks ?? []).length; i++) {
      const block = section.blocks[i]
      if (block.type === 'figure') {
        checkFigureBlock(block, file, `sections[id=${section.id}].blocks[${i}]`)
      }
    }
  }
}

function jsonFilesUnder(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true, recursive: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => join(e.parentPath, e.name))
}

const contentFiles = [
  ...jsonFilesUnder(join(repoRoot, 'content')).filter((f) => !f.includes('/referentiel/')),
  ...jsonFilesUnder(join(repoRoot, 'docs/schema/examples')),
]

let fileCount = 0
for (const file of contentFiles) {
  try {
    const doc = JSON.parse(readFileSync(file, 'utf8'))
    walkStrings(doc, file, '')
    checkFigures(doc, file)
    fileCount++
  } catch (e) {
    errors.push(`${relative(repoRoot, file)}: invalid JSON: ${e.message}`)
  }
}

if (errors.length > 0) {
  console.error(`✗ Content check failed (${errors.length} problem(s)):`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log(`✓ Content checks passed in ${fileCount} file(s) (rich-text delimiters + figure specs).`)
