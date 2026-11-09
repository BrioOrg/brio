// Scratch programmes written as text in a `code` block with language "scratch" (ADR 0031).
//
// This module has no imports and uses only erasable TypeScript, so check-content can load it
// with Node's type stripping and run the exact parser the renderer uses.

// --- Parsed tree ---

export type ScratchOperator = '+' | '-' | '*' | '/'

export type ScratchValue =
  /** `text` is the number as written (decimal comma kept); `value` is its numeric value. */
  | { kind: 'number'; text: string; value: number }
  | { kind: 'text'; text: string }
  | { kind: 'variable'; name: string }
  | { kind: 'answer' }
  | { kind: 'operator'; op: ScratchOperator; left: ScratchValue; right: ScratchValue }

export type ScratchComparator = '<' | '=' | '>'
export type ScratchLogical = 'et' | 'ou'

/**
 * A boolean block (drawn as a hexagon, ADR 0031 §2, 4e). It reports true/false and can only sit
 * in the condition of a `si` or a `répéter jusqu'à ce que`, never in a value slot. A comparison
 * compares two values; a logical combines two booleans.
 */
export type ScratchBoolean =
  | { kind: 'comparison'; op: ScratchComparator; left: ScratchValue; right: ScratchValue }
  | { kind: 'logical'; op: ScratchLogical; left: ScratchBoolean; right: ScratchBoolean }

export type ScratchStatement =
  | { kind: 'whenFlagClicked'; line: number }
  | { kind: 'ask'; question: ScratchValue; line: number }
  | { kind: 'setVariable'; variable: string; value: ScratchValue; line: number }
  | { kind: 'changeVariable'; variable: string; by: ScratchValue; line: number }
  | { kind: 'say'; message: ScratchValue; line: number }
  | { kind: 'move'; steps: ScratchValue; line: number }
  | { kind: 'turn'; direction: 'right' | 'left'; degrees: ScratchValue; line: number }
  | { kind: 'repeat'; times: ScratchValue; body: ScratchStatement[]; line: number }
  /**
   * `elseBody === null` is a plain `si … alors … fin` (a C block); an array (even empty) means a
   * `sinon` was seen, so it is a `si … alors … sinon … fin` (a double C block).
   */
  | {
      kind: 'if'
      condition: ScratchBoolean
      body: ScratchStatement[]
      elseBody: ScratchStatement[] | null
      line: number
    }
  | { kind: 'repeatUntil'; condition: ScratchBoolean; body: ScratchStatement[]; line: number }
  | { kind: 'penDown'; line: number }
  | { kind: 'penUp'; line: number }
  | { kind: 'clear'; line: number }

/** A stable code per error, so the web can translate without matching the English message. */
export type ScratchErrorCode =
  | 'blankLine'
  | 'tabs'
  // These five "block" codes stay named after the loop they first guarded (#307: codes are
  // stable), but `params.blockType` now carries which block they are about (répéter, répéter
  // jusqu'à, si, sinon) so the copy can name it.
  | 'finWithoutLoop'
  | 'finIndent'
  | 'emptyLoop'
  | 'loopNotClosedBeforeLine'
  | 'loopNeverClosed'
  | 'unexpectedIndent'
  | 'flagNotFirst'
  | 'unknownInstruction'
  | 'invalidVariableName'
  | 'valueMissing'
  | 'valueMissingBeforeOperator'
  | 'valueMissingBeforeClose'
  | 'closeMissing'
  | 'oneOperatorPerPair'
  | 'operatorNeedsParentheses'
  | 'unexpectedTextAfterValue'
  | 'textNeverClosed'
  | 'emptyText'
  | 'wrongOperatorSymbol'
  | 'unexpectedCharacter'
  // Booleans and conditions (4e).
  | 'conditionNotBoolean'
  | 'booleanInValueSlot'
  | 'comparisonNeedsValues'
  | 'logicalNeedsBooleans'
  // `sinon` of a `si`.
  | 'sinonWithoutIf'
  | 'sinonIndent'
  | 'duplicateSinon'

