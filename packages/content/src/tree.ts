import {
  decimalString,
  findPath,
  isDecimal,
  mulRational,
  parseProbability,
  type ParsedProbability,
  type Rational,
} from './tree-rules'

// --- Spec types (mirror the JSON schema, ADR 0040) ---

export type TreeOrientation = 'horizontal' | 'vertical'

export type TreeNodeSpec = {
  /** Rich text: `R`, `Pile`, `$\overline{A}$`. */
  label: string
  /** `3/5`, `0,4`, `25 %`, `?` or LaTeX between `$` (ADR 0040 §2). */
  probability?: string
  /** A leaf's issue, written instead of the default `(R ; B)`. */
  outcome?: string
  children?: TreeNodeSpec[]
}

export type TreeSpec = {
  root: { children: TreeNodeSpec[] }
  orientation?: TreeOrientation
  outcomes?: boolean
  products?: boolean
  highlightPath?: string[]
}

// --- Drawing model types (pixels; the renderer never scales them) ---

export type TreeLabelRole = 'event' | 'probability' | 'outcome' | 'product'

/** What a label shows: rich text (`$…$` inside) or a LaTeX formula. */
export type TreeLabelContent = { kind: 'rich'; text: string } | { kind: 'math'; latex: string }

/**
 * A label: its anchor point, its estimated box and how the box hangs from the anchor. `start`:
 * the box starts at x (a column of issues); `middle`: it is centred on x. Always centred on y.
 */
export type TreeLabel = {
  role: TreeLabelRole
  content: TreeLabelContent
  x: number
  y: number
  anchor: 'start' | 'middle'
  width: number
  height: number
  emphasis: boolean
}

export type TreeBranch = { x1: number; y1: number; x2: number; y2: number; emphasis: boolean }

/** One root-to-leaf path, for the visually hidden table (ADR 0040 §10). */
export type TreePathRow = {
  steps: { label: string; probability: string | null }[]
  outcome: string
  /** LaTeX of the product, only when the block asks for products. */
  product: string | null
  emphasis: boolean
}

export type TreeModel = {
  width: number
  height: number
  orientation: TreeOrientation
  root: { x: number; y: number }
  branches: TreeBranch[]
  labels: TreeLabel[]
  rows: TreePathRow[]
}

export type TreeLayoutOptions = {
  /** The phone layout (ADR 0040 §9): horizontal, shorter branches, the product under the issue. */
  compact?: boolean
}

// --- Metrics ---
// The renderer writes every label at --text-sm (13 px) and brings KaTeX back to that size (not its
// own 1.21 em): digits as large as the words. Widths of formulas are in KaTeX ems, measured once
// in Chromium; text widths are a generous average.

export const TREE_TEXT_PX = 13
export const TREE_MATH_EM = 13
const TEXT_CHAR = 0.62 * TREE_TEXT_PX
const TEXT_HEIGHT = 18
const MATH_LINE = 1.45
const FRACTION_HEIGHT = 2.43
/** Estimates are rounded up by this factor plus PAD, so a real box is never wider. */
const SAFETY = 1.08
const PAD = 2

const BRANCH = 76
const BRANCH_COMPACT = 52
const BRANCH_COMPACT_DEEP = 40
const COMPACT_PRODUCT_WIDTH = 120
const BRANCH_VERTICAL = 56
const NODE_GAP = 4
const LABEL_GAP = 3
const ROOT_RADIUS = 2.5
const COLUMN_GAP = 18
const PRODUCT_GAP = 14
const STACK_GAP = 7
const ROW_GAP = 8
const MARGIN = 4
const STEP_INCREMENT = 4
const STEP_ATTEMPTS = 20
const BRANCH_INCREMENT = 6
const MAX_ATTEMPTS = 60
const COLLISION_MARGIN = 1
/** Two labels keep at least this much air between them. */
const LABEL_SPACING = 6
/** Between two branch labels (ADR 0040 §7). */
const PROBABILITY_SPACING = 14

type Box = { width: number; height: number }

// --- Size estimates ---

type MathSize = { width: number; height: number }

const BINARY = new Set(['\\times', '\\cap', '\\cup', '\\cdot', '\\pm', '\\div'])
const RELATION = new Set(['\\leq', '\\geq', '\\le', '\\ge', '\\neq', '\\approx', '\\in'])
const SPACING: Record<string, number> = {
  '\\,': 0.17,
  '\\;': 0.28,
  '\\:': 0.22,
  '\\!': 0,
  '\\ ': 0.33,
  '\\quad': 1,
}
const ONE_ARG = new Set([
  '\\overline',
  '\\bar',
  '\\vec',
  '\\mathrm',
  '\\mathbf',
  '\\mathit',
  '\\text',
  '\\textrm',
  '\\operatorname',
  '\\boldsymbol',
  '\\widehat',
  '\\hat',
])

