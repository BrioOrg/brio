// Probabilities on a tree block, and the rules a tree must follow beyond its JSON schema
// (ADR 0040 §2–§5), in one place: scripts/check-content.mjs reports them in English for the
// catalogue, the teacher editor in French before publication. Each issue is a code plus the facts
// its message needs, so every caller words it its own way.
//
// No imports: check-content loads this file with Node's type stripping, which does not resolve
// extensionless relative imports.

export const TREE_MAX_DEPTH = 3
export const TREE_MAX_CHILDREN = 6
export const TREE_MAX_LEAVES = 12

// --- Exact rationals ---

/** An irreducible fraction with a positive denominator. */
export type Rational = { num: bigint; den: bigint }

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y !== 0n) [x, y] = [y, x % y]
  return x
}

export function rational(num: bigint, den: bigint): Rational {
  if (den === 0n) throw new RangeError('zero denominator')
  const sign = den < 0n ? -1n : 1n
  const g = gcd(num, den) || 1n
  return { num: (sign * num) / g, den: (sign * den) / g }
}

export function addRational(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den + b.num * a.den, a.den * b.den)
}

export function mulRational(a: Rational, b: Rational): Rational {
  return rational(a.num * b.num, a.den * b.den)
}

export function compareRational(a: Rational, b: Rational): number {
  const d = a.num * b.den - b.num * a.den
  return d < 0n ? -1 : d > 0n ? 1 : 0
}

const ONE: Rational = { num: 1n, den: 1n }
const ZERO: Rational = { num: 0n, den: 1n }

/** True when the fraction has a finite decimal writing (its denominator is 2ᵃ × 5ᵇ). */
export function isDecimal(r: Rational): boolean {
  let d = r.den
  while (d % 2n === 0n) d /= 2n
  while (d % 5n === 0n) d /= 5n
  return d === 1n
}

/** A finite decimal written the French way, `0,125`; only call it when isDecimal(r). */
export function decimalString(r: Rational): string {
  const negative = r.num < 0n
  const n = negative ? -r.num : r.num
  let scale = 0
  let den = r.den
  let num = n
  while (den !== 1n) {
    // Multiply by 10 until the denominator divides out: at most a few dozen steps for a tree.
    num *= 10n
    scale++
    const g = gcd(num, den)
    num /= g
    den /= g
  }
  const digits = num.toString().padStart(scale + 1, '0')
  const whole = digits.slice(0, digits.length - scale)
  const fraction = scale > 0 ? ',' + digits.slice(digits.length - scale) : ''
  return (negative ? '−' : '') + whole + fraction
}

// --- Probabilities as written by the author ---

/**
 * What a branch's probability string means.
 * - `fraction`, `decimal`, `percent`, `integer`: a number, with its exact value.
 * - `latex`: a formula between `$` that is not a plain number (`$p$`, `$1-p$`): no value.
 * - `blank`: `?`, a probability the student fills in.
 * - `invalid`: anything else; `reason` says why.
 */
export type ParsedProbability =
  | { kind: 'fraction'; value: Rational; latex: string }
  | { kind: 'decimal' | 'percent' | 'integer'; value: Rational; latex: string }
  | { kind: 'latex'; latex: string }
  | { kind: 'blank'; latex: string }
  | { kind: 'invalid'; reason: 'decimal-point' | 'zero-denominator' | 'format' }

const SPACES = /[\s  ]+/g

function decimalValue(text: string): Rational {
  const [whole, fraction = ''] = text.split(',')
  return rational(BigInt(whole + fraction), 10n ** BigInt(fraction.length))
}

function decimalLatex(text: string): string {
  return text.replace(',', '{,}')
}

/** Parses a probability as written on a branch (ADR 0040 §2). */
export function parseProbability(input: string): ParsedProbability {
  const raw = input.trim()
  if (raw === '?') return { kind: 'blank', latex: '?' }

  const math = /^\$(.+)\$$/s.exec(raw)
  if (math) {
    const inner = math[1].trim()
    const frac = /^\\[dt]?frac\s*\{\s*(\d+)\s*\}\s*\{\s*(\d+)\s*\}$/.exec(inner)
    if (frac) return fraction(frac[1], frac[2])
    const plain = parseNumber(inner.replace(/\{,\}/g, ',').replace(/\\[,;!]/g, ' '))
    if (plain && plain.kind !== 'invalid') return plain
    return { kind: 'latex', latex: inner }
  }

  return parseNumber(raw) ?? { kind: 'invalid', reason: 'format' }
}

