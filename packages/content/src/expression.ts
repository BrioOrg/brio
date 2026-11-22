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

export type ExpressionNode =
  | { type: 'number'; value: number }
  | { type: 'variable'; name: string }
  | { type: 'negate'; operand: ExpressionNode }
  | { type: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: ExpressionNode; right: ExpressionNode }
  | { type: 'call'; fn: ExpressionFunction; arg: ExpressionNode }

export type ExpressionFunction = 'sqrt' | 'abs'

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
  /** The letters allowed besides the constant π. Default: only x. */
  variables?: readonly string[]
}

type Token =
  | { kind: 'number'; value: number; pos: number; text: string }
  | { kind: 'name'; name: string; pos: number }
  | { kind: 'pi'; pos: number }
  | { kind: 'function'; fn: ExpressionFunction; pos: number; text: string }
  | { kind: 'op'; op: '+' | '-' | '*' | '/' | '^'; pos: number; text: string }
  | { kind: 'lparen'; pos: number }
  | { kind: 'rparen'; pos: number }
  | { kind: 'bar'; pos: number }
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

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9'
}

function isLetter(c: string): boolean {
  return /^[a-zA-Z]$/.test(c)
}

function tokenize(source: string): Token[] {
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
      const text = source.slice(start, i)
      tokens.push({ kind: 'number', value: Number(text.replace(',', '.')), pos: start, text })
      continue
    }
    if (c === ',' || c === '.') {
      throw new ExpressionSyntaxError(`« ${c} » doit être suivi de chiffres (2,5 ou 0,5).`, i)
    }
    if (c === 'π') {
      tokens.push({ kind: 'pi', pos: i })
      i++
      continue
    }
    if (c === '√') {
      tokens.push({ kind: 'function', fn: 'sqrt', pos: i, text: '√' })
      i++
      continue
    }
    if (isLetter(c)) {
      const word = WORDS.find(([w]) => source.startsWith(w, i))
      if (word) {
        tokens.push(word[1](i))
        i += word[0].length
      } else {
        // Letters are single: "ax" is a × x, as on paper.
        tokens.push({ kind: 'name', name: c, pos: i })
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

function describe(token: Token): string {
  switch (token.kind) {
    case 'number':
      return token.text
    case 'name':
      return token.name
    case 'pi':
      return 'π'
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
    case 'end':
      return ''
  }
}

class Parser {
  private index = 0
  /** Open |…| groups: inside one, a bar closes it instead of opening a new one. */
  private absDepth = 0

  private readonly tokens: Token[]
  private readonly allowed: ReadonlySet<string>

  // No parameter properties: check-content loads this file with Node's type stripping.
  constructor(tokens: Token[], allowed: ReadonlySet<string>) {
    this.tokens = tokens
    this.allowed = allowed
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
      left = { type: 'binary', op: t.op, left, right: this.product() }
    }
  }

  private product(): ExpressionNode {
    let left = this.signed()
    for (;;) {
      const t = this.peek()
      if (t.kind === 'op' && (t.op === '*' || t.op === '/')) {
        this.advance()
        left = { type: 'binary', op: t.op, left, right: this.signed() }
      } else if (this.startsImplicitFactor(t)) {
        left = { type: 'binary', op: '*', left, right: this.power() }
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
      t.kind === 'function' ||
      t.kind === 'lparen' ||
      (t.kind === 'bar' && this.absDepth === 0)
    )
  }

  private signed(): ExpressionNode {
    const t = this.peek()
    if (t.kind === 'op' && (t.op === '-' || t.op === '+')) {
      this.advance()
      const operand = this.signed()
      return t.op === '-' ? { type: 'negate', operand } : operand
    }
    return this.power()
  }

  private power(): ExpressionNode {
    const base = this.primary()
    const t = this.peek()
    if (t.kind === 'op' && t.op === '^') {
      this.advance()
      return { type: 'binary', op: '^', left: base, right: this.signed() }
    }
    return base
  }

  private primary(): ExpressionNode {
    const t = this.advance()
    switch (t.kind) {
      case 'number':
        return { type: 'number', value: t.value }
      case 'pi':
        return { type: 'number', value: Math.PI }
      case 'name':
        if (!this.allowed.has(t.name))
          throw new ExpressionSyntaxError(this.unknownLetter(t.name), t.pos)
        return { type: 'variable', name: t.name }
      case 'function': {
        if (t.text === '√') return { type: 'call', fn: t.fn, arg: this.primary() }
        if (this.peek().kind !== 'lparen' && this.peek().kind !== 'bar') {
          throw new ExpressionSyntaxError(
            `Après ${t.text}, mets la quantité entre parenthèses : ${t.text}(x).`,
            this.peek().pos
          )
        }
        return { type: 'call', fn: t.fn, arg: this.primary() }
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
        return { type: 'call', fn: 'abs', arg: inner }
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
    case 'call': {
      const arg = compile(node.arg)
      return node.fn === 'sqrt' ? (scope) => Math.sqrt(arg(scope)) : (scope) => Math.abs(arg(scope))
    }
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
      collectVariables(node.arg, into)
      break
    case 'binary':
      collectVariables(node.left, into)
      collectVariables(node.right, into)
      break
    case 'number':
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
    const tree = new Parser(tokenize(source), allowed).parse()
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
      return { ok: false, error: { message: e.message, position: e.position } }
    }
    throw e
  }
}