/** Width and height, in KaTeX ems, of a short formula. Conservative, not exact. */
export function estimateLatex(latex: string): MathSize {
  let i = 0
  const readGroup = (): MathSize => {
    while (latex[i] === ' ') i++
    if (latex[i] === '{') {
      i++
      const size = readSequence('}')
      i++
      return size
    }
    return readAtom()
  }
  const readAtom = (): MathSize => {
    const c = latex[i]
    if (c === undefined) return { width: 0, height: MATH_LINE }
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(latex.slice(i))
      const cmd = m ? m[0] : '\\'
      i += cmd.length
      if (cmd === '\\frac' || cmd === '\\dfrac' || cmd === '\\tfrac') {
        const a = readGroup()
        const b = readGroup()
        return { width: Math.max(a.width, b.width) + 0.24, height: FRACTION_HEIGHT }
      }
      if (ONE_ARG.has(cmd)) {
        const g = readGroup()
        const text = cmd.startsWith('\\text') || cmd === '\\mathrm' || cmd === '\\operatorname'
        return { width: text ? g.width * 1.05 : g.width, height: Math.max(g.height, MATH_LINE) }
      }
      if (cmd in SPACING) return { width: SPACING[cmd], height: MATH_LINE }
      if (BINARY.has(cmd)) return { width: 1.22, height: MATH_LINE }
      if (RELATION.has(cmd)) return { width: 1.33, height: MATH_LINE }
      if (cmd === '\\%') return { width: 0.83, height: MATH_LINE }
      if (cmd === '\\left' || cmd === '\\right') return { width: 0, height: MATH_LINE }
      return { width: 0.62, height: MATH_LINE }
    }
    i++
    if (/[0-9]/.test(c)) return { width: 0.5, height: MATH_LINE }
    if (/[A-Z]/.test(c)) return { width: 0.77, height: MATH_LINE }
    if (/[a-z]/.test(c)) return { width: 0.56, height: MATH_LINE }
    if (c === '+' || c === '-') return { width: 1.22, height: MATH_LINE }
    if (c === '=' || c === '<' || c === '>') return { width: 1.33, height: MATH_LINE }
    if (c === '(' || c === ')' || c === '[' || c === ']') return { width: 0.39, height: MATH_LINE }
    if (c === ',' || c === '.' || c === ';') return { width: 0.28, height: MATH_LINE }
    if (c === ' ') return { width: 0, height: MATH_LINE }
    return { width: 0.62, height: MATH_LINE }
  }
  const readSequence = (end?: string): MathSize => {
    let width = 0
    let height = MATH_LINE
    while (i < latex.length && latex[i] !== end) {
      if (latex[i] === '^' || latex[i] === '_') {
        i++
        const g = readGroup()
        width += g.width * 0.7
        continue
      }
      const a = latex[i] === '{' ? readGroup() : readAtom()
      width += a.width
      height = Math.max(height, a.height)
    }
    return { width, height }
  }
  return readSequence()
}

function mathBox(latex: string): Box {
  const size = estimateLatex(latex)
  return {
    width: Math.ceil(size.width * TREE_MATH_EM * SAFETY + PAD),
    height: Math.ceil(Math.max(TEXT_HEIGHT, size.height * TREE_MATH_EM + PAD)),
  }
}

/** The box of a rich-text label: words at --text-sm, `$…$` formulas at KaTeX size. */
export function estimateRichText(text: string): Box {
  let width = 0
  let height = TEXT_HEIGHT
  text.split(/(\$[^$]*\$)/).forEach((part) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
      const size = estimateLatex(part.slice(1, -1))
      width += size.width * TREE_MATH_EM
      height = Math.max(height, size.height * TREE_MATH_EM + PAD)
    } else {
      width += part.length * TEXT_CHAR
    }
  })
  return { width: Math.ceil(width * SAFETY + PAD), height: Math.ceil(height) }
}

function boxOf(content: TreeLabelContent): Box {
  return content.kind === 'math' ? mathBox(content.latex) : estimateRichText(content.text)
}

// --- Paths, issues and products ---

const NARROW_NBSP = ' '