/** Which block a "block" code is about, so the copy names it (« répéter », « si »…). */
export type ScratchBlockType = 'repeat' | 'repeatUntil' | 'if' | 'else'

/** Values interpolated into a message; which fields are set depends on the code. */
export type ScratchErrorParams = {
  loopLine?: number
  blockType?: ScratchBlockType
  expected?: number
  text?: string
  source?: string
  operator?: string
  symbol?: string
  correct?: string
  character?: string
}

/**
 * The English message for each code — shown by check-content, read by developers. Reword freely:
 * the web translates by `code`, not by this text (ADR 0031, #307).
 */
/** The block keyword a "block" code names in the English message; defaults to "répéter". */
function englishBlock(blockType?: ScratchBlockType): string {
  switch (blockType) {
    case 'repeatUntil':
      return '"répéter jusqu\'à ce que"'
    case 'if':
      return '"si"'
    case 'else':
      return '"sinon"'
    default:
      return '"répéter"'
  }
}

const MESSAGES: Record<ScratchErrorCode, (p: ScratchErrorParams) => string> = {
  blankLine: () => 'blank line — a programme is one block of lines',
  tabs: (p) => `indent with ${p.expected} spaces, not tabs`,
  finWithoutLoop: () => '"fin" closes no block',
  finIndent: (p) =>
    `"fin" must be at the indentation of its ${englishBlock(p.blockType)} (line ${p.loopLine})`,
  emptyLoop: (p) => `${englishBlock(p.blockType)} has an empty body`,
  loopNotClosedBeforeLine: (p) =>
    `${englishBlock(p.blockType)} (line ${p.loopLine}) must be closed by "fin" before this line`,
  unexpectedIndent: (p) => `unexpected indentation (expected ${p.expected} spaces)`,
  flagNotFirst: () => 'the green-flag block can only start a programme',
  loopNeverClosed: (p) => `${englishBlock(p.blockType)} is never closed by "fin"`,
  unknownInstruction: (p) => `unknown instruction "${p.text}" — see the catalogue in ADR 0031`,
  invalidVariableName: (p) =>
    `"${p.text}" is not a variable name (letters, digits and _, no spaces)`,
  valueMissing: (p) => `a value is missing in "${p.source}"`,
  valueMissingBeforeOperator: (p) => `a value is missing before "${p.operator}" in "${p.source}"`,
  valueMissingBeforeClose: (p) => `a value is missing before ")" in "${p.source}"`,
  closeMissing: (p) => `")" is missing in "${p.source}"`,
  oneOperatorPerPair: (p) =>
    `one operator per pair of parentheses, as in Scratch: ((a + b) * c), in "${p.source}"`,
  operatorNeedsParentheses: (p) =>
    `an operator block goes in parentheses, as in Scratch: (a * b), in "${p.source}"`,
  unexpectedTextAfterValue: (p) => `unexpected text after the value in "${p.source}"`,
  textNeverClosed: (p) => `« is never closed by » in "${p.source}"`,
  emptyText: (p) => `empty text « » in "${p.source}"`,
  wrongOperatorSymbol: (p) => `Scratch writes ${p.correct}, not ${p.symbol}, in "${p.source}"`,
  unexpectedCharacter: (p) => `unexpected character "${p.character}" in "${p.source}"`,
  conditionNotBoolean: (p) =>
    `a condition must be a boolean (a comparison or a et/ou), not "${p.source}"`,
  booleanInValueSlot: (p) => `a boolean sits where a value is expected, in "${p.source}"`,
  comparisonNeedsValues: (p) => `a comparison compares values, not booleans, in "${p.source}"`,
  logicalNeedsBooleans: (p) => `"et"/"ou" combine booleans, not values, in "${p.source}"`,
  sinonWithoutIf: () => '"sinon" closes no "si"',
  sinonIndent: (p) => `"sinon" must be at the indentation of its "si" (line ${p.loopLine})`,
  duplicateSinon: () => 'a "si" has only one "sinon"',
}

