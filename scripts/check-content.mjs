#!/usr/bin/env node
/**
 * Validates richText delimiter balance in all chapter content files.
 *
 * richText fields support **bold**, *italic*, and $...$ inline math.
 * Escaping: \* and \$ produce literal characters.
 * An unclosed delimiter makes the delimiter itself visible to students —
 * this script catches the mistake before it reaches a PR.
 *
 * Scanned: content/ (excluding referentiel) + docs/schema/examples/.
 * Zero dependencies; exits non-zero on any problem.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

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

console.log(`✓ Rich-text delimiters balanced in ${fileCount} content file(s).`)