/** `(R ; B)`, with the narrow no-break space French puts before a semicolon. */
export function outcomeText(labels: string[]): string {
  if (labels.length === 1) return labels[0]
  return `(${labels.join(`${NARROW_NBSP}; `)})`
}

function factorLatex(p: ParsedProbability): string | null {
  if (!('value' in p)) return null
  // A percentage reads as a decimal inside a product: 0,25 × 0,4, not 25 % × 0,4.
  if (p.kind === 'percent') return decimalLatex(p.value)
  return p.latex
}

function decimalLatex(r: Rational): string {
  return decimalString(r).replace(',', '{,}')
}

/**
 * The probability of an issue as its factors (as written) and its exact product, reduced, or a
 * decimal when every factor is one. Null when a probability on the path is not a number.
 */
export function productParts(
  probabilities: (string | undefined)[]
): { factors: string[]; result: string } | null {
  const factors: string[] = []
  let value: Rational = { num: 1n, den: 1n }
  let allDecimal = true
  for (const written of probabilities) {
    const p = written === undefined ? null : parseProbability(written)
    const latex = p ? factorLatex(p) : null
    if (!p || latex === null || !('value' in p)) return null
    factors.push(latex)
    value = mulRational(value, p.value)
    if (p.kind === 'fraction') allDecimal = false
  }
  const result =
    allDecimal && isDecimal(value)
      ? decimalLatex(value)
      : value.den === 1n
        ? value.num.toString()
        : `\\dfrac{${value.num}}{${value.den}}`
  return { factors, result }
}

/** `\dfrac{3}{5}\times \dfrac{2}{4}=\dfrac{3}{10}`; a single factor is written alone. */
export function productLatex(probabilities: (string | undefined)[]): string | null {
  const parts = productParts(probabilities)
  if (!parts) return null
  if (parts.factors.length === 1) return parts.factors[0]
  return `${parts.factors.join('\\times ')}=${parts.result}`
}

// --- Layout ---

type Placed = {
  spec: TreeNodeSpec
  depth: number
  children: Placed[]
  event: TreeLabelContent
  eventBox: Box
  probability: TreeLabelContent | null
  probabilityBox: Box | null
  /** Along the depth axis and the breadth axis, before mapping to x / y. */
  d: number
  b: number
  emphasis: boolean
}

type LeafText = { role: 'outcome' | 'product'; content: TreeLabelContent; box: Box }

/** A leaf and the texts after it: its issue, then its product, on one or two lines. */
type Leaf = { node: Placed; texts: LeafText[] }

function probabilityContent(p: string | undefined): TreeLabelContent | null {
  if (p === undefined || p.trim() === '') return null
  const parsed = parseProbability(p)
  if (parsed.kind === 'invalid') return { kind: 'rich', text: p }
  return { kind: 'math', latex: parsed.latex }
}

function place(spec: TreeNodeSpec, depth: number, emphasisPath: number[] | null): Placed {
  const event: TreeLabelContent = { kind: 'rich', text: spec.label }
  const probability = probabilityContent(spec.probability)
  const onPath = emphasisPath !== null
  const children = (spec.children ?? []).map((child, i) =>
    place(child, depth + 1, onPath && emphasisPath[0] === i ? emphasisPath.slice(1) : null)
  )
  return {
    spec,
    depth,
    children,
    event,
    eventBox: boxOf(event),
    probability,
    probabilityBox: probability ? boxOf(probability) : null,
    d: 0,
    b: 0,
    emphasis: onPath,
  }
}

function leavesOf(node: Placed): Placed[] {
  return node.children.length === 0 ? [node] : node.children.flatMap(leavesOf)
}

type Rect = { x0: number; y0: number; x1: number; y1: number }

function rectOf(l: TreeLabel): Rect {
  const x0 = l.anchor === 'start' ? l.x : l.x - l.width / 2
  return { x0, y0: l.y - l.height / 2, x1: x0 + l.width, y1: l.y + l.height / 2 }
}

function rectsOverlap(a: Rect, b: Rect, margin: number): boolean {
  return (
    a.x0 < b.x1 + margin && b.x0 < a.x1 + margin && a.y0 < b.y1 + margin && b.y0 < a.y1 + margin
  )
}