/**
 * A parse error. `message` is English (check-content / developers); `code` + `params` are the
 * stable, language-agnostic form the web translates. `line` is 1-based, counted in `code`.
 */
export type ScratchError = {
  line: number
  code: ScratchErrorCode
  params: ScratchErrorParams
  message: string
}

export type ScratchParseResult =
  { ok: true; script: ScratchStatement[] } | { ok: false; errors: ScratchError[] }

// --- Drawing model (no coordinates: the renderer lays the parts out, ADR 0031 §3) ---

export type ScratchCategory =
  'events' | 'control' | 'motion' | 'looks' | 'sensing' | 'operators' | 'variables' | 'pen'

export type ScratchPart =
  | { kind: 'label'; text: string }
  /** `label` names the icon in words, for a renderer that cannot draw it. */
  | { kind: 'icon'; icon: 'flag' | 'turn-right' | 'turn-left'; label: string }
  /** A white oval holding a number or a text typed in the block. */
  | { kind: 'input'; text: string }
  /** A variable chosen in a block's menu (`mettre [x ▾] à`). */
  | { kind: 'dropdown'; text: string }
  /** A rounded block nested in a slot: a variable, `réponse` or an operator. */
  | { kind: 'reporter'; category: ScratchCategory; parts: ScratchPart[] }
  /** A hexagonal boolean block nested in a condition slot: a comparison or a et/ou. */
  | { kind: 'boolean'; category: ScratchCategory; parts: ScratchPart[] }

export type ScratchBlock = {
  category: ScratchCategory
  /** `cElse` is a double C block (`si … alors … sinon … fin`); its else row and body are below. */
  shape: 'hat' | 'stack' | 'c' | 'cElse'
  parts: ScratchPart[]
  /** The blocks inside a C block (the `alors` branch for a `si`); empty for the other shapes. */
  body: ScratchBlock[]
  /** The `sinon` separator row of a double C block. */
  elseParts?: ScratchPart[]
  /** The blocks of the `sinon` branch of a double C block. */
  elseBody?: ScratchBlock[]
}

// --- Parser ---

const INDENT = 4
const IDENTIFIER = /^[\p{L}_][\p{L}\p{N}_]*$/u
const ANSWER = 'réponse'

type Token =
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'op'; op: ScratchOperator }
  | { kind: 'cmp'; op: ScratchComparator }
  | { kind: 'number'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'word'; text: string }

class ScratchSyntaxError extends Error {
  code: ScratchErrorCode
  params: ScratchErrorParams
  constructor(code: ScratchErrorCode, params: ScratchErrorParams = {}) {
    super(MESSAGES[code](params))
    this.code = code
    this.params = params
  }
}

/** The statements that open a C block and so a frame. */
type LoopStatement = Extract<ScratchStatement, { kind: 'repeat' | 'repeatUntil' | 'if' }>
type OpenBlock = { kind: LoopStatement['kind']; statement: LoopStatement }

type AddError = (line: number, code: ScratchErrorCode, params?: ScratchErrorParams) => void

/** Report an empty body when a C block closes: the `alors` of a `si` at its `sinon` or `fin`, the
 * `sinon` at `fin`, a loop body at its `fin`. */
function reportEmptyBranch(block: OpenBlock, add: AddError): void {
  const s = block.statement
  if (s.kind === 'if') {
    if (s.elseBody === null) {
      if (s.body.length === 0) add(s.line, 'emptyLoop', { blockType: 'if' })
    } else if (s.elseBody.length === 0) {
      add(s.line, 'emptyLoop', { blockType: 'else' })
    }
  } else if (s.body.length === 0) {
    add(s.line, 'emptyLoop', { blockType: s.kind })
  }
}

