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

export type ScratchStatement =
  | { kind: 'whenFlagClicked'; line: number }
  | { kind: 'ask'; question: ScratchValue; line: number }
  | { kind: 'setVariable'; variable: string; value: ScratchValue; line: number }
  | { kind: 'changeVariable'; variable: string; by: ScratchValue; line: number }
  | { kind: 'say'; message: ScratchValue; line: number }
  | { kind: 'move'; steps: ScratchValue; line: number }
  | { kind: 'turn'; direction: 'right' | 'left'; degrees: ScratchValue; line: number }
  | { kind: 'repeat'; times: ScratchValue; body: ScratchStatement[]; line: number }

/** A stable code per error, so the web can translate without matching the English message. */
export type ScratchErrorCode =
  | 'blankLine'
  | 'tabs'
  | 'finWithoutLoop'
  | 'finIndent'
  | 'emptyLoop'
  | 'loopNotClosedBeforeLine'
  | 'unexpectedIndent'
  | 'flagNotFirst'
  | 'loopNeverClosed'
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

/** Values interpolated into a message; which fields are set depends on the code. */
export type ScratchErrorParams = {
  loopLine?: number
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
const MESSAGES: Record<ScratchErrorCode, (p: ScratchErrorParams) => string> = {
  blankLine: () => 'blank line — a programme is one block of lines',
  tabs: (p) => `indent with ${p.expected} spaces, not tabs`,
  finWithoutLoop: () => '"fin" closes no "répéter"',
  finIndent: (p) => `"fin" must be at the indentation of its "répéter" (line ${p.loopLine})`,
  emptyLoop: () => '"répéter" has an empty body',
  loopNotClosedBeforeLine: (p) =>
    `"répéter" (line ${p.loopLine}) must be closed by "fin" before this line`,
  unexpectedIndent: (p) => `unexpected indentation (expected ${p.expected} spaces)`,
  flagNotFirst: () => 'the green-flag block can only start a programme',
  loopNeverClosed: () => '"répéter" is never closed by "fin"',
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
  'events' | 'control' | 'motion' | 'looks' | 'sensing' | 'operators' | 'variables'

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

export type ScratchBlock = {
  category: ScratchCategory
  shape: 'hat' | 'stack' | 'c'
  parts: ScratchPart[]
  /** The blocks inside a C block; empty for the other shapes. */
  body: ScratchBlock[]
}

// --- Parser ---

const INDENT = 4
const IDENTIFIER = /^[\p{L}_][\p{L}\p{N}_]*$/u
const ANSWER = 'réponse'

type Token =
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'op'; op: ScratchOperator }
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

export function parseScratch(code: string): ScratchParseResult {
  const lines = code.replace(/\n$/, '').split('\n')
  const errors: ScratchError[] = []
  const add = (line: number, code: ScratchErrorCode, params: ScratchErrorParams = {}) =>
    errors.push({ line, code, params, message: MESSAGES[code](params) })
  const script: ScratchStatement[] = []
  // Open loops, innermost last; the root has no loop.
  const frames: Array<{ indent: number; body: ScratchStatement[]; loop: ScratchStatement | null }> =
    [{ indent: 0, body: script, loop: null }]

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
      if (frame.loop === null) {
        add(lineNo, 'finWithoutLoop')
      } else if (indent !== frame.indent - INDENT) {
        add(lineNo, 'finIndent', { loopLine: frame.loop.line })
      } else {
        if (frame.body.length === 0) {
          add(frame.loop.line, 'emptyLoop')
        }
        frames.pop()
      }
      continue
    }

    if (indent !== frame.indent) {
      if (indent < frame.indent && frame.loop !== null) {
        add(lineNo, 'loopNotClosedBeforeLine', { loopLine: frame.loop.line })
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
    if (parsed.kind === 'repeat') {
      frames.push({ indent: indent + INDENT, body: parsed.body, loop: parsed })
    }
  }

  for (const frame of frames.slice(1).reverse()) {
    if (frame.loop) {
      add(frame.loop.line, 'loopNeverClosed')
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, script }
}

function parseStatement(text: string, line: number): ScratchStatement {
  if (text === 'quand le drapeau vert est cliqué') return { kind: 'whenFlagClicked', line }

  let m = /^demander (.+) et attendre$/.exec(text)
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

function parseValue(source: string): ScratchValue {
  const tokens = tokenize(source)
  let pos = 0

  function value(): ScratchValue {
    const token = tokens[pos]
    if (!token) throw new ScratchSyntaxError('valueMissing', { source })
    pos++
    switch (token.kind) {
      case 'number':
        return number(token.text)
      case 'text':
        return { kind: 'text', text: token.text }
      case 'word':
        return token.text === ANSWER
          ? { kind: 'answer' }
          : { kind: 'variable', name: variableName(token.text) }
      case 'op': {
        const next = tokens[pos]
        if (token.op === '-' && next?.kind === 'number') {
          pos++
          return number('-' + next.text)
        }
        throw new ScratchSyntaxError('valueMissingBeforeOperator', { operator: token.op, source })
      }
      case 'close':
        throw new ScratchSyntaxError('valueMissingBeforeClose', { source })
      case 'open': {
        const left = value()
        const after = tokens[pos]
        if (after?.kind === 'close') {
          pos++
          return left
        }
        if (after?.kind !== 'op') throw new ScratchSyntaxError('closeMissing', { source })
        pos++
        const right = value()
        const end = tokens[pos]
        if (end === undefined) throw new ScratchSyntaxError('closeMissing', { source })
        if (end.kind !== 'close') {
          throw new ScratchSyntaxError('oneOperatorPerPair', { source })
        }
        pos++
        return { kind: 'operator', op: after.op, left, right }
      }
    }
  }

  const result = value()
  if (pos < tokens.length) {
    throw new ScratchSyntaxError(
      tokens[pos].kind === 'op' ? 'operatorNeedsParentheses' : 'unexpectedTextAfterValue',
      { source }
    )
  }
  return result
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
