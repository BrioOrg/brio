// A small, safe reader for the expression of a function, as a French maths page writes it
// (ADR 0038). No `eval`, no `Function`: the text is tokenised, parsed by recursive descent into a
// tree, and the tree is compiled into nested closures.
//
//   numbers      2   2,5   2.5          (decimal comma or point; a function has one argument,
//                                        so a comma is never a separator)
//   variable     x, plus the parameters the caller allows (a, b, k…)
//   operators    +  −  -  ×  *  ·  /  ÷  ^  ²  ³
//   implicit ×   2x   3(x + 1)   (x − 1)(x + 2)   2√x   ax
//   functions    sqrt(…)  racine(…)  √x  √(…)  abs(…)  |…|
//   constant     π  pi
//
// Precedence, loosest first: + −, then × / and the implicit product (left to right, so
// 1/2x = (1/2)·x), then the sign (−x² = −(x²)), then ^ (right to left: 2^3^2 = 2^9).
//
// With the `calculator` option (graphing calculator, ADR 0049) it also reads, and only then:
//   functions    sin cos tan exp ln log (decimal logarithm), with an angle unit for sin cos tan
//   constants    π, pi and e (Euler's number), kept as `constant` nodes so they print as typed
//   letters      every single letter is a variable: the caller decides what each one means
//   user calls   f(…), f'(…), f''(…) for the names in `calculator.functions` (f, g, f1…)
//   d/dx(…)      the derivative of what the brackets hold, with respect to x; only this exact
//                prefix: d stays an ordinary letter elsewhere (d = 2, dx is d·x)
//   positions    every node carries the index of the character it starts at (`pos`), and a
//                number the text it was typed as (`text`), for exact fractions and the preview
//   bounds       at most 500 characters and 150 nested levels (the deeper input would
//                overflow the call stack further down: sampling, derivatives, LaTeX)
// Without the option nothing changes: ADR 0038 figures read exactly what they read before.

import { DeriveeTropLongue, deriver } from './grapheur/derivee'

// `pos` is only set in calculator mode: the 0-based index of the character the node comes from.
// `ddx`, on the root of a derivative read from d/dx(…), is the tree it derives: the preview writes
// \frac{d}{dx}(…) from it, every other reader sees the derivative itself.
export type ExpressionNode = (
  | { type: 'number'; value: number; text?: string; pos?: number }
  | { type: 'variable'; name: string; pos?: number }
  | { type: 'constant'; name: ExpressionConstant; pos?: number }
  | { type: 'negate'; operand: ExpressionNode; pos?: number }
  | {
      type: 'binary'
      op: '+' | '-' | '*' | '/' | '^'
      left: ExpressionNode
      right: ExpressionNode
      pos?: number
    }
  | {
      type: 'call'
      fn: ExpressionFunction
      arg: ExpressionNode
      /** sin, cos, tan whose argument is in degrees (calculator angle unit). */
      degrees?: true
      pos?: number
    }
  /** A call to a function the student defined, `order` times derived: f(…), f'(…), f''(…). */
  | { type: 'userCall'; name: string; order: number; arg: ExpressionNode; pos?: number }
) & { ddx?: ExpressionNode }

/** sqrt and abs always; the others in calculator mode only. `log` is the decimal logarithm. */
export type ExpressionFunction = 'sqrt' | 'abs' | 'sin' | 'cos' | 'tan' | 'exp' | 'ln' | 'log'

/** π, and e (Euler's number) in calculator mode. */
export type ExpressionConstant = 'π' | 'e'

/** The angle unit of sin, cos and tan (the calculator's own word for it, ADR 0049). */
export type ModeAngle = 'radians' | 'degres'

/** Longest line the calculator reads, in characters. */
export const CALCULATOR_MAX_LENGTH = 500

/** Deepest nesting the calculator reads (brackets, functions, signs, powers). */
export const CALCULATOR_MAX_DEPTH = 150

/** The message of both bounds; the language uses it for its own bounds too. */
export const TOO_LONG = 'Cette expression devient trop longue à calculer.'