export function parseScratch(code: string): ScratchParseResult {
  const lines = code.replace(/\n$/, '').split('\n')
  const errors: ScratchError[] = []
  const add = (line: number, code: ScratchErrorCode, params: ScratchErrorParams = {}) =>
    errors.push({ line, code, params, message: MESSAGES[code](params) })
  const script: ScratchStatement[] = []
  // The open C blocks, innermost last; the root has none. `block` is the open `répéter`, `répéter
  // jusqu'à ce que` or `si` whose body the lines are landing in; `body` is that active body (a
  // `sinon` switches it from the `si`'s `body` to its `elseBody`).
  const frames: Array<{ indent: number; body: ScratchStatement[]; block: OpenBlock | null }> = [
    { indent: 0, body: script, block: null },
  ]

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    const raw = lines[i]
    if (raw.trim() === '') {
      add(lineNo, 'blankLine')
      continue
    }
    if (/^\s*\t/.test(raw)) {
      add(lineNo, 'tabs', { expected: INDENT })
      continue
    }
    const indent = raw.length - raw.trimStart().length
    const text = raw.trim().replace(/\s+/g, ' ')
    const frame = frames[frames.length - 1]

    if (text === 'fin') {
      if (frame.block === null) {
        add(lineNo, 'finWithoutLoop')
      } else if (indent !== frame.indent - INDENT) {
        add(lineNo, 'finIndent', { loopLine: frame.block.statement.line, blockType: frame.block.kind })
      } else {
        reportEmptyBranch(frame.block, add)
        frames.pop()
      }
      continue
    }

    // `sinon` is a bare keyword, like `fin`, handled before the indentation check: it switches the
    // active body of an open `si` to its else branch (it does not open a frame).
    if (text === 'sinon') {
      // Narrow on the statement's kind, which also narrows it to the `if` shape (elseBody).
      const statement = frame.block?.statement
      if (statement === undefined || statement.kind !== 'if') {
        add(lineNo, 'sinonWithoutIf')
      } else if (statement.elseBody !== null) {
        add(lineNo, 'duplicateSinon')
      } else if (indent !== frame.indent - INDENT) {
        add(lineNo, 'sinonIndent', { loopLine: statement.line })
      } else {
        if (statement.body.length === 0) {
          add(statement.line, 'emptyLoop', { blockType: 'if' })
        }
        statement.elseBody = []
        frame.body = statement.elseBody
      }
      continue
    }

    if (indent !== frame.indent) {
      if (indent < frame.indent && frame.block !== null) {
        add(lineNo, 'loopNotClosedBeforeLine', {
          loopLine: frame.block.statement.line,
          blockType: frame.block.kind,
        })
      } else {
        add(lineNo, 'unexpectedIndent', { expected: frame.indent })
      }
      continue
    }

    let parsed: ScratchStatement
    try {
      parsed = parseStatement(text, lineNo)
    } catch (e) {
      if (!(e instanceof ScratchSyntaxError)) throw e
      errors.push({ line: lineNo, code: e.code, params: e.params, message: e.message })
      continue
    }
    if (parsed.kind === 'whenFlagClicked' && lineNo !== 1) {
      add(lineNo, 'flagNotFirst')
      continue
    }
    frame.body.push(parsed)
    if (parsed.kind === 'repeat' || parsed.kind === 'repeatUntil' || parsed.kind === 'if') {
      frames.push({ indent: indent + INDENT, body: parsed.body, block: { kind: parsed.kind, statement: parsed } })
    }
  }

  for (const frame of frames.slice(1).reverse()) {
    if (frame.block) {
      add(frame.block.statement.line, 'loopNeverClosed', { blockType: frame.block.kind })
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, script }
}

