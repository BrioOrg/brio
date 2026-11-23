import { describe, expect, it } from 'vitest'

import { parseExpression, type CalculatorSyntax, type ExpressionNode } from '../expression'

function tree(source: string, calculator: CalculatorSyntax = {}): ExpressionNode {
  const r = parseExpression(source, { calculator })
  if (!r.ok) throw new Error(`${source}: ${r.error.message}`)
  return r.expression.tree
}

function value(
  source: string,
  scope: Record<string, number> = {},
  calculator: CalculatorSyntax = {}
): number {
  const r = parseExpression(source, { calculator })
  if (!r.ok) throw new Error(`${source}: ${r.error.message}`)
  return r.expression.evaluate(scope)
}

function error(source: string, calculator: CalculatorSyntax = {}) {
  const r = parseExpression(source, { calculator })
  if (r.ok) throw new Error(`${source} should not parse`)
  return r.error
}

describe('parseExpression — without the calculator option (ADR 0038 unchanged)', () => {
  it('should still read sin as the letters s, i, n', () => {
    const r = parseExpression('sin(x)')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error.message).toBe(
      'La lettre « s » n’est pas connue : la seule lettre permise est x.'
    )
  })

  it('should still refuse e, a prime and an unknown letter', () => {
    expect(parseExpression('e').ok).toBe(false)
    expect(parseExpression("x'").ok).toBe(false)
    expect(parseExpression('arcsin(x)').ok).toBe(false)
  })

  it('should still read π as a number and set no position', () => {
    const r = parseExpression('2π + x')
    expect(r.ok && r.expression.tree).toStrictEqual({
      type: 'binary',
      op: '+',
      left: {
        type: 'binary',
        op: '*',
        left: { type: 'number', value: 2 },
        right: { type: 'number', value: Math.PI },
      },
      right: { type: 'variable', name: 'x' },
    })
  })

  it('should keep its message for "="', () => {
    const r = parseExpression('y = 2x')
    expect(!r.ok && r.error.message).toMatch(/sans « f\(x\) = » ni « y = »/)
  })
})

describe('parseExpression — calculator functions', () => {
  it.each([
    ['sin(0)', 0],
    ['cos(0)', 1],
    ['tan(0)', 0],
    ['exp(0)', 1],
    ['exp(1)', Math.E],
    ['ln(1)', 0],
    ['ln(e)', 1],
    ['log(1000)', 3],
    ['log(0,01)', -2],
    ['sqrt(16)', 4],
    ['racine(9)', 3],
    ['√4', 2],
    ['abs(−3)', 3],
    ['|−2|', 2],
    ['sin(π/2)', 1],
    ['cos(pi)', -1],
    ['e^2', Math.E ** 2],
    ['2e', 2 * Math.E],
  ])('should compute %s', (source, expected) => {
    expect(value(source)).toBeCloseTo(expected, 12)
  })

  it('should read e^x and exp(x) alike', () => {
    for (const x of [-2, -0.5, 0, 1, 3.3]) {
      expect(value('e^x', { x })).toBeCloseTo(value('exp(x)', { x }), 12)
    }
  })

  it('should read sin, cos and tan in degrees when asked', () => {
    const deg = { angle: 'degres' } as const
    expect(value('sin(90)', {}, deg)).toBeCloseTo(1, 12)
    expect(value('cos(180)', {}, deg)).toBeCloseTo(-1, 12)
    expect(value('tan(45)', {}, deg)).toBeCloseTo(1, 12)
    // Not the other functions.
    expect(value('exp(1)', {}, deg)).toBeCloseTo(Math.E, 12)
    expect(value('sqrt(4)', {}, deg)).toBe(2)
    expect(tree('sin(x)', deg)).toMatchObject({ type: 'call', fn: 'sin', degrees: true })
    expect(tree('ln(x)', deg)).not.toHaveProperty('degrees')
    expect(tree('sin(x)')).not.toHaveProperty('degrees')
  })

  it('should keep π and e as constant nodes', () => {
    expect(tree('π')).toMatchObject({ type: 'constant', name: 'π' })
    expect(tree('pi')).toMatchObject({ type: 'constant', name: 'π' })
    expect(tree('e')).toMatchObject({ type: 'constant', name: 'e' })
  })

  it('should ask for brackets after a function name', () => {
    // In calculator mode the ADR 0038 messages take French spacing (no-break space before :).
    expect(error('sin x').message).toBe(
      'Après sin, mets la quantité entre parenthèses\u00a0: sin(x).'
    )
    expect(error('sin x').position).toBe(4)
  })

  it('should name a function it does not know', () => {
    const e = error('2 + arcsin(x)')
    expect(e.message).toBe('La calculatrice ne connaît pas la fonction arcsin.')
    expect(e.position).toBe(4)
    // A known word not followed by a bracket is read as letters.
    expect(tree('max')).toMatchObject({ type: 'binary', op: '*' })
  })
})

