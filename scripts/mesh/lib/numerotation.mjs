/**
 * Numbering of ADRs and Flyway migrations (#358, lesson L-2026-W47-5 of the PL-4 retro).
 *
 * Parallel branches each picked "the next number": ADR 0036 existed twice (#365 / #357) and
 * the V43/V44 migrations had to be merged in a given order. These pure functions find the
 * collisions; scripts/mesh/check-numerotation.mjs feeds them from git (and, on request,
 * from the open pull requests).
 */

const PATTERNS = {
  adr: /^docs\/adr\/(\d{4})-[^/]+\.md$/,
  migration: /^backend\/src\/main\/resources\/db\/migration\/V(\d+(?:[._]\d+)*)__[^/]+\.sql$/,
}

export const KINDS = Object.keys(PATTERNS)

/** The number a path carries ("0036", "43", "1.1"), or null if it is not an ADR/migration. */
export function numberOf(kind, path) {
  const m = PATTERNS[kind].exec(path)
  return m ? m[1].replace(/_/g, '.') : null
}

/** Numeric comparison of "43" vs "1.1" vs "0036" (Flyway orders versions part by part). */
export function compareNumbers(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

function byNumber(kind, paths) {
  const map = new Map()
  for (const p of paths) {
    const n = numberOf(kind, p)
    if (n === null) continue
    const key = [...map.keys()].find((k) => compareNumbers(k, n) === 0) ?? n
    map.set(key, [...(map.get(key) ?? []), p])
  }
  return map
}

/** Numbers carried by more than one file, e.g. [{ number: '0036', paths: [a, b] }]. */
export function duplicates(kind, paths) {
  return [...byNumber(kind, paths)]
    .filter(([, ps]) => ps.length > 1)
    .map(([number, ps]) => ({ number, paths: ps.sort() }))
}

/**
 * Files added on the branch (in head, not in base) whose number is already taken on the
 * base, or, for a migration, is not above the base's highest version (Flyway refuses an
 * out-of-order migration on an environment that already ran the higher one).
 */
export function againstBase(kind, basePaths, headPaths) {
  const base = new Set(basePaths)
  const taken = byNumber(kind, basePaths)
  const max = [...taken.keys()].sort(compareNumbers).at(-1)
  const errors = []
  for (const p of headPaths) {
    const n = numberOf(kind, p)
    if (n === null || base.has(p)) continue
    const clash = [...taken].find(([k]) => compareNumbers(k, n) === 0)
    if (clash) {
      errors.push({
        path: p,
        number: n,
        reason: `déjà pris sur la base par ${clash[1].join(', ')}`,
      })
    } else if (kind === 'migration' && max && compareNumbers(n, max) < 0) {
      errors.push({
        path: p,
        number: n,
        reason: `inférieure à la plus haute version de la base (V${max}) : Flyway la refusera`,
      })
    }
  }
  return errors
}

/**
 * Files added on the branch whose number is also added by another open pull request.
 * `prs` is [{ number, files: [path] }] (gh pr list --json number,files).
 */
export function againstOpenPrs(kind, addedPaths, prs, selfPr = null) {
  const errors = []
  for (const p of addedPaths) {
    const n = numberOf(kind, p)
    if (n === null) continue
    for (const pr of prs) {
      if (pr.number === selfPr) continue
      const other = pr.files.find(
        (f) => f !== p && numberOf(kind, f) !== null && compareNumbers(numberOf(kind, f), n) === 0
      )
      if (other)
        errors.push({ path: p, number: n, reason: `aussi pris par la PR #${pr.number} (${other})` })
    }
  }
  return errors
}
