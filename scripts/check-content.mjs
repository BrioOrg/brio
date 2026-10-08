#!/usr/bin/env node
/**
 * Validates chapter content files for two categories of problems:
 *
 * 1. richText delimiter balance — **bold**, *italic*, $...$ inline math.
 *    An unclosed delimiter renders as raw markup for students.
 *
 * 2. Figure spec correctness — structural and geometric:
 *    - All segment/polygon/angleMark/lengthMark references name a defined point.
 *    - No duplicate point names within a figure, and no blank one: hide a construction point
 *      with dot: false / showName: false instead (#214).
 *    - Every polygon has ≥ 3 non-collinear vertices.
 *    - Every angleMark with right:true measures 90° ± 0.5° at the given coordinates.
 *    - Every lengthMark references a segment that exists.
 *    - Segments sharing the same tick count have equal Euclidean length ± 1e-6 relative.
 *    - Every circle's center and through point (if given) are defined.
 *    - numberLines: from < to, step > 0, labelEvery > 0 and a multiple of step.
 *    - polylines: every point is defined.
 *    - axes (repère, ADR 0013 amendment #214): on each axis from < to, from ≤ 0 ≤ to,
 *      step > 0, labelEvery a multiple of step; no coordinateSpace or numberLines alongside.
 *      Each axis has its own scale, so angleMarks, lengthMarks and circles are only allowed
 *      when both spans are equal: otherwise the drawing would not show what CI measured.
 *    - solids (perspective cavalière, ADR 0013 amendment #215): positive dimensions, reduction
 *      in ]0, 1], angle in ]0°, 180°[ and not 90°, a convex non-degenerate prism base, names in
 *      the right number (front face then back face), unique, not blank and not shared with a
 *      point; no solid in a repère or next to a number line.
 *
 * 3. Chart blocks (ADR 0030): exactly one series; 2 to 12 categories (6 for a pie), labels not
 *    blank and not duplicated; finite values, none negative in a bar, all positive in a pie;
 *    yMax not below the largest value; yStep positive and at most 20 graduations; no axis
 *    field (xLabel, yLabel, yMax, yStep, showValues) on a pie.
 *
 * 4. Scratch programmes (ADR 0031): a code block with language "scratch" must parse with the
 *    renderer's own parser (packages/content/src/scratch.ts), every faulty line reported. The
 *    `code` of a code block is never rich text, so it is not checked for delimiters: `*` is
 *    Scratch's multiplication sign there.
 *
 * 5. Chapter id uniqueness — a chapter's `id` is its slug and must be unique across
 *    content/chapitres and content/annales (ADR 0011, #218): ingestion keys chapters
 *    on `id` alone.
 *
 * Scanned: content/ (excluding referentiel) + docs/schema/examples/.
 * No dependencies; it imports the Scratch parser as TypeScript, so it runs with Node's type
 * stripping: `pnpm check:content` (node --experimental-strip-types). Exits non-zero on any problem.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

let parseScratch
try {
  ;({ parseScratch } = await import('../packages/content/src/scratch.ts'))
} catch (e) {
  console.error(
    '✗ check-content loads the Scratch parser as TypeScript: run `pnpm check:content`\n' +
      '  (node --experimental-strip-types scripts/check-content.mjs).\n  ' +
      e.message,
  )
  process.exit(1)
}

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
      // A code block's text is shown as written, never as rich text (ADR 0031).
      if (node.type === 'code' && key === 'code') continue
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
    if (p.name.trim() === '') {
      fail(
        file,
        `${blockPath}.spec.points[${i}]`,
        'blank point name: give it a real name and hide it with "dot": false, "showName": false',
      )
    }
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

  // Polylines
  for (let i = 0; i < (spec.polylines ?? []).length; i++) {
    const p = `${blockPath}.spec.polylines[${i}]`
    for (const name of spec.polylines[i].points) requirePt(name, p + '.points')
  }

  if (spec.axes) checkAxes(spec, file, `${blockPath}.spec.axes`)

  const solidNames = new Set()
  for (let i = 0; i < (spec.solids ?? []).length; i++) {
    checkSolid(spec.solids[i], seenNames, solidNames, file, `${blockPath}.spec.solids[${i}]`)
  }
  if ((spec.solids ?? []).length > 0 && (spec.axes || (spec.numberLines ?? []).length > 0)) {
    fail(file, `${blockPath}.spec.solids`, 'a solid cannot share a figure with axes or numberLines')
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

// A convex polygon turns the same way at every vertex; collinear neighbours are degenerate.
function isStrictlyConvex(pts) {
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
  return true
}

function checkSolid(solid, pointNames, solidNames, file, path) {
  const dims = { pave: ['width', 'height', 'depth'], cube: ['edge'], prisme: ['depth'], cylindre: ['radius', 'height'] }
  for (const key of dims[solid.kind] ?? []) {
    if (!(solid[key] > 0)) fail(file, path, `solid ${solid.kind}: ${key} must be > 0, got ${solid[key]}`)
  }
  if (solid.reduction !== undefined && !(solid.reduction > 0 && solid.reduction <= 1)) {
    fail(file, path, `solid: reduction must be in ]0, 1], got ${solid.reduction}`)
  }
  if (solid.angle !== undefined && !(solid.angle > 0 && solid.angle < 180 && solid.angle !== 90)) {
    fail(file, path, `solid: angle must be in ]0, 180[ and not 90 (receding edges would be vertical), got ${solid.angle}`)
  }
  let vertexCount = 0
  if (solid.kind === 'pave' || solid.kind === 'cube') vertexCount = 8
  if (solid.kind === 'prisme') {
    const base = solid.base ?? []
    vertexCount = 2 * base.length
    if (base.length < 3 || !isStrictlyConvex(base)) {
      fail(file, path + '.base', 'prism base must be a convex polygon with no three consecutive collinear vertices')
    }
  }
  if (solid.names === undefined) return
  if (solid.kind === 'cylindre') {
    fail(file, path + '.names', 'a cylinder has no vertices to name')
    return
  }
  if (solid.names.length !== vertexCount) {
    fail(file, path + '.names', `solid ${solid.kind} has ${vertexCount} vertices (front face then back face), got ${solid.names.length} names`)
  }
  for (const name of solid.names) {
    if (name.trim() === '') fail(file, path + '.names', 'blank vertex name: omit names to draw none')
    if (solidNames.has(name)) fail(file, path + '.names', `duplicate vertex name "${name}" in this figure`)
    if (pointNames.has(name)) fail(file, path + '.names', `vertex name "${name}" is also a point name`)
    solidNames.add(name)
  }
}

function checkAxes(spec, file, path) {
  for (const name of ['x', 'y']) {
    const axis = spec.axes[name]
    const p = `${path}.${name}`
    if (axis.from >= axis.to) fail(file, p, `axis: from (${axis.from}) must be less than to (${axis.to})`)
    if (axis.from > 0 || axis.to < 0) {
      fail(file, p, `axis: 0 must lie between from (${axis.from}) and to (${axis.to}) — the axes cross at the origin`)
    }
    if (axis.step <= 0) fail(file, p, `axis: step must be > 0, got ${axis.step}`)
    if (axis.labelEvery !== undefined && axis.step > 0) {
      const ratio = axis.labelEvery / axis.step
      if (axis.labelEvery <= 0 || Math.abs(ratio - Math.round(ratio)) > 1e-9) {
        fail(file, p, `axis: labelEvery (${axis.labelEvery}) must be a positive multiple of step (${axis.step})`)
      }
    }
  }
  if (spec.coordinateSpace) {
    fail(file, path, 'axes define the visible area: remove coordinateSpace')
  }
  if ((spec.numberLines ?? []).length > 0) {
    fail(file, path, 'a repère already draws its horizontal axis: remove numberLines')
  }
  const xSpan = spec.axes.x.to - spec.axes.x.from
  const ySpan = spec.axes.y.to - spec.axes.y.from
  if (Math.abs(xSpan - ySpan) > 1e-9) {
    for (const key of ['angleMarks', 'lengthMarks', 'circles']) {
      if ((spec[key] ?? []).length > 0) {
        fail(
          file,
          path,
          `${key} need the same scale on both axes, but the spans differ (x: ${xSpan}, y: ${ySpan})`,
        )
      }
    }
  }
}

const MAX_CHART_GRADUATIONS = 20

function checkChartBlock(block, file, path) {
  const series = Array.isArray(block.series) ? block.series : []
  if (series.length !== 1) {
    fail(file, path + '.series', `a chart has exactly one series for now, found ${series.length}`)
    return
  }
  const data = Array.isArray(series[0].data) ? series[0].data : []
  const isPie = block.kind === 'pie'
  const maxCategories = isPie ? 6 : 12
  if (data.length < 2 || data.length > maxCategories) {
    fail(file, path + '.series[0].data', `a ${block.kind} chart needs 2 to ${maxCategories} categories, found ${data.length}`)
  }

  const seen = new Set()
  data.forEach((d, i) => {
    const at = `${path}.series[0].data[${i}]`
    const label = typeof d.label === 'string' ? d.label.trim() : ''
    if (label === '') fail(file, at + '.label', 'blank category label')
    else if (seen.has(label)) fail(file, at + '.label', `duplicate category "${label}"`)
    seen.add(label)
    if (typeof d.value !== 'number' || !Number.isFinite(d.value)) {
      fail(file, at + '.value', 'value is not a finite number')
    } else if (isPie && d.value <= 0) {
      fail(file, at + '.value', 'a pie sector must have a positive value')
    } else if (block.kind === 'bar' && d.value < 0) {
      fail(file, at + '.value', 'a bar cannot be negative (use a line for values below 0)')
    }
  })

  if (isPie) {
    for (const field of ['xLabel', 'yLabel', 'yMax', 'yStep', 'showValues']) {
      if (field in block) fail(file, `${path}.${field}`, 'a pie has no axis')
    }
    return
  }

  const values = data.map((d) => d.value).filter((v) => Number.isFinite(v))
  const largest = Math.max(0, ...values)
  const smallest = Math.min(0, ...values)
  if (block.yMax !== undefined && block.yMax < largest) {
    fail(file, path + '.yMax', `yMax ${block.yMax} is below the largest value ${largest}`)
  }
  if (block.yStep !== undefined) {
    if (!(block.yStep > 0)) {
      fail(file, path + '.yStep', 'yStep must be positive')
    } else {
      const top = block.yMax ?? largest
      const bottom = smallest < 0 ? Math.floor(smallest / block.yStep) * block.yStep : 0
      const graduations = (top - bottom) / block.yStep
      if (graduations > MAX_CHART_GRADUATIONS) {
        fail(file, path + '.yStep', `${Math.ceil(graduations)} graduations; at most ${MAX_CHART_GRADUATIONS}`)
      }
    }
  }
}

// --- Scratch programmes (ADR 0031) ---

function checkScratchBlock(block, file, path) {
  const result = parseScratch(block.code)
  if (result.ok) return
  for (const { line, message } of result.errors) {
    fail(file, `${path}.code (line ${line})`, message)
  }
}

function checkFigures(doc, file) {
  for (const section of doc.sections ?? []) {
    for (let i = 0; i < (section.blocks ?? []).length; i++) {
      const block = section.blocks[i]
      const path = `sections[id=${section.id}].blocks[${i}]`
      if (block.type === 'figure') checkFigureBlock(block, file, path)
      else if (block.type === 'chart') checkChartBlock(block, file, path)
      else if (block.type === 'code' && block.language === 'scratch') checkScratchBlock(block, file, path)
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

// Chapter files only: _index.json manifests and annale *.meta.json carry no chapter id.
function isChapterFile(file) {
  const rel = relative(repoRoot, file)
  return (
    (rel.startsWith('content/chapitres/') || rel.startsWith('content/annales/')) &&
    !file.endsWith('/_index.json') &&
    !file.endsWith('.meta.json')
  )
}

const filesById = new Map()

let fileCount = 0
for (const file of contentFiles) {
  try {
    const doc = JSON.parse(readFileSync(file, 'utf8'))
    walkStrings(doc, file, '')
    checkFigures(doc, file)
    if (isChapterFile(file) && typeof doc.id === 'string') {
      filesById.set(doc.id, [...(filesById.get(doc.id) ?? []), file])
    }
    fileCount++
  } catch (e) {
    errors.push(`${relative(repoRoot, file)}: invalid JSON: ${e.message}`)
  }
}

for (const [id, files] of filesById) {
  if (files.length > 1) {
    errors.push(
      `chapter id "${id}" is used by ${files.length} files (ids are unique across the catalogue): ` +
        files.map((f) => relative(repoRoot, f)).join(', '),
    )
  }
}

if (errors.length > 0) {
  console.error(`✗ Content check failed (${errors.length} problem(s)):`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log(`✓ Content checks passed in ${fileCount} file(s) (rich-text delimiters + figure specs + charts + Scratch programmes + unique chapter ids).`)