function parseStatement(text: string, line: number): ScratchStatement {
  if (text === 'quand le drapeau vert est cliqué') return { kind: 'whenFlagClicked', line }

  // Pen extension: three exact lines, matched like the green flag.
  if (text === "stylo en position d'écriture") return { kind: 'penDown', line }
  if (text === 'relever le stylo') return { kind: 'penUp', line }
  if (text === 'effacer tout') return { kind: 'clear', line }

  let m = /^si (.+) alors$/.exec(text)
  if (m) return { kind: 'if', condition: parseBoolean(m[1]), body: [], elseBody: null, line }

  // Before `répéter … fois`: Scratch 3's real wording is « répéter jusqu'à ce que » (ADR 0031).
  m = /^répéter jusqu'à ce que (.+)$/.exec(text)
  if (m) return { kind: 'repeatUntil', condition: parseBoolean(m[1]), body: [], line }

  m = /^demander (.+) et attendre$/.exec(text)
  if (m) return { kind: 'ask', question: parseValue(m[1]), line }

  m = /^mettre (\S+) à (.+)$/.exec(text)
  if (m) return { kind: 'setVariable', variable: variableName(m[1]), value: parseValue(m[2]), line }

  m = /^ajouter (.+) à (\S+)$/.exec(text)
  if (m) return { kind: 'changeVariable', variable: variableName(m[2]), by: parseValue(m[1]), line }

  m = /^dire (.+)$/.exec(text)
  if (m) return { kind: 'say', message: parseValue(m[1]), line }

  m = /^avancer de (.+) pas$/.exec(text)
  if (m) return { kind: 'move', steps: parseValue(m[1]), line }

  m = /^tourner à (droite|gauche) de (.+) degrés$/.exec(text)
  if (m) {
    const direction = m[1] === 'droite' ? 'right' : 'left'
    return { kind: 'turn', direction, degrees: parseValue(m[2]), line }
  }

  m = /^répéter (.+) fois$/.exec(text)
  if (m) return { kind: 'repeat', times: parseValue(m[1]), body: [], line }
  throw new ScratchSyntaxError('unknownInstruction', { text })
}

function variableName(text: string): string {
  if (!IDENTIFIER.test(text) || text === ANSWER) {
    throw new ScratchSyntaxError('invalidVariableName', { text })
  }
  return text
}

/**
 * A parsed operand, tagged by the type its enclosing operator decides: an arithmetic operator
 * makes a 'value', a comparison or a et/ou makes a 'boolean'. Parentheses are required around
 * every operator (comparison and logical alike), exactly as around arithmetic — no precedence.
 */
type Parsed =
  | { type: 'value'; node: ScratchValue }
  | { type: 'boolean'; node: ScratchBoolean }

/** Parse one value-or-boolean expression. `et`/`ou` are operators only in operator position;
 * elsewhere they stay variable names. The root's type is checked by the caller. */