/** Liang–Barsky: does the segment cross the rectangle grown by `margin`? */
function segmentHitsRect(s: TreeBranch, r: Rect, margin: number): boolean {
  const dx = s.x2 - s.x1
  const dy = s.y2 - s.y1
  let t0 = 0
  let t1 = 1
  const edges: [number, number][] = [
    [-dx, s.x1 - (r.x0 - margin)],
    [dx, r.x1 + margin - s.x1],
    [-dy, s.y1 - (r.y0 - margin)],
    [dy, r.y1 + margin - s.y1],
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false
    } else {
      const t = q / p
      if (p < 0) t0 = Math.max(t0, t)
      else t1 = Math.min(t1, t)
      if (t0 > t1) return false
    }
  }
  return true
}

/** Every pair of labels that overlap, and every label a branch runs through. */
export function treeCollisions(model: TreeModel): string[] {
  const found: string[] = []
  const rects = model.labels.map(rectOf)
  const rootRect: Rect = {
    x0: model.root.x - ROOT_RADIUS,
    y0: model.root.y - ROOT_RADIUS,
    x1: model.root.x + ROOT_RADIUS,
    y1: model.root.y + ROOT_RADIUS,
  }
  rects.forEach((r, i) => {
    if (rectsOverlap(r, rootRect, COLLISION_MARGIN)) found.push(`root × label ${i}`)
    for (let j = i + 1; j < rects.length; j++) {
      // Two branch labels keep more air: each must read as its own branch's, not its neighbour's.
      const both = model.labels[i].role === 'probability' && model.labels[j].role === 'probability'
      const spacing = both ? PROBABILITY_SPACING : LABEL_SPACING
      if (rectsOverlap(r, rects[j], spacing)) found.push(`label ${i} × label ${j}`)
    }
    model.branches.forEach((s, k) => {
      if (segmentHitsRect(s, r, COLLISION_MARGIN)) found.push(`branch ${k} × label ${i}`)
    })
  })
  return found
}

/**
 * The drawing model of a tree (ADR 0040 §7): leaves at equal steps along the breadth, each parent
 * at the middle of its children, branch labels at mid-branch on the side away from their siblings,
 * the issues in a column after the leaves (horizontal) or under them (vertical). The leaf step
 * grows until no label overlaps another label or a branch.
 */
