// The worked-calculation block, `calcul` (ADR 0042): a chain of equalities or of equivalent
// equations, aligned on the relation symbol, each line with an optional note in the margin, the
// part that changed emphasised and, for an equation, the operation applied to both members.
//
// The author writes each line as one LaTeX string; this module finds its top-level relation,
// splits it into left member, relation and right member, and wraps the emphasised part. The
// renderer only lays the three parts out in columns: alignment is never written by hand.
//
// The rules a block must follow beyond its JSON schema are here too, shared by check-content
// (English) and the teacher editor (French), as for charts (ADR 0030).
//
// No imports: check-content loads this file with Node's type stripping, which does not resolve
// extensionless relative imports.

export type CalculMode = 'egalites' | 'equation'

export type CalculLine = {
  latex: string
  /** A short justification in the margin: « on développe ». */
  note?: string
  /** A substring of `latex` emphasised wherever it occurs: what changed on this line. */
  focus?: string
  /** Equation mode, from the second line: the operation applied to both members to get here. */
  op?: string
}

export type CalculSpec = {
  mode: CalculMode
  lines: readonly CalculLine[]
  title?: string
  /** Rich text written under the calculation, revealed last: « La solution est $28$. » */
  conclusion?: string
}

export const CALCUL_MIN_LINES = 2
export const CALCUL_MAX_LINES = 12
/** A note sits in the margin: past this, it is a paragraph and belongs in the prose. */
export const CALCUL_NOTE_MAX_LENGTH = 80
/** The maths tone of the emphasised part (ADR 0037): written as `\tone{1}{…}`, like an author would. */
export const CALCUL_FOCUS_TONE = 1

// --- Scanning --------------------------------------------------------------------------------

const RELATION_CHARS = new Set(['=', '<', '>', '≠', '≤', '≥', '≈'])
const RELATION_COMMANDS = new Set([
  '\\neq',
  '\\ne',
  '\\leq',
  '\\le',
  '\\leqslant',
  '\\geq',
  '\\ge',
  '\\geqslant',
  '\\approx',
  '\\lt',
  '\\gt',
])
/** Commands whose next token is a delimiter, never a relation: `\left<` is a bracket. */
const DELIMITER_SIZERS = new Set([
  '\\left',
  '\\right',
  '\\middle',
  '\\big',
  '\\Big',
  '\\bigg',
  '\\Bigg',
  '\\bigl',
  '\\bigr',
  '\\Bigl',
  '\\Bigr',
  '\\biggl',
  '\\biggr',
  '\\Biggl',
  '\\Biggr',
])

type Token = { start: number; end: number; text: string }

/** Splits LaTeX into tokens: a command (`\frac`, `\{`), or one character. */
function tokenize(latex: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < latex.length) {
    const start = i
    if (latex[i] === '\\') {
      i++
      if (i < latex.length && /[a-zA-Z]/.test(latex[i])) {
        while (i < latex.length && /[a-zA-Z]/.test(latex[i])) i++
      } else if (i < latex.length) {
        i++
      }
    } else {
      // A surrogate pair stays one token.
      i += latex.codePointAt(i)! > 0xffff ? 2 : 1
    }
    tokens.push({ start, end: i, text: latex.slice(start, i) })
  }
  return tokens
}

type Scan = {
  /** Braces, `\left…\right` and `\begin…\end` all close, in order. */
  balanced: boolean
  /** Relations outside any group, in order. */
  relations: { start: number; end: number; symbol: string }[]
}