function parseExpression(source: string): Parsed {
  const tokens = tokenize(source)
  let pos = 0

  // One operand: a parenthesised group, or a leaf (number, text, word, négative number).
  function element(): Parsed {
    const token = tokens[pos]
    if (!token) throw new ScratchSyntaxError('valueMissing', { source })
    if (token.kind === 'open') return group()
    pos++
    switch (token.kind) {
      case 'number':
        return { type: 'value', node: number(token.text) }
      case 'text':
        return { type: 'value', node: { kind: 'text', text: token.text } }
      case 'word':
        return {
          type: 'value',
          node:
            token.text === ANSWER
              ? { kind: 'answer' }
              : { kind: 'variable', name: variableName(token.text) },
        }
      case 'op': {
        const next = tokens[pos]
        if (token.op === '-' && next?.kind === 'number') {
          pos++
          return { type: 'value', node: number('-' + next.text) }
        }
        throw new ScratchSyntaxError('valueMissingBeforeOperator', { operator: token.op, source })
      }
      case 'cmp':
        throw new ScratchSyntaxError('valueMissingBeforeOperator', { operator: token.op, source })
      case 'close':
        throw new ScratchSyntaxError('valueMissingBeforeClose', { source })
    }
  }

  // `(` left <operator> right `)` — the operator decides the type and what the operands must be.
  function group(): Parsed {
    pos++ // consume '('
    const left = element()
    const op = tokens[pos]
    if (op?.kind === 'close') {
      pos++ // a bare grouping: (x) or ((x > 0))
      return left
    }
    if (op?.kind === 'op') {
      pos++
      const right = element()
      expectClose()
      if (left.type !== 'value' || right.type !== 'value') {
        throw new ScratchSyntaxError('booleanInValueSlot', { source })
      }
      return { type: 'value', node: { kind: 'operator', op: op.op, left: left.node, right: right.node } }
    }
    if (op?.kind === 'cmp') {
      pos++
      const right = element()
      expectClose()
      if (left.type !== 'value' || right.type !== 'value') {
        throw new ScratchSyntaxError('comparisonNeedsValues', { source })
      }
      return {
        type: 'boolean',
        node: { kind: 'comparison', op: op.op, left: left.node, right: right.node },
      }
    }
    if (op?.kind === 'word' && (op.text === 'et' || op.text === 'ou')) {
      pos++
      const right = element()
      expectClose()
      if (left.type !== 'boolean' || right.type !== 'boolean') {
        throw new ScratchSyntaxError('logicalNeedsBooleans', { source })
      }
      return {
        type: 'boolean',
        node: { kind: 'logical', op: op.text, left: left.node, right: right.node },
      }
    }
    throw new ScratchSyntaxError('closeMissing', { source })
  }

  function expectClose(): void {
    const end = tokens[pos]
    if (end === undefined) throw new ScratchSyntaxError('closeMissing', { source })
    if (end.kind !== 'close') throw new ScratchSyntaxError('oneOperatorPerPair', { source })
    pos++
  }

  const result = element()
  if (pos < tokens.length) {
    const rest = tokens[pos]
    throw new ScratchSyntaxError(
      rest.kind === 'op' || rest.kind === 'cmp'
        ? 'operatorNeedsParentheses'
        : 'unexpectedTextAfterValue',
      { source }
    )
  }
  return result
}

function parseValue(source: string): ScratchValue {
  const parsed = parseExpression(source)
  if (parsed.type !== 'value') throw new ScratchSyntaxError('booleanInValueSlot', { source })
  return parsed.node
}

function parseBoolean(source: string): ScratchBoolean {
  const parsed = parseExpression(source)
  if (parsed.type !== 'boolean') throw new ScratchSyntaxError('conditionNotBoolean', { source })
  return parsed.node
}

function number(text: string): ScratchValue {
  return { kind: 'number', text, value: Number(text.replace(',', '.')) }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < source.length) {
    const c = source[i]
    if (c === ' ') {
      i++
    } else if (c === '(') {
      tokens.push({ kind: 'open' })
      i++
    } else if (c === ')') {
      tokens.push({ kind: 'close' })
      i++
    } else if (c === '+' || c === '-' || c === '*' || c === '/') {
      tokens.push({ kind: 'op', op: c })
      i++
    } else if (c === '<' || c === '=' || c === '>') {
      tokens.push({ kind: 'cmp', op: c })
      i++
    } else if (c === '«') {
      const end = source.indexOf('»', i + 1)
      if (end === -1) throw new ScratchSyntaxError('textNeverClosed', { source })
      const text = source.slice(i + 1, end).trim()
      if (text === '') throw new ScratchSyntaxError('emptyText', { source })
      tokens.push({ kind: 'text', text })
      i = end + 1
    } else {
      const m = /^\d+(?:[.,]\d+)?/.exec(source.slice(i)) ?? /^[\p{L}\p{N}_]+/u.exec(source.slice(i))
      if (!m) {
        if (c === '×' || c === '÷') {
          throw new ScratchSyntaxError('wrongOperatorSymbol', {
            symbol: c,
            correct: c === '×' ? '*' : '/',
            source,
          })
        }
        throw new ScratchSyntaxError('unexpectedCharacter', { character: c, source })
      }
      tokens.push(/^\d/.test(m[0]) ? { kind: 'number', text: m[0] } : { kind: 'word', text: m[0] })
      i += m[0].length
    }
  }
  return tokens
}

// --- Model ---