describe('parseExpression — calculator letters', () => {
  it('should accept every single letter as a variable', () => {
    expect(value('ax + b', { a: 2, x: 3, b: 1 })).toBe(7)
    expect(value('x² + y²', { x: 3, y: 4 })).toBe(25)
    const r = parseExpression('kt + Q', { calculator: {} })
    expect(r.ok && r.expression.variables).toEqual(['Q', 'k', 't'])
  })

  it('should record the position of every node', () => {
    expect(tree('2 + ax')).toStrictEqual({
      type: 'binary',
      op: '+',
      pos: 2,
      left: { type: 'number', value: 2, text: '2', pos: 0 },
      right: {
        type: 'binary',
        op: '*',
        pos: 5,
        left: { type: 'variable', name: 'a', pos: 4 },
        right: { type: 'variable', name: 'x', pos: 5 },
      },
    })
    expect(tree('−x').pos).toBe(0)
    expect(tree('x^2').pos).toBe(1)
    expect(tree('  sin(x)').pos).toBe(2)
    expect(tree('|x|').pos).toBe(0)
    expect(tree('3/x').pos).toBe(1)
    expect(tree(' π').pos).toBe(1)
  })
})

describe('parseExpression — calls to the functions of the student', () => {
  const fg = { functions: ['f', 'g', 'h1'] }

  it('should read f(…) as a call, with derivatives', () => {
    expect(tree('f(x − 1)', fg)).toMatchObject({ type: 'userCall', name: 'f', order: 0, pos: 0 })
    expect(tree("f'(x)", fg)).toMatchObject({ type: 'userCall', name: 'f', order: 1 })
    expect(tree("g''(2)", fg)).toMatchObject({ type: 'userCall', name: 'g', order: 2 })
    expect(tree('f’(x)', fg)).toMatchObject({ type: 'userCall', order: 1 })
    expect(tree('f′′(x)', fg)).toMatchObject({ type: 'userCall', order: 2 })
    expect(tree('h1(x)', fg)).toMatchObject({ type: 'userCall', name: 'h1' })
    expect(tree('2f(x)g(x)', fg)).toMatchObject({ type: 'binary', op: '*' })
  })

  it('should read a letter that is not a function as a product', () => {
    expect(tree('a(x + 1)', fg)).toMatchObject({
      type: 'binary',
      op: '*',
      left: { type: 'variable', name: 'a' },
    })
    expect(() => tree('h2', fg)).toThrow(/2x et non x2/)
  })

  it('should evaluate a call alone as not defined', () => {
    expect(value('f(2)', {}, fg)).toBeNaN()
  })

  it('should list the letters inside a call', () => {
    const r = parseExpression('f(ax)', { calculator: fg })
    expect(r.ok && r.expression.variables).toEqual(['a', 'x'])
  })

  it('should refuse a function name without brackets', () => {
    const e = error('2 + f', fg)
    expect(e.message).toBe('f est une fonction : écris f(x), avec la parenthèse.')
    expect(e.position).toBe(4)
  })

  it('should refuse the derivative of a function that is not defined', () => {
    const e = error("1 + k'(x)", fg)
    expect(e.message).toBe(
      'Je ne connais pas la fonction k, donc je ne peux pas calculer k’(x). Définis d’abord k.'
    )
    expect(e.position).toBe(4)
    expect(error("e'(x)").message).toMatch(/la fonction e,/)
  })
})