/** The derivative operator of the calculator, recognised only as this exact prefix. */
const DDX = 'd/dx('

/** Steps a d/dx(…) may take (one per node derived) before it is refused as too long. */
const DDX_BUDGET = 50_000

/** f, g and h followed by a bracket are always function calls, as in a French textbook. */
const FUNCTION_LETTERS: ReadonlySet<string> = new Set(['f', 'g', 'h'])

/** The graphing-calculator syntax (ADR 0049). */
export type CalculatorSyntax = {
  /** The names of the functions the student defined: `f(…)` is a call, `f'(…)` a derivative. */
  functions?: readonly string[]
  /** The unit of the argument of sin, cos and tan. Default: radians. */
  angle?: ModeAngle
}

/** A message in French for the author, and the 0-based index of the character it is about. */
export type ExpressionError = { message: string; position: number }

export type Expression = {
  source: string
  tree: ExpressionNode
  /** The letters the expression uses, sorted (x and parameters; π is a constant). */
  variables: string[]
  /** The value for these values of the letters; NaN where the expression is not defined. */
  evaluate: (scope: Readonly<Record<string, number>>) => number
}

export type ParseResult =
  { ok: true; expression: Expression } | { ok: false; error: ExpressionError }

export type ParseOptions = {
  /** The letters allowed besides the constant π. Default: only x. Ignored in calculator mode. */
  variables?: readonly string[]
  /** Graphing-calculator syntax (ADR 0049). Absent: the ADR 0038 language, unchanged. */
  calculator?: CalculatorSyntax
}

type Token =
  | { kind: 'number'; value: number; pos: number; text: string }
  | { kind: 'name'; name: string; pos: number; primes: number }
  | { kind: 'pi'; pos: number }
  | { kind: 'constant'; name: ExpressionConstant; pos: number }
  | { kind: 'function'; fn: ExpressionFunction; pos: number; text: string }
  | { kind: 'op'; op: '+' | '-' | '*' | '/' | '^'; pos: number; text: string }
  | { kind: 'lparen'; pos: number }
  | { kind: 'rparen'; pos: number }
  | { kind: 'bar'; pos: number }
  | { kind: 'ddx'; pos: number }
  | { kind: 'end'; pos: number }

class ExpressionSyntaxError extends Error {
  readonly position: number
  constructor(message: string, position: number) {
    super(message)
    this.position = position
  }
}

const WORDS: ReadonlyArray<[string, (pos: number) => Token]> = [
  ['racine', (pos) => ({ kind: 'function', fn: 'sqrt', pos, text: 'racine' })],
  ['sqrt', (pos) => ({ kind: 'function', fn: 'sqrt', pos, text: 'sqrt' })],
  ['abs', (pos) => ({ kind: 'function', fn: 'abs', pos, text: 'abs' })],
  ['pi', (pos) => ({ kind: 'pi', pos })],
]

// Calculator mode only.
const SCIENTIFIC_WORDS: ReadonlyArray<[string, (pos: number) => Token]> = [
  ...WORDS,
  ['sin', (pos) => ({ kind: 'function', fn: 'sin', pos, text: 'sin' })],
  ['cos', (pos) => ({ kind: 'function', fn: 'cos', pos, text: 'cos' })],
  ['tan', (pos) => ({ kind: 'function', fn: 'tan', pos, text: 'tan' })],
  ['exp', (pos) => ({ kind: 'function', fn: 'exp', pos, text: 'exp' })],
  ['ln', (pos) => ({ kind: 'function', fn: 'ln', pos, text: 'ln' })],
  ['log', (pos) => ({ kind: 'function', fn: 'log', pos, text: 'log' })],
]

/**
 * Names a student may try that the calculator does not know. Without this list `arcsin(x)` would
 * read a·r·c·sin(x) and report the letter a; naming the function is clearer.
 */