/** The relations of a line that are outside every group, and whether its groups balance. */
export function scanLatex(latex: string): Scan {
  const relations: Scan['relations'] = []
  const stack: string[] = []
  let balanced = true
  let skipDelimiter = false
  for (const token of tokenize(latex)) {
    const t = token.text
    if (skipDelimiter && t.trim() !== '') {
      skipDelimiter = false
      continue
    }
    if (t === '{') stack.push('{')
    else if (t === '}') {
      if (stack.pop() !== '{') balanced = false
    } else if (t === '\\left') {
      stack.push('left')
      skipDelimiter = true
    } else if (t === '\\right') {
      if (stack.pop() !== 'left') balanced = false
      skipDelimiter = true
    } else if (t === '\\begin') stack.push('begin')
    else if (t === '\\end') {
      if (stack.pop() !== 'begin') balanced = false
    } else if (DELIMITER_SIZERS.has(t)) {
      skipDelimiter = true
    } else if (stack.length === 0 && (RELATION_CHARS.has(t) || RELATION_COMMANDS.has(t))) {
      relations.push({ start: token.start, end: token.end, symbol: t })
    }
  }
  return { balanced: balanced && stack.length === 0, relations }
}

// --- Splitting a line --------------------------------------------------------------------------

/** A line in three columns. `lhs` and `rel` are empty for a line that only continues a chain. */
export type CalculParts = { lhs: string; rel: string; rhs: string }

export type CalculSplitError =
  'UNBALANCED' | 'NO_RELATION' | 'SEVERAL_RELATIONS' | 'RELATION_INSIDE' | 'EMPTY_MEMBER'

export type CalculSplit = { ok: true; parts: CalculParts } | { ok: false; error: CalculSplitError }

/**
 * Splits a line on its relation.
 *
 * - `equation`: every line is a whole equation, `lhs rel rhs`, with exactly one relation.
 * - `egalites`, first line: `A = 2x + 3` (one relation), or just the starting expression.
 * - `egalites`, next lines: the next expression, `= ` implied; it may start with another
 *   relation (`\approx 28{,}3`), but holds none further on.
 */
export function splitCalculLine(latex: string, mode: CalculMode, index: number): CalculSplit {
  const scan = scanLatex(latex)
  if (!scan.balanced) return { ok: false, error: 'UNBALANCED' }
  const { relations } = scan
  const at = (r: Scan['relations'][number]): CalculParts => ({
    lhs: latex.slice(0, r.start).trim(),
    rel: r.symbol,
    rhs: latex.slice(r.end).trim(),
  })

  if (mode === 'equation' || index === 0) {
    if (relations.length > 1) return { ok: false, error: 'SEVERAL_RELATIONS' }
    if (relations.length === 0) {
      if (mode === 'equation') return { ok: false, error: 'NO_RELATION' }
      return { ok: true, parts: { lhs: '', rel: '', rhs: latex.trim() } }
    }
    const parts = at(relations[0])
    if (parts.lhs === '' || parts.rhs === '') return { ok: false, error: 'EMPTY_MEMBER' }
    return { ok: true, parts }
  }

  // egalites, a continuation line
  const leading = relations[0]
  const startsWithRelation = leading !== undefined && latex.slice(0, leading.start).trim() === ''
  if (relations.length > (startsWithRelation ? 1 : 0)) {
    return { ok: false, error: 'RELATION_INSIDE' }
  }
  const parts = startsWithRelation
    ? { lhs: '', rel: leading.symbol, rhs: latex.slice(leading.end).trim() }
    : { lhs: '', rel: '=', rhs: latex.trim() }
  if (parts.rhs === '') return { ok: false, error: 'EMPTY_MEMBER' }
  return { ok: true, parts }
}

// --- Emphasis ----------------------------------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Where `focus` occurs in `side`, spaces ignored (`-13` finds `- 13`). An occurrence that would
 * cut a number (`2` inside `12`) or a command (`f` inside `\frac`), or that does not form whole
 * groups, is skipped.
 */