export function buildTreeModel(spec: TreeSpec, options: TreeLayoutOptions = {}): TreeModel {
  const compact = options.compact === true
  const orientation: TreeOrientation = compact ? 'horizontal' : (spec.orientation ?? 'horizontal')
  const emphasisPath = spec.highlightPath ? findPath(spec.root, spec.highlightPath) : null

  const rootSpec: TreeNodeSpec = { label: '', children: spec.root.children }
  const root = place(rootSpec, 0, emphasisPath)
  root.eventBox = { width: 0, height: 0 }

  // Leaf texts and the rows of the hidden table.
  const leaves: Leaf[] = []
  const rows: TreePathRow[] = []
  const walk = (node: Placed, path: Placed[]) => {
    if (node.children.length === 0) {
      const labels = path.map((n) => n.spec.label)
      const outcomeString = node.spec.outcome ?? outcomeText(labels)
      const product = spec.products ? productLatex(path.map((n) => n.spec.probability)) : null
      const texts: LeafText[] = []
      const text = (role: LeafText['role'], content: TreeLabelContent) =>
        texts.push({ role, content, box: boxOf(content) })
      if (spec.outcomes) text('outcome', { kind: 'rich', text: outcomeString })
      if (product) {
        const parts = productParts(path.map((n) => n.spec.probability))
        const full = boxOf({ kind: 'math', latex: product })
        // On a phone a long product breaks before its = sign.
        if (compact && parts && parts.factors.length > 1 && full.width > COMPACT_PRODUCT_WIDTH) {
          text('product', { kind: 'math', latex: parts.factors.join('\\times ') })
          text('product', { kind: 'math', latex: `=${parts.result}` })
        } else text('product', { kind: 'math', latex: product })
      }
      leaves.push({ node, texts })
      rows.push({
        steps: path.map((n) => ({
          label: n.spec.label,
          probability: n.probability?.kind === 'math' ? n.probability.latex : null,
        })),
        outcome: outcomeString,
        product,
        emphasis: node.emphasis,
      })
      return
    }
    for (const child of node.children) walk(child, [...path, child])
  }
  walk(root, [])

  const horizontal = orientation === 'horizontal'
  const stack = compact || !horizontal
  // Extent of a box along the depth axis and along the breadth axis.
  const along = (b: Box) => (horizontal ? b.width : b.height)
  const across = (b: Box) => (horizontal ? b.height : b.width)
  const leafTextBreadth = (leaf: Leaf): number => {
    const boxes = leaf.texts.map((t) => t.box)
    if (boxes.length === 0) return 0
    if (horizontal && !stack) return Math.max(...boxes.map((b) => b.height))
    if (horizontal) return boxes.reduce((s, b) => s + b.height, 0) + STACK_GAP * (boxes.length - 1)
    return Math.max(...boxes.map((b) => b.width))
  }

  // Depth axis: one column per level, as wide as its widest label.
  const maxDepth = Math.max(...leaves.map((l) => l.node.depth))
  const columnExtent: number[] = [0]
  for (let depth = 1; depth <= maxDepth; depth++) {
    const atDepth: Placed[] = []
    const collect = (n: Placed) => {
      if (n.depth === depth) atDepth.push(n)
      n.children.forEach(collect)
    }
    collect(root)
    columnExtent.push(Math.max(0, ...atDepth.map((n) => along(n.eventBox))))
  }
  const branch = horizontal
    ? compact
      ? maxDepth >= 3
        ? BRANCH_COMPACT_DEEP
        : BRANCH_COMPACT
      : BRANCH
    : BRANCH_VERTICAL
  const placeDepth = (branchLength: number): number[] => {
    const columnCentre: number[] = [0]
    for (let depth = 1; depth <= maxDepth; depth++) {
      const previousEdge =
        depth === 1 ? 0 : columnCentre[depth - 1] + columnExtent[depth - 1] / 2 + NODE_GAP
      columnCentre.push(previousEdge + branchLength + NODE_GAP + columnExtent[depth] / 2)
    }
    const setDepth = (n: Placed) => {
      n.d = columnCentre[n.depth]
      n.children.forEach(setDepth)
    }
    setDepth(root)
    return columnCentre
  }

  const baseStep = Math.max(
    ...leaves.map((l) => Math.max(across(l.node.eventBox), horizontal ? leafTextBreadth(l) : 0))
  )
  const leafSlot = (l: Leaf) =>
    horizontal ? baseStep : Math.max(across(l.node.eventBox), leafTextBreadth(l))

  let model: TreeModel | null = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // The leaf step grows first; past STEP_ATTEMPTS the branches lengthen too, which opens the
    // narrow angle near a parent where a fan's middle label can meet its neighbour's branch.
    const extra = ROW_GAP + Math.min(attempt, STEP_ATTEMPTS) * STEP_INCREMENT
    const columnCentre = placeDepth(
      branch + Math.max(0, attempt - STEP_ATTEMPTS) * BRANCH_INCREMENT
    )
    // Breadth axis: leaves one after another, parents at the middle of their children.
    let cursor = 0
    leaves.forEach((leaf, i) => {
      const slot = leafSlot(leaf)
      if (i > 0) cursor += slot / 2
      leaf.node.b = cursor
      cursor += slot / 2 + extra
    })
    const centre = (n: Placed): number => {
      if (n.children.length === 0) return n.b
      const bs = n.children.map(centre)
      n.b = (bs[0] + bs[bs.length - 1]) / 2
      return n.b
    }
    centre(root)
    model = draw(root, leaves, rows, orientation, stack, columnCentre, columnExtent, maxDepth)
    if (treeCollisions(model).length === 0) break
  }
  return model as TreeModel
}