const UNKNOWN_FUNCTIONS: ReadonlySet<string> = new Set([
  'arcsin',
  'arccos',
  'arctan',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'cot',
  'cotan',
  'sec',
  'csc',
  'floor',
  'ceil',
  'round',
  'max',
  'min',
  'sign',
  'sgn',
  'mod',
  'ent',
])

const PRIMES: ReadonlySet<string> = new Set(["'", '’', '′'])

const OPERATORS: Readonly<Record<string, '+' | '-' | '*' | '/' | '^'>> = {
  '+': '+',
  '-': '-',
  '−': '-', // − minus sign
  '–': '-', // – en dash, pasted from a word processor
  '*': '*',
  '×': '*', // ×
  '·': '*', // ·
  '⋅': '*', // ⋅
  '/': '/',
  '÷': '/', // ÷
  ':': '/',
  '^': '^',
}

const SUPERSCRIPTS: Readonly<Record<string, number>> = { '²': 2, '³': 3 }

/** Spaces that may group the digits of a number in calculator mode. */
const GROUP_SPACES: ReadonlySet<string> = new Set([' ', '\u00a0', '\u202f', '\u2009'])
const GROUP_SPACE_RE = /[ \u00a0\u202f\u2009]/g

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9'
}

function isLetter(c: string): boolean {
  return /^[a-zA-Z]$/.test(c)
}

/**
 * Calculator mode: a number written straight before `e` and an exponent (`1e-13`, `2e5`, `3E+2`)
 * is the computer notation for 1 × 10⁻¹³, which a student did not learn and which would read
 * 1·e − 13. It is refused, at the `e`, with the textbook writing. `2e`, `2e^x` and `2ex` stay
 * products. `start` and `end` bound the digits of the number.
 */
function refuseScientificNotation(source: string, start: number, end: number): void {
  const e = source[end]
  if (e !== 'e' && e !== 'E') return
  let i = end + 1
  const sign = source[i]
  const negative = sign === '-' || sign === '−'
  if (negative || sign === '+') i++
  if (!isDigit(source[i] ?? '')) return
  const digits = i
  while (isDigit(source[i] ?? '')) i++
  const exponent = source.slice(digits, i)
  const power = negative ? `10^(−${exponent})` : `10^${exponent}`
  throw new ExpressionSyntaxError(
    `L’écriture ${source.slice(start, i)} n’est pas permise : écris ${source.slice(start, end)} × ${power}.`,
    end
  )
}