function fraction(numerator: string, denominator: string): ParsedProbability {
  const den = BigInt(denominator)
  if (den === 0n) return { kind: 'invalid', reason: 'zero-denominator' }
  return {
    kind: 'fraction',
    value: rational(BigInt(numerator), den),
    latex: `\\dfrac{${BigInt(numerator)}}{${den}}`,
  }
}

function parseNumber(text: string): ParsedProbability | null {
  const compact = text.replace(SPACES, ' ').trim()
  const frac = /^(\d+) ?\/ ?(\d+)$/.exec(compact)
  if (frac) return fraction(frac[1], frac[2])
  const percent = /^(\d+(?:,\d+)?) ?\\?%$/.exec(compact)
  if (percent) {
    const v = decimalValue(percent[1])
    return {
      kind: 'percent',
      value: rational(v.num, v.den * 100n),
      latex: `${decimalLatex(percent[1])}\\,\\%`,
    }
  }
  if (/^\d+$/.test(compact)) {
    return { kind: 'integer', value: rational(BigInt(compact), 1n), latex: compact }
  }
  if (/^\d+,\d+$/.test(compact)) {
    return { kind: 'decimal', value: decimalValue(compact), latex: decimalLatex(compact) }
  }
  if (/^\d*\.\d+(?: ?%)?$/.test(compact)) return { kind: 'invalid', reason: 'decimal-point' }
  return null
}

/** The exact value of a probability string, or null when it has none (`$p$`, `?`, invalid). */
export function probabilityValue(input: unknown): Rational | null {
  if (typeof input !== 'string') return null
  const p = parseProbability(input)
  return 'value' in p ? p.value : null
}

// --- Tree shape ---