function draw(
  root: Placed,
  leaves: Leaf[],
  rows: TreePathRow[],
  orientation: TreeOrientation,
  stack: boolean,
  columnCentre: number[],
  columnExtent: number[],
  maxDepth: number
): TreeModel {
  const horizontal = orientation === 'horizontal'
  const xy = (d: number, b: number) => (horizontal ? { x: d, y: b } : { x: b, y: d })
  const half = (box: Box) => (horizontal ? box.width / 2 : box.height / 2)
  const branches: TreeBranch[] = []
  const labels: TreeLabel[] = []

  const visit = (parent: Placed) => {
    for (const child of parent.children) {
      const startD = parent.depth === 0 ? parent.d : parent.d + half(parent.eventBox) + NODE_GAP
      const endD = child.d - half(child.eventBox) - NODE_GAP
      const a = xy(startD, parent.b)
      const z = xy(endD, child.b)
      const segment: TreeBranch = { x1: a.x, y1: a.y, x2: z.x, y2: z.y, emphasis: child.emphasis }
      branches.push(segment)
      labels.push({
        role: 'event',
        content: child.event,
        ...xy(child.d, child.b),
        anchor: 'middle',
        ...child.eventBox,
        emphasis: false,
      })
      if (child.probability && child.probabilityBox) {
        labels.push({
          role: 'probability',
          content: child.probability,
          ...branchLabelPosition(
            segment,
            child.probabilityBox,
            Math.sign(child.b - parent.b),
            horizontal
          ),
          anchor: 'middle',
          ...child.probabilityBox,
          emphasis: child.emphasis,
        })
      }
      visit(child)
    }
  }
  visit(root)

  // Issues and products: a column after the deepest level, or stacked under each leaf.
  const lastEdge = columnCentre[maxDepth] + columnExtent[maxDepth] / 2
  const outcomeWidth = Math.max(
    0,
    ...leaves.flatMap((l) => l.texts.filter((t) => t.role === 'outcome').map((t) => t.box.width))
  )
  for (const leaf of leaves) {
    const emphasis = leaf.node.emphasis
    const push = (t: LeafText, x: number, y: number, anchor: TreeLabel['anchor']) =>
      labels.push({ role: t.role, content: t.content, x, y, anchor, ...t.box, emphasis })
    if (horizontal && !stack) {
      let x = lastEdge + COLUMN_GAP
      for (const t of leaf.texts) {
        push(t, x, leaf.node.b, 'start')
        x += (t.role === 'outcome' ? outcomeWidth : t.box.width) + PRODUCT_GAP
      }
    } else if (horizontal) {
      const total =
        leaf.texts.reduce((s, t) => s + t.box.height, 0) + STACK_GAP * (leaf.texts.length - 1)
      let y = leaf.node.b - total / 2
      for (const t of leaf.texts) {
        push(t, lastEdge + COLUMN_GAP, y + t.box.height / 2, 'start')
        y += t.box.height + STACK_GAP
      }
    } else {
      let y = lastEdge + ROW_GAP
      for (const t of leaf.texts) {
        push(t, leaf.node.b, y + t.box.height / 2, 'middle')
        y += t.box.height + STACK_GAP
      }
    }
  }

  // Fit everything, labels included, inside the canvas with a small margin.
  const rects = labels.map(rectOf)
  const rootPoint = xy(root.d, root.b)
  const xs = [
    rootPoint.x - ROOT_RADIUS,
    rootPoint.x + ROOT_RADIUS,
    ...rects.flatMap((r) => [r.x0, r.x1]),
    ...branches.flatMap((s) => [s.x1, s.x2]),
  ]
  const ys = [
    rootPoint.y - ROOT_RADIUS,
    rootPoint.y + ROOT_RADIUS,
    ...rects.flatMap((r) => [r.y0, r.y1]),
    ...branches.flatMap((s) => [s.y1, s.y2]),
  ]
  const dx = MARGIN - Math.min(...xs)
  const dy = MARGIN - Math.min(...ys)
  const r1 = (n: number) => Math.round(n * 10) / 10
  return {
    width: Math.ceil(Math.max(...xs) + dx + MARGIN),
    height: Math.ceil(Math.max(...ys) + dy + MARGIN),
    orientation,
    root: { x: r1(rootPoint.x + dx), y: r1(rootPoint.y + dy) },
    branches: branches.map((s) => ({
      ...s,
      x1: r1(s.x1 + dx),
      y1: r1(s.y1 + dy),
      x2: r1(s.x2 + dx),
      y2: r1(s.y2 + dy),
    })),
    labels: labels.map((l) => ({ ...l, x: r1(l.x + dx), y: r1(l.y + dy) })),
    rows,
  }
}

/**
 * Mid-branch, pushed off the branch along its normal by half the box's extent in that direction
 * plus a gap, on the side away from the siblings: towards smaller breadth for a branch going that
 * way, larger for the other way, and the smaller side for a straight one (above, or on the left).
 */
function branchLabelPosition(
  s: TreeBranch,
  box: Box,
  breadthDirection: number,
  horizontal: boolean
): { x: number; y: number } {
  const mx = (s.x1 + s.x2) / 2
  const my = (s.y1 + s.y2) / 2
  const length = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1
  let nx = -(s.y2 - s.y1) / length
  let ny = (s.x2 - s.x1) / length
  const breadthOfNormal = horizontal ? ny : nx
  const wanted = breadthDirection > 0 ? 1 : -1
  if (Math.sign(breadthOfNormal) !== wanted) {
    nx = -nx
    ny = -ny
  }
  const offset = (box.width * Math.abs(nx) + box.height * Math.abs(ny)) / 2 + LABEL_GAP
  return { x: mx + nx * offset, y: my + ny * offset }
}