function tokenize(source: string, calculator?: CalculatorSyntax): Token[] {
  const words = calculator ? SCIENTIFIC_WORDS : WORDS
  const userNames: ReadonlySet<string> = new Set(calculator?.functions ?? [])
  const tokens: Token[] = []
  let i = 0
  while (i < source.length) {
    const c = source[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (isDigit(c) || ((c === ',' || c === '.') && isDigit(source[i + 1] ?? ''))) {
      const start = i
      while (isDigit(source[i] ?? '')) i++
      // Calculator mode: digits grouped by three with a space (1 000, 12 345 678), as written in
      // French; normal, no-break, narrow no-break or thin space. A lone space elsewhere still
      // separates two numbers.
      if (calculator && i - start <= 3) {
        while (
          GROUP_SPACES.has(source[i] ?? '') &&
          /^\d{3}$/.test(source.slice(i + 1, i + 4)) &&
          !isDigit(source[i + 4] ?? '')
        ) {
          i += 4
        }
      }
      if ((source[i] === ',' || source[i] === '.') && isDigit(source[i + 1] ?? '')) {
        i++
        while (isDigit(source[i] ?? '')) i++
      } else if (source[i] === ',' || source[i] === '.') {
        throw new ExpressionSyntaxError(
          `La virgule de « ${source.slice(start, i + 1)} » doit être suivie de chiffres.`,
          i
        )
      }
      if ((source[i] === ',' || source[i] === '.') && isDigit(source[i + 1] ?? '')) {
        throw new ExpressionSyntaxError(
          'Un nombre ne peut avoir qu’une seule virgule. Pour séparer deux nombres, écris une opération.',
          i
        )
      }
      const text = source.slice(start, i).replace(GROUP_SPACE_RE, '')
      if (calculator) refuseScientificNotation(source, start, i)
      tokens.push({ kind: 'number', value: Number(text.replace(',', '.')), pos: start, text })
      continue
    }
    if (c === ',' || c === '.') {
      throw new ExpressionSyntaxError(`« ${c} » doit être suivi de chiffres (2,5 ou 0,5).`, i)
    }
    if (c === 'π') {
      tokens.push(calculator ? { kind: 'constant', name: 'π', pos: i } : { kind: 'pi', pos: i })
      i++
      continue
    }
    if (c === '√') {
      tokens.push({ kind: 'function', fn: 'sqrt', pos: i, text: '√' })
      i++
      continue
    }
    if (calculator && source.startsWith(DDX, i)) {
      // d/dx(: the opening bracket stays, the parser reads it as the operand.
      tokens.push({ kind: 'ddx', pos: i })
      i += DDX.length - 1
      continue
    }
    if (calculator && (c === '∛' || c === '∜')) {
      throw new ExpressionSyntaxError(
        'La calculatrice ne connaît que la racine carrée : pour une racine n-ième de a, écris a^(1/n).',
        i
      )
    }
    if (isLetter(c)) {
      if (calculator) {
        const run = /^[a-zA-Z]+/.exec(source.slice(i))?.[0] ?? c
        if (UNKNOWN_FUNCTIONS.has(run) && /^\s*\(/.test(source.slice(i + run.length))) {
          throw new ExpressionSyntaxError(`La calculatrice ne connaît pas la fonction ${run}.`, i)
        }
      }
      const word = words.find(([w]) => source.startsWith(w, i))
      if (word) {
        const token = word[1](i)
        tokens.push(
          calculator && token.kind === 'pi' ? { kind: 'constant', name: 'π', pos: i } : token
        )
        i += word[0].length
      } else if (calculator) {
        i = calculatorName(source, i, userNames, tokens)
      } else {
        // Letters are single: "ax" is a × x, as on paper.
        tokens.push({ kind: 'name', name: c, pos: i, primes: 0 })
        i++
      }
      continue
    }
    if (c in OPERATORS) {
      tokens.push({ kind: 'op', op: OPERATORS[c], pos: i, text: c })
      i++
      continue
    }
    if (c in SUPERSCRIPTS) {
      tokens.push({ kind: 'op', op: '^', pos: i, text: c })
      tokens.push({ kind: 'number', value: SUPERSCRIPTS[c], pos: i, text: c })
      i++
      continue
    }
    if (c === '(' || c === '[') {
      tokens.push({ kind: 'lparen', pos: i })
      i++
      continue
    }
    if (c === ')' || c === ']') {
      tokens.push({ kind: 'rparen', pos: i })
      i++
      continue
    }
    if (c === '|') {
      tokens.push({ kind: 'bar', pos: i })
      i++
      continue
    }
    if (c === '=') {
      throw new ExpressionSyntaxError(
        'Écris seulement l’expression, sans « f(x) = » ni « y = » : par exemple 2x + 1.',
        i
      )
    }
    throw new ExpressionSyntaxError(
      `Le caractère « ${c} » n’est pas permis dans une expression.`,
      i
    )
  }
  tokens.push({ kind: 'end', pos: source.length })
  return tokens
}

/**
 * Reads a letter in calculator mode, from `start`, and returns the index after it: `e` is Euler's
 * number; a defined function's name may end with a digit (f1) and take primes (f', f'').
 */
function calculatorName(
  source: string,
  start: number,
  userNames: ReadonlySet<string>,
  tokens: Token[]
): number {
  const letter = source[start]
  let i = start + 1
  let name = letter
  const digit = source[i] ?? ''
  if (isDigit(digit) && userNames.has(letter + digit)) {
    name = letter + digit
    i++
  }
  let primes = 0
  while (PRIMES.has(source[i] ?? '')) {
    primes++
    i++
  }
  if (name === 'e' && primes === 0) {
    tokens.push({ kind: 'constant', name: 'e', pos: start })
  } else {
    tokens.push({ kind: 'name', name, pos: start, primes })
  }
  return i
}

function describe(token: Token): string {
  switch (token.kind) {
    case 'number':
      return token.text
    case 'name':
      return token.name
    case 'pi':
      return 'π'
    case 'constant':
      return token.name
    case 'function':
      return token.text
    case 'op':
      return token.text
    case 'lparen':
      return '('
    case 'rparen':
      return ')'
    case 'bar':
      return '|'
    case 'ddx':
      return 'd/dx'
    case 'end':
      return ''
  }
}

class Parser {
  private index = 0
  /** Open |…| groups: inside one, a bar closes it instead of opening a new one. */
  private absDepth = 0
  /** Nesting of `primary` and `signed`, bounded in calculator mode. */
  private depth = 0

  private readonly tokens: Token[]
  private readonly allowed: ReadonlySet<string>
  private readonly calculator: CalculatorSyntax | undefined
  private readonly userNames: ReadonlySet<string>

  // No parameter properties: check-content loads this file with Node's type stripping.
  constructor(tokens: Token[], allowed: ReadonlySet<string>, calculator?: CalculatorSyntax) {
    this.tokens = tokens
    this.allowed = allowed
    this.calculator = calculator
    this.userNames = new Set(calculator?.functions ?? [])
  }

  /** Records where a node starts, in calculator mode only (ADR 0038 trees stay as they were). */
  private at<N extends ExpressionNode>(node: N, pos: number): N {
    if (this.calculator) node.pos = pos
    return node
  }

  parse(): ExpressionNode {
    if (this.peek().kind === 'end') throw new ExpressionSyntaxError('L’expression est vide.', 0)
    const node = this.sum()
    const next = this.peek()
    if (next.kind === 'rparen') {
      throw new ExpressionSyntaxError('Il y a une parenthèse fermante en trop.', next.pos)
    }
    if (next.kind !== 'end') {
      throw new ExpressionSyntaxError(`« ${describe(next)} » est mal placé ici.`, next.pos)
    }
    return node
  }

  private peek(): Token {
    return this.tokens[this.index]
  }

  private previous(): Token | undefined {
    return this.tokens[this.index - 1]
  }

  private advance(): Token {
    return this.tokens[this.index++]
  }

  private sum(): ExpressionNode {
    let left = this.product()
    for (;;) {
      const t = this.peek()
      if (t.kind !== 'op' || (t.op !== '+' && t.op !== '-')) return left
      this.advance()
      left = this.at({ type: 'binary', op: t.op, left, right: this.product() }, t.pos)
    }
  }

  private product(): ExpressionNode {
    let left = this.signed()
    for (;;) {
      const t = this.peek()
      if (t.kind === 'op' && (t.op === '*' || t.op === '/')) {
        this.advance()
        left = this.at({ type: 'binary', op: t.op, left, right: this.signed() }, t.pos)
      } else if (this.startsImplicitFactor(t)) {
        left = this.at({ type: 'binary', op: '*', left, right: this.power() }, t.pos)
      } else if (t.kind === 'number') {
        throw new ExpressionSyntaxError(
          `Le nombre ${t.text} suit « ${describe(this.previous() ?? t)} » sans opération : écris le nombre devant (2x et non x2), ou mets × entre les deux.`,
          t.pos
        )
      } else {
        return left
      }
    }
  }

  private startsImplicitFactor(t: Token): boolean {
    return (
      t.kind === 'name' ||
      t.kind === 'pi' ||
      t.kind === 'constant' ||
      t.kind === 'function' ||
      t.kind === 'ddx' ||
      t.kind === 'lparen' ||
      (t.kind === 'bar' && this.absDepth === 0)
    )
  }

  private signed(): ExpressionNode {
    const t = this.peek()
    if (t.kind === 'op' && (t.op === '-' || t.op === '+')) {
      this.advance()
      this.enter(t.pos)
      const operand = this.signed()
      this.depth--
      return t.op === '-' ? this.at({ type: 'negate', operand }, t.pos) : operand
    }
    return this.power()
  }

  /** One level deeper; in calculator mode, refused past CALCULATOR_MAX_DEPTH. */
  private enter(pos: number): void {
    if (++this.depth > CALCULATOR_MAX_DEPTH && this.calculator) {
      throw new ExpressionSyntaxError(TOO_LONG, pos)
    }
  }

  private power(): ExpressionNode {
    const base = this.primary()
    const t = this.peek()
    if (t.kind === 'op' && t.op === '^') {
      this.advance()
      return this.at({ type: 'binary', op: '^', left: base, right: this.signed() }, t.pos)
    }
    return base
  }

  private primary(): ExpressionNode {
    this.enter(this.peek().pos)
    const node = this.primaryAt(this.advance())
    this.depth--
    return node
  }

  private primaryAt(t: Token): ExpressionNode {
    switch (t.kind) {
      case 'number': {
        const node: ExpressionNode = { type: 'number', value: t.value }
        // The text keeps every digit: 12345678901234567 is not the double it rounds to.
        if (this.calculator && /^[\d.,]+$/.test(t.text)) node.text = t.text
        return this.at(node, t.pos)
      }
      case 'pi':
        return { type: 'number', value: Math.PI }
      case 'constant':
        return this.at({ type: 'constant', name: t.name }, t.pos)
      case 'name':
        if (this.calculator) return this.calculatorName(t)
        if (!this.allowed.has(t.name))
          throw new ExpressionSyntaxError(this.unknownLetter(t.name), t.pos)
        return { type: 'variable', name: t.name }
      case 'function': {
        if (t.text !== '√' && this.peek().kind !== 'lparen' && this.peek().kind !== 'bar') {
          throw new ExpressionSyntaxError(
            `Après ${t.text}, mets la quantité entre parenthèses : ${t.text}(x).`,
            this.peek().pos
          )
        }
        const node: ExpressionNode = { type: 'call', fn: t.fn, arg: this.primary() }
        if (this.calculator?.angle === 'degres' && isTrigonometric(t.fn)) node.degrees = true
        return this.at(node, t.pos)
      }
      case 'lparen': {
        if (this.peek().kind === 'rparen') {
          throw new ExpressionSyntaxError('Les parenthèses sont vides.', this.peek().pos)
        }
        const saved = this.absDepth
        this.absDepth = 0
        const inner = this.sum()
        this.absDepth = saved
        const close = this.peek()
        if (close.kind !== 'rparen') {
          throw new ExpressionSyntaxError(
            'Il manque une parenthèse fermante pour la parenthèse ouverte ici.',
            t.pos
          )
        }
        this.advance()
        return inner
      }
      case 'ddx': {
        // The operand is the bracket that follows: d/dx(x² sin(x)), d/dx(d/dx(x³)).
        const operand = this.primary()
        let derivee: ExpressionNode
        try {
          derivee = deriver(operand, 'x', { reste: DDX_BUDGET })
        } catch (e) {
          if (e instanceof DeriveeTropLongue) throw new ExpressionSyntaxError(TOO_LONG, t.pos)
          throw e
        }
        // A copy: the derivative may share its root with the operand or a constant node.
        return this.at({ ...derivee, ddx: operand }, t.pos)
      }
      case 'bar': {
        this.absDepth++
        const inner = this.sum()
        this.absDepth--
        const close = this.peek()
        if (close.kind !== 'bar') {
          throw new ExpressionSyntaxError(
            'Il manque la barre | qui ferme la valeur absolue.',
            t.pos
          )
        }
        this.advance()
        return this.at({ type: 'call', fn: 'abs', arg: inner }, t.pos)
      }
      case 'end': {
        // `t` is consumed: the token before it is two places back.
        const before = this.tokens[this.index - 2]
        throw new ExpressionSyntaxError(
          before && before.kind !== 'end'
            ? `L’expression s’arrête après « ${describe(before)} » : il manque un nombre ou x.`
            : 'L’expression est vide.',
          t.pos
        )
      }
      case 'rparen':
        throw new ExpressionSyntaxError(
          this.tokens[this.index - 2]?.kind === 'lparen'
            ? 'Les parenthèses sont vides.'
            : 'Parenthèse fermante mal placée : il manque un nombre ou x avant elle.',
          t.pos
        )
      case 'op':
        throw new ExpressionSyntaxError(
          `« ${t.text} » ne peut pas venir ici : il manque un nombre ou x avant lui.`,
          t.pos
        )
    }
  }

  /** A letter in calculator mode: a call to a defined function, or a variable for the caller. */
  private calculatorName(t: Extract<Token, { kind: 'name' }>): ExpressionNode {
    if (this.userNames.has(t.name)) {
      if (this.peek().kind !== 'lparen') {
        throw new ExpressionSyntaxError(
          `${t.name} est une fonction\u00a0: écris ${t.name}(x), avec la parenthèse.`,
          t.pos
        )
      }
      return this.at(
        { type: 'userCall', name: t.name, order: t.primes, arg: this.primary() },
        t.pos
      )
    }
    if (t.primes > 0) {
      throw new ExpressionSyntaxError(
        `Je ne connais pas la fonction ${t.name}, donc je ne peux pas calculer ${t.name}’(x). Définis d’abord ${t.name}.`,
        t.pos
      )
    }
    if (FUNCTION_LETTERS.has(t.name) && this.peek().kind === 'lparen') {
      throw new ExpressionSyntaxError(
        `Je ne connais pas la fonction ${t.name}. Définis-la d’abord, par exemple ${t.name}(x) = x².`,
        t.pos
      )
    }
    return this.at({ type: 'variable', name: t.name }, t.pos)
  }

  private unknownLetter(name: string): string {
    const others = [...this.allowed].filter((v) => v !== 'x').sort()
    const known =
      others.length === 0
        ? 'la seule lettre permise est x'
        : `les lettres permises sont x et ${others.join(', ')}`
    return `La lettre « ${name} » n’est pas connue : ${known}.`
  }
}

type Compiled = (scope: Readonly<Record<string, number>>) => number

export function isTrigonometric(fn: ExpressionFunction): boolean {
  return fn === 'sin' || fn === 'cos' || fn === 'tan'
}

/** One degree in radians: sin, cos and tan in degrees take their argument times this. */
export const DEGREE = Math.PI / 180

/**
 * tan in radians, not defined where cos is 0 to the precision of a double: Math.tan(π/2) is
 * 1,6·10¹⁶, which a student would read as a value.
 */
function tangent(v: number): number {
  return Math.abs(Math.cos(v)) < 1e-12 ? NaN : Math.tan(v)
}

const SIN_QUARTERS = [0, 1, 0, -1]
const COS_QUARTERS = [1, 0, -1, 0]
const TAN_QUARTERS = [0, NaN, 0, NaN]

/**
 * sin, cos or tan of an angle in degrees, reduced modulo 360 first (exact for a double): every
 * multiple of 90° gives exactly 0, 1 or −1, and tan is not defined at 90° modulo 180°.
 */
function trigInDegrees(fn: 'sin' | 'cos' | 'tan', degrees: number): number {
  const r = ((degrees % 360) + 360) % 360
  if (r % 90 === 0) {
    const q = r / 90
    return (fn === 'sin' ? SIN_QUARTERS : fn === 'cos' ? COS_QUARTERS : TAN_QUARTERS)[q]
  }
  const rad = r * DEGREE
  return fn === 'sin' ? Math.sin(rad) : fn === 'cos' ? Math.cos(rad) : tangent(rad)
}

/** A built-in function applied to v, in degrees when asked (sin, cos, tan only). */
export function applyBuiltin(fn: ExpressionFunction, v: number, degrees?: boolean): number {
  if (degrees && (fn === 'sin' || fn === 'cos' || fn === 'tan')) return trigInDegrees(fn, v)
  return mathOf(fn)(v)
}

/** The JavaScript function computing a built-in function; sin, cos, tan take radians here. */
export function mathOf(fn: ExpressionFunction): (v: number) => number {
  switch (fn) {
    case 'sqrt':
      return Math.sqrt
    case 'abs':
      return Math.abs
    case 'sin':
      return Math.sin
    case 'cos':
      return Math.cos
    case 'tan':
      return tangent
    case 'exp':
      return Math.exp
    case 'ln':
      return Math.log
    case 'log':
      return Math.log10
  }
}

/** The value of a constant node. */
export function constantValue(name: ExpressionConstant): number {
  return name === 'π' ? Math.PI : Math.E
}

function compile(node: ExpressionNode): Compiled {
  switch (node.type) {
    case 'number': {
      const v = node.value
      return () => v
    }
    case 'variable': {
      const name = node.name
      return (scope) => scope[name] ?? NaN
    }
    case 'negate': {
      const operand = compile(node.operand)
      return (scope) => -operand(scope)
    }
    case 'constant': {
      const v = constantValue(node.name)
      return () => v
    }
    case 'call': {
      const arg = compile(node.arg)
      const fn = node.fn
      if (node.degrees) return (scope) => applyBuiltin(fn, arg(scope), true)
      const math = mathOf(fn)
      return (scope) => math(arg(scope))
    }
    // The tree does not hold the definition of f: whoever resolves user calls compiles them
    // (ADR 0049, grapheur/langage.ts). Read alone, a call is not defined.
    case 'userCall':
      return () => NaN
    case 'binary': {
      const left = compile(node.left)
      const right = compile(node.right)
      switch (node.op) {
        case '+':
          return (scope) => left(scope) + right(scope)
        case '-':
          return (scope) => left(scope) - right(scope)
        case '*':
          return (scope) => left(scope) * right(scope)
        case '/':
          return (scope) => left(scope) / right(scope)
        case '^':
          return (scope) => Math.pow(left(scope), right(scope))
      }
    }
  }
}

function collectVariables(node: ExpressionNode, into: Set<string>): Set<string> {
  switch (node.type) {
    case 'variable':
      into.add(node.name)
      break
    case 'negate':
      collectVariables(node.operand, into)
      break
    case 'call':
    case 'userCall':
      collectVariables(node.arg, into)
      break
    case 'binary':
      collectVariables(node.left, into)
      collectVariables(node.right, into)
      break
    case 'number':
    case 'constant':
      break
  }
  return into
}

/**
 * Reads an expression. Never throws: a mistake comes back as a French message with the position
 * of the faulty character, ready for the editor and check-content.
 */
export function parseExpression(source: string, options: ParseOptions = {}): ParseResult {
  const allowed = new Set(options.variables ?? ['x'])
  try {
    if (options.calculator && source.length > CALCULATOR_MAX_LENGTH) {
      throw new ExpressionSyntaxError(TOO_LONG, CALCULATOR_MAX_LENGTH)
    }
    const tree = new Parser(
      tokenize(source, options.calculator),
      allowed,
      options.calculator
    ).parse()
    const run = compile(tree)
    return {
      ok: true,
      expression: {
        source,
        tree,
        variables: [...collectVariables(tree, new Set())].sort(),
        // Infinity (1/0) is "not defined" too: no curve point can be drawn there.
        evaluate: (scope) => {
          const v = run(scope)
          return Number.isFinite(v) ? v : NaN
        },
      },
    }
  } catch (e) {
    if (e instanceof ExpressionSyntaxError) {
      const message = options.calculator ? frenchSpacing(e.message) : e.message
      return { ok: false, error: { message, position: e.position } }
    }
    throw e
  }
}

/**
 * French typography for the messages students read in the calculator: a non-breaking space
 * before : ; ? ! and inside « ». The ADR 0038 messages keep their spaces (authors' tools and
 * their tests read them as they are).
 */
function frenchSpacing(message: string): string {
  return message
    .replace(/ ([:;?!])/g, '\u00a0$1')
    .replace(/« /g, '«\u00a0')
    .replace(/ »/g, '\u00a0»')
}