export type TreeNodeInput = {
  label?: unknown
  probability?: unknown
  outcome?: unknown
  children?: unknown
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** The children of a node as records; anything else in the array is ignored. */
export function childrenOf(node: unknown): TreeNodeInput[] {
  if (!isRecord(node) || !Array.isArray(node.children)) return []
  return node.children.filter(isRecord) as TreeNodeInput[]
}

/** Every root-to-leaf path, each as the list of its nodes (the root excluded). */
export function leafPaths(root: unknown): TreeNodeInput[][] {
  const paths: TreeNodeInput[][] = []
  const walk = (node: TreeNodeInput, path: TreeNodeInput[]) => {
    const children = childrenOf(node)
    if (children.length === 0) {
      if (path.length > 0) paths.push(path)
      return
    }
    for (const child of children) walk(child, [...path, child])
  }
  if (isRecord(root)) walk(root, [])
  return paths
}

// --- Rules ---

export type TreeIssueSeverity = 'error' | 'warning'

export type TreeIssue = { path: string; severity: TreeIssueSeverity } & (
  | { code: 'NO_BRANCH' }
  | { code: 'TOO_DEEP'; max: number }
  | { code: 'TOO_MANY_CHILDREN'; count: number; max: number }
  | { code: 'TOO_MANY_LEAVES'; count: number; max: number }
  | { code: 'BLANK_LABEL' }
  | { code: 'DUPLICATE_LABEL'; label: string }
  | {
      code: 'INVALID_PROBABILITY'
      value: string
      reason: 'decimal-point' | 'zero-denominator' | 'format'
    }
  | { code: 'PROBABILITY_ABOVE_ONE'; value: string }
  | { code: 'SUM_NOT_ONE'; sum: string }
  | { code: 'SUM_ABOVE_ONE'; sum: string }
  | { code: 'PARTIAL_PROBABILITIES'; given: number; count: number }
  | { code: 'OUTCOME_ON_BRANCH' }
  | { code: 'PRODUCT_NEEDS_PROBABILITIES' }
  | { code: 'HIGHLIGHT_NOT_A_PATH' }
)

export type TreeIssueCode = TreeIssue['code']

/** A fraction for a message: `7/6`, or `1` when the denominator is 1. */
export function rationalString(r: Rational): string {
  return r.den === 1n ? r.num.toString() : `${r.num}/${r.den}`
}

/**
 * Every rule a tree block breaks, in reading order. Paths are relative to the block:
 * `root.children[1].children[0].probability`. An empty list means the tree is fine; issues of
 * severity `warning` do not block publication.
 */
export function checkTree(block: Record<string, unknown>): TreeIssue[] {
  const issues: TreeIssue[] = []
  const root = isRecord(block.root) ? block.root : {}
  if (childrenOf(root).length === 0) {
    issues.push({ code: 'NO_BRANCH', path: 'root.children', severity: 'error' })
    return issues
  }

  let leaves = 0
  const visit = (node: TreeNodeInput, at: string, depth: number) => {
    const children = childrenOf(node)
    if (depth > 0 && children.length === 0) leaves++
    if (depth > 0 && children.length > 0 && node.outcome !== undefined) {
      issues.push({ code: 'OUTCOME_ON_BRANCH', path: `${at}.outcome`, severity: 'error' })
    }
    if (children.length === 0) return
    if (depth >= TREE_MAX_DEPTH) {
      issues.push({
        code: 'TOO_DEEP',
        path: `${at}.children`,
        max: TREE_MAX_DEPTH,
        severity: 'error',
      })
      return
    }
    if (children.length > TREE_MAX_CHILDREN) {
      issues.push({
        code: 'TOO_MANY_CHILDREN',
        path: `${at}.children`,
        count: children.length,
        max: TREE_MAX_CHILDREN,
        severity: 'error',
      })
    }
    checkSiblings(children, `${at}.children`, issues)
    children.forEach((child, i) => visit(child, `${at}.children[${i}]`, depth + 1))
  }
  visit(root, 'root', 0)

  if (leaves > TREE_MAX_LEAVES) {
    issues.push({
      code: 'TOO_MANY_LEAVES',
      path: 'root',
      count: leaves,
      max: TREE_MAX_LEAVES,
      severity: 'error',
    })
  }

  if (block.products === true) {
    const complete = leafPaths(root).every((path) =>
      path.every((node) => probabilityValue(node.probability) !== null)
    )
    if (!complete) {
      issues.push({ code: 'PRODUCT_NEEDS_PROBABILITIES', path: 'products', severity: 'error' })
    }
  }

  if (block.highlightPath !== undefined && findPath(root, block.highlightPath) === null) {
    issues.push({ code: 'HIGHLIGHT_NOT_A_PATH', path: 'highlightPath', severity: 'error' })
  }
  return issues
}

function checkSiblings(children: TreeNodeInput[], at: string, issues: TreeIssue[]) {
  const seen = new Set<string>()
  const values: Rational[] = []
  let given = 0
  children.forEach((child, i) => {
    const here = `${at}[${i}]`
    const label = typeof child.label === 'string' ? child.label.trim() : ''
    if (label === '') issues.push({ code: 'BLANK_LABEL', path: `${here}.label`, severity: 'error' })
    else if (seen.has(label)) {
      issues.push({ code: 'DUPLICATE_LABEL', path: `${here}.label`, label, severity: 'error' })
    }
    seen.add(label)

    if (child.probability === undefined) return
    given++
    const written = String(child.probability)
    const parsed = parseProbability(written)
    if (parsed.kind === 'invalid') {
      issues.push({
        code: 'INVALID_PROBABILITY',
        path: `${here}.probability`,
        value: written,
        reason: parsed.reason,
        severity: 'error',
      })
    } else if ('value' in parsed) {
      if (compareRational(parsed.value, ONE) > 0) {
        issues.push({
          code: 'PROBABILITY_ABOVE_ONE',
          path: `${here}.probability`,
          value: written,
          severity: 'error',
        })
      }
      values.push(parsed.value)
    }
  })

  if (given > 0 && given < children.length) {
    issues.push({
      code: 'PARTIAL_PROBABILITIES',
      path: at,
      given,
      count: children.length,
      severity: 'warning',
    })
  }
  const sum = values.reduce(addRational, ZERO)
  if (values.length === children.length) {
    if (compareRational(sum, ONE) !== 0) {
      issues.push({ code: 'SUM_NOT_ONE', path: at, sum: rationalString(sum), severity: 'error' })
    }
  } else if (compareRational(sum, ONE) > 0) {
    issues.push({ code: 'SUM_ABOVE_ONE', path: at, sum: rationalString(sum), severity: 'error' })
  }
}

/**
 * The child indices of the root-to-leaf path whose labels are `labels`, or null when there is
 * none (wrong labels, or a path stopping before a leaf).
 */
export function findPath(root: unknown, labels: unknown): number[] | null {
  if (!Array.isArray(labels) || labels.length === 0) return null
  const indices: number[] = []
  let node: unknown = root
  for (const label of labels) {
    const children = childrenOf(node)
    const i = children.findIndex(
      (c) =>
        typeof c.label === 'string' && typeof label === 'string' && c.label.trim() === label.trim()
    )
    if (i < 0) return null
    indices.push(i)
    node = children[i]
  }
  return childrenOf(node).length === 0 ? indices : null
}