export function focusRanges(side: string, focus: string): [number, number][] {
  const compact = focus.replace(/\s+/g, '')
  if (compact === '' || !scanLatex(compact).balanced) return []
  const pattern = new RegExp(
    Array.from(compact)
      .map((c) => escapeRegExp(c))
      .join('\\s*'),
    'g'
  )
  const ranges: [number, number][] = []
  for (const match of side.matchAll(pattern)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const before = side.slice(0, start)
    const after = side.slice(end)
    if (/\d$/.test(before) && /^\d/.test(compact)) continue
    if (/^\d/.test(after) && /\d$/.test(compact)) continue
    if (/\{,\}$/.test(before) && /^\d/.test(compact)) continue
    if (/^\{,\}\d/.test(after) && /\d$/.test(compact)) continue
    if (/\\[a-zA-Z]*$/.test(before) && /^[a-zA-Z]/.test(compact)) continue
    if (/^[a-zA-Z]/.test(after) && /\\[a-zA-Z]+$/.test(compact)) continue
    if (!scanLatex(match[0]).balanced) continue
    ranges.push([start, end])
  }
  return ranges
}

/** `side` with every occurrence of `focus` in the focus tone. */
export function wrapFocus(side: string, focus: string | undefined): string {
  if (focus === undefined) return side
  let out = ''
  let last = 0
  for (const [start, end] of focusRanges(side, focus)) {
    out += side.slice(last, start) + `\\tone{${CALCUL_FOCUS_TONE}}{${side.slice(start, end)}}`
    last = end
  }
  return out + side.slice(last)
}

// --- Model -------------------------------------------------------------------------------------

export type CalculRow = {
  /** LaTeX of each column, the emphasised part wrapped; empty when the column is. */
  lhs: string
  rel: string
  rhs: string
  /** The whole line without emphasis, for its MathML (one formula per line for a screen reader). */
  spoken: string
  note?: string
  /**
   * Equation mode, from the second line: the operation applied to both members to get this
   * line, drawn under each member of the previous one (−13 … −13), at its end. `rhsBefore` is
   * that previous right member, emphasis included: the renderer sets the operation under it.
   */
  op?: { latex: string; rhsBefore: string }
}

export type CalculModel = {
  mode: CalculMode
  rows: CalculRow[]
  conclusion?: string
  /** What the interactive mode reveals one at a time: each line, then the conclusion. */
  steps: number
}