export function buildScratchModel(script: ScratchStatement[]): ScratchBlock[] {
  return script.map(block)
}

function block(s: ScratchStatement): ScratchBlock {
  const label = (text: string): ScratchPart => ({ kind: 'label', text })
  const stack = (category: ScratchCategory, parts: ScratchPart[]): ScratchBlock => ({
    category,
    shape: 'stack',
    parts,
    body: [],
  })
  switch (s.kind) {
    case 'whenFlagClicked':
      return {
        category: 'events',
        shape: 'hat',
        parts: [
          label('quand'),
          { kind: 'icon', icon: 'flag', label: 'le drapeau vert' },
          label('est cliqué'),
        ],
        body: [],
      }
    case 'ask':
      return stack('sensing', [label('demander'), slot(s.question), label('et attendre')])
    case 'setVariable':
      return stack('variables', [
        label('mettre'),
        { kind: 'dropdown', text: s.variable },
        label('à'),
        slot(s.value),
      ])
    case 'changeVariable':
      return stack('variables', [
        label('ajouter'),
        slot(s.by),
        label('à'),
        { kind: 'dropdown', text: s.variable },
      ])
    case 'say':
      return stack('looks', [label('dire'), slot(s.message)])
    case 'move':
      return stack('motion', [label('avancer de'), slot(s.steps), label('pas')])
    case 'turn':
      return stack('motion', [
        label('tourner'),
        s.direction === 'right'
          ? { kind: 'icon', icon: 'turn-right', label: 'à droite' }
          : { kind: 'icon', icon: 'turn-left', label: 'à gauche' },
        label('de'),
        slot(s.degrees),
        label('degrés'),
      ])
    case 'repeat':
      return {
        category: 'control',
        shape: 'c',
        parts: [label('répéter'), slot(s.times), label('fois')],
        body: s.body.map(block),
      }
    case 'if': {
      const parts = [label('si'), booleanSlot(s.condition), label('alors')]
      if (s.elseBody === null) {
        return { category: 'control', shape: 'c', parts, body: s.body.map(block) }
      }
      return {
        category: 'control',
        shape: 'cElse',
        parts,
        body: s.body.map(block),
        elseParts: [label('sinon')],
        elseBody: s.elseBody.map(block),
      }
    }
    case 'repeatUntil':
      return {
        category: 'control',
        shape: 'c',
        parts: [label("répéter jusqu'à ce que"), booleanSlot(s.condition)],
        body: s.body.map(block),
      }
    case 'penDown':
      return stack('pen', [label("stylo en position d'écriture")])
    case 'penUp':
      return stack('pen', [label('relever le stylo')])
    case 'clear':
      return stack('pen', [label('effacer tout')])
  }
}

/** A hexagonal boolean block in a condition slot: a comparison of two values, or a et/ou of two
 * booleans. Same category ('operators', green) as the arithmetic reporters; only the shape differs. */
function booleanSlot(b: ScratchBoolean): ScratchPart {
  if (b.kind === 'comparison') {
    return {
      kind: 'boolean',
      category: 'operators',
      parts: [slot(b.left), { kind: 'label', text: b.op }, slot(b.right)],
    }
  }
  return {
    kind: 'boolean',
    category: 'operators',
    parts: [booleanSlot(b.left), { kind: 'label', text: b.op }, booleanSlot(b.right)],
  }
}

function slot(v: ScratchValue): ScratchPart {
  switch (v.kind) {
    case 'number':
    case 'text':
      return { kind: 'input', text: v.text }
    case 'variable':
      return { kind: 'reporter', category: 'variables', parts: [{ kind: 'label', text: v.name }] }
    case 'answer':
      return { kind: 'reporter', category: 'sensing', parts: [{ kind: 'label', text: ANSWER }] }
    case 'operator':
      return {
        kind: 'reporter',
        category: 'operators',
        parts: [slot(v.left), { kind: 'label', text: v.op }, slot(v.right)],
      }
  }
}