function filled(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

/**
 * The block laid out in rows. Tolerant, for a teacher's draft: a line that does not split is
 * drawn whole in the right-hand column, and the editor says why.
 */
export function buildCalculModel(spec: CalculSpec): CalculModel {
  const mode: CalculMode = spec.mode === 'equation' ? 'equation' : 'egalites'
  const lines = Array.isArray(spec.lines) ? spec.lines : []
  const rows = lines.map((line, index): CalculRow => {
    const latex = typeof line?.latex === 'string' ? line.latex : ''
    const split = splitCalculLine(latex, mode, index)
    const parts = split.ok ? split.parts : { lhs: '', rel: '', rhs: latex.trim() }
    const focus = filled(line.focus) ? line.focus : undefined
    return {
      lhs: wrapFocus(parts.lhs, focus),
      rel: parts.rel,
      rhs: wrapFocus(parts.rhs, focus),
      spoken: [parts.lhs, parts.rel, parts.rhs].filter((p) => p !== '').join(' '),
      ...(filled(line.note) ? { note: line.note.trim() } : {}),
    }
  })
  if (mode === 'equation') {
    lines.forEach((line, index) => {
      if (index > 0 && filled(line?.op)) {
        rows[index].op = { latex: line.op.trim(), rhsBefore: rows[index - 1].rhs }
      }
    })
  }
  const conclusion = filled(spec.conclusion) ? spec.conclusion : undefined
  return {
    mode,
    rows,
    ...(conclusion ? { conclusion } : {}),
    steps: rows.length + (conclusion ? 1 : 0),
  }
}

/** The number of steps the interactive mode reveals for a `calcul` block, from its raw JSON. */
export function calculSteps(block: Record<string, unknown>): number {
  const lines = Array.isArray(block.lines) ? block.lines.length : 0
  return lines + (filled(block.conclusion) ? 1 : 0)
}

// --- Rules (check-content, teacher editor) -----------------------------------------------------

export type CalculIssue =
  | { code: 'LINE_COUNT'; path: 'lines'; count: number; min: number; max: number }
  | { code: 'BLANK_LINE'; path: string; index: number }
  | { code: CalculSplitError; path: string; index: number }
  | { code: 'BLANK_NOTE'; path: string; index: number }
  | { code: 'NOTE_TOO_LONG'; path: string; index: number; length: number; max: number }
  | { code: 'FOCUS_NOT_FOUND'; path: string; index: number; focus: string }
  | { code: 'OP_IN_EGALITES'; path: string; index: number }
  | { code: 'OP_ON_FIRST_LINE'; path: string; index: number }
  | { code: 'OP_INVALID'; path: string; index: number }

export type CalculIssueCode = CalculIssue['code']

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/**
 * Every rule a `calcul` block breaks, in reading order. Paths are relative to the block:
 * `lines[2].focus`. An empty list means the block is fine. KaTeX itself is not run here (this
 * module has no dependency): the web's tests parse every line of the catalogue, and the editor
 * shows KaTeX's own error under the field.
 */
export function checkCalcul(block: Record<string, unknown>): CalculIssue[] {
  const issues: CalculIssue[] = []
  const mode: CalculMode = block.mode === 'equation' ? 'equation' : 'egalites'
  const lines: unknown[] = Array.isArray(block.lines) ? block.lines : []
  if (lines.length < CALCUL_MIN_LINES || lines.length > CALCUL_MAX_LINES) {
    issues.push({
      code: 'LINE_COUNT',
      path: 'lines',
      count: lines.length,
      min: CALCUL_MIN_LINES,
      max: CALCUL_MAX_LINES,
    })
  }
  lines.forEach((raw, index) => {
    const at = `lines[${index}]`
    const line = isRecord(raw) ? raw : {}
    const latex = typeof line.latex === 'string' ? line.latex : ''
    if (latex.trim() === '') {
      issues.push({ code: 'BLANK_LINE', path: `${at}.latex`, index })
    } else {
      const split = splitCalculLine(latex, mode, index)
      if (!split.ok) {
        issues.push({ code: split.error, path: `${at}.latex`, index })
      } else if (filled(line.focus)) {
        const { lhs, rhs } = split.parts
        if (focusRanges(lhs, line.focus).length + focusRanges(rhs, line.focus).length === 0) {
          issues.push({ code: 'FOCUS_NOT_FOUND', path: `${at}.focus`, index, focus: line.focus })
        }
      }
    }
    if (line.focus !== undefined && !filled(line.focus) && latex.trim() !== '') {
      issues.push({ code: 'FOCUS_NOT_FOUND', path: `${at}.focus`, index, focus: '' })
    }
    if (line.note !== undefined) {
      const note = typeof line.note === 'string' ? line.note.trim() : ''
      if (note === '') issues.push({ code: 'BLANK_NOTE', path: `${at}.note`, index })
      else if (note.length > CALCUL_NOTE_MAX_LENGTH) {
        issues.push({
          code: 'NOTE_TOO_LONG',
          path: `${at}.note`,
          index,
          length: note.length,
          max: CALCUL_NOTE_MAX_LENGTH,
        })
      }
    }
    if (line.op !== undefined) {
      if (mode === 'egalites') issues.push({ code: 'OP_IN_EGALITES', path: `${at}.op`, index })
      else if (index === 0) issues.push({ code: 'OP_ON_FIRST_LINE', path: `${at}.op`, index })
      else {
        const op = typeof line.op === 'string' ? line.op : ''
        const scan = scanLatex(op)
        if (op.trim() === '' || !scan.balanced || scan.relations.length > 0) {
          issues.push({ code: 'OP_INVALID', path: `${at}.op`, index })
        }
      }
    }
  })
  return issues
}
