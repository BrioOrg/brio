import { describe, expect, it } from 'vitest'

import { parseExpression, type ModeAngle, type ExpressionNode } from '../../expression'
import { compilerX } from '../compilation'
import { dependsOn, deriver, minus, negate, over, plus, power, simplifier, times } from '../derivee'

function tree(source: string, angle: ModeAngle = 'radians'): ExpressionNode {
  const r = parseExpression(source, { calculator: { angle, functions: ['f'] } })
  if (!r.ok) throw new Error(`${source}: ${r.error.message}`)
  return r.expression.tree
}

/** The tree without the `pos` of its nodes, to compare shapes. */
function shape(node: ExpressionNode): unknown {
  return JSON.parse(
    JSON.stringify(node, (k, v: unknown) => (k === 'pos' || k === 'text' ? undefined : v))
  )
}

function numericDerivative(f: (x: number) => number, x: number): number {
  const h = 1e-5 * Math.max(1, Math.abs(x))
  return (f(x + h) - f(x - h)) / (2 * h)
}

const n = (value: number): ExpressionNode => ({ type: 'number', value })
const x: ExpressionNode = { type: 'variable', name: 'x' }
const a: ExpressionNode = { type: 'variable', name: 'a' }

describe('deriver — against the centred difference quotient', () => {
  const cases: Array<[string, number[], ModeAngle?]> = [
    ['3', [-1, 0, 2]],
    ['x', [-1, 0, 2]],
    ['2x + 1', [-1, 0, 2]],
    ['x² − 3x + 2', [-2, 0.5, 3]],
    ['x³ − x', [-2, 0.5, 3]],
    ['4x⁵'.replace('⁵', '^5'), [-1, 0.5, 1.2]],
    ['(x − 1)(x + 2)', [-2, 0, 1.5]],
    ['1/x', [-2, 0.5, 3]],
    ['(x + 1)/(x − 1)', [-2, 0.5, 3]],
    ['(x² + 1)/(x² + 2x + 3)', [-2, 0, 1.7]],
    ['(2x + 1)^3', [-1, 0, 0.8]],
    ['x^(−2)', [-2, 0.5, 3]],
    ['√x', [0.3, 1, 4]],
    ['√(x² + 1)', [-2, 0, 3]],
    ['1/√x', [0.5, 2]],
    ['|x|', [-2, -0.5, 0.5, 3]],
    ['|x² − 4|', [-3, -1, 1, 3]],
    ['sin(x)', [-1, 0, 2]],
    ['cos(3x)', [-1, 0, 2]],
    ['tan(x)', [-1, 0, 0.7]],
    ['sin(x)cos(x)', [-1, 0.3, 2]],
    ['sin(x²)', [-1, 0.3, 1.5]],
    ['sin(x)', [0, 45, 90, 200], 'degres'],
    ['cos(2x)', [0, 30, 100], 'degres'],
    ['tan(x)', [0, 30, 60], 'degres'],
    ['exp(x)', [-1, 0, 2]],
    ['e^(−x²)', [-1, 0, 0.5]],
    ['e^x', [-1, 0, 2]],
    ['2^x', [-1, 0, 2]],
    ['x e^x', [-1, 0, 2]],
    ['ln(x)', [0.5, 1, 3]],
    ['ln(x² + 1)', [-2, 0, 3]],
    ['log(x)', [0.5, 1, 30]],
    ['x^x', [0.5, 1, 2]],
    ['(x² + 1)^(sin(x))', [-1, 0.4, 2]],
    ['x ln(x) − x', [0.5, 1, 3]],
    ['sin(cos(x))', [-1, 0.2, 2]],
    ['√(sin(x) + 2)', [-1, 0, 2]],
    ['π x²', [-1, 1]],
    ['−x³', [-1, 2]],
  ]

  it.each(cases)('d/dx %s', (source, points, angle = 'radians') => {
    const t = tree(source, angle)
    const f = compilerX(t)
    const df = compilerX(deriver(t))
    for (const p of points) {
      const expected = numericDerivative(f, p)
      expect(Math.abs(df(p) - expected)).toBeLessThan(1e-5 * Math.max(1, Math.abs(expected)))
    }
  })

  it('should have at least twenty functions in the sample', () => {
    expect(cases.length).toBeGreaterThanOrEqual(20)
  })

  it('should leave |x|′ undefined at 0', () => {
    expect(compilerX(deriver(tree('|x|')))(0)).toBeNaN()
  })

  it('should take the factor π/180 in degrees', () => {
    const d = compilerX(deriver(tree('sin(x)', 'degres')))
    expect(d(0)).toBeCloseTo(Math.PI / 180, 14)
    expect(d(90)).toBeCloseTo(0, 14)
    expect(compilerX(deriver(tree('sin(x)')))(0)).toBe(1)
  })

  it('should derive twice', () => {
    const d2 = compilerX(deriver(deriver(tree('x³'))))
    expect(d2(2)).toBe(12)
    const s2 = compilerX(deriver(deriver(tree('sin(x)'))))
    expect(s2(1)).toBeCloseTo(-Math.sin(1), 12)
  })
})

describe('deriver — other letters and calls', () => {
  it('should treat other letters as constants', () => {
    const d = deriver(tree('ax² + b'))
    expect(compilerX(d, new Map([['a', 3]]))(2)).toBe(12)
    expect(deriver(tree('a + y'))).toEqual(n(0))
  })

  it('should derive with respect to another variable', () => {
    expect(compilerX(deriver(tree('x a²'), 'a'), new Map([['a', 5]]))(2)).toBe(20)
  })

  it("should apply the chain rule to a call: f(2x)' = f'(2x)·2", () => {
    expect(shape(deriver(tree('f(2x)')))).toEqual({
      type: 'binary',
      op: '*',
      left: n(2),
      right: {
        type: 'userCall',
        name: 'f',
        order: 1,
        arg: { type: 'binary', op: '*', left: n(2), right: x },
      },
    })
    expect(deriver(tree("f'(x)"))).toMatchObject({ type: 'userCall', order: 2 })
  })
})

describe('simplifier', () => {
  it('should keep the trees small', () => {
    expect(shape(deriver(tree('x²')))).toEqual(times(n(2), x))
    expect(deriver(tree('3x + 1'))).toEqual(n(3))
    expect(deriver(tree('x'))).toEqual(n(1))
    expect(deriver(tree('5'))).toEqual(n(0))
    expect(shape(deriver(tree('e^x')))).toEqual({
      type: 'binary',
      op: '^',
      left: { type: 'constant', name: 'e' },
      right: x,
    })
  })

  it.each<[string, ExpressionNode, ExpressionNode]>([
    ['0 + x', plus(n(0), x), x],
    ['x + 0', plus(x, n(0)), x],
    ['2 + 3', plus(n(2), n(3)), n(5)],
    ['x + −a', plus(x, negate(a)), { type: 'binary', op: '-', left: x, right: a }],
    ['x − 0', minus(x, n(0)), x],
    ['0 − x', minus(n(0), x), { type: 'negate', operand: x }],
    ['5 − 3', minus(n(5), n(3)), n(2)],
    ['x − −a', minus(x, negate(a)), { type: 'binary', op: '+', left: x, right: a }],
    ['0x', times(n(0), x), n(0)],
    ['x·0', times(x, n(0)), n(0)],
    ['1x', times(n(1), x), x],
    ['x·1', times(x, n(1)), x],
    ['−1·x', times(n(-1), x), { type: 'negate', operand: x }],
    ['x·−1', times(x, n(-1)), { type: 'negate', operand: x }],
    ['x·2', times(x, n(2)), { type: 'binary', op: '*', left: n(2), right: x }],
    ['2·(3x)', times(n(2), times(n(3), x)), { type: 'binary', op: '*', left: n(6), right: x }],
    ['2·3', times(n(2), n(3)), n(6)],
    ['(−x)·a', times(negate(x), a), negate(times(x, a))],
    ['x·(−a)', times(x, negate(a)), negate(times(x, a))],
    ['x/1', over(x, n(1)), x],
    ['6/3', over(n(6), n(3)), n(2)],
    ['1/3 stays', over(n(1), n(3)), { type: 'binary', op: '/', left: n(1), right: n(3) }],
    ['1/0 stays', over(n(1), n(0)), { type: 'binary', op: '/', left: n(1), right: n(0) }],
    ['x^1', power(x, n(1)), x],
    ['x^0', power(x, n(0)), n(1)],
    ['2^3', power(n(2), n(3)), n(8)],
    ['2^−1 stays', power(n(2), n(-1)), { type: 'binary', op: '^', left: n(2), right: n(-1) }],
    ['−(3)', negate(n(3)), n(-3)],
    ['−(−x)', negate(negate(x)), x],
    ['0,1 + 0,2', plus(n(0.1), n(0.2)), n(0.1 + 0.2)],
    [
      '1e308 · 10 stays',
      times(n(1e308), n(10)),
      { type: 'binary', op: '*', left: n(1e308), right: n(10) },
    ],
  ])('%s', (_label, actual, expected) => {
    expect(actual).toEqual(expected)
  })

  it('should fold a call only into a whole number', () => {
    expect(simplifier(tree('√4'))).toEqual(n(2))
    expect(simplifier(tree('cos(0)'))).toEqual(n(1))
    // And the values: folding never changes what the tree computes.
    for (const source of ['√4', 'cos(0)', '√2', 'ln(e)', 'ln(π)', '2 + 3x', '0x + 1']) {
      const before = compilerX(tree(source))
      const after = compilerX(simplifier(tree(source)))
      for (const x of [-1, 0.5, 2]) expect(after(x)).toBeCloseTo(before(x), 14)
    }
    expect(simplifier(tree('√2'))).toMatchObject({ type: 'call', fn: 'sqrt' })
    expect(simplifier(tree('sin(90)', 'degres'))).toEqual(n(1))
    expect(simplifier(tree('ln(e)'))).toEqual(n(1))
    expect(simplifier(tree('ln(π)'))).toMatchObject({ type: 'call', fn: 'ln' })
    expect(simplifier(tree('sin(x)', 'degres'))).toMatchObject({ degrees: true })
    expect(simplifier(tree('f(2 + 1)'))).toEqual({
      type: 'userCall',
      name: 'f',
      order: 0,
      arg: n(3),
    })
  })
})

describe('dependsOn', () => {
  it('should follow every kind of node', () => {
    expect(dependsOn(tree('2 + sin(f(−x))'), 'x')).toBe(true)
    expect(dependsOn(tree('2^x'), 'x')).toBe(true)
    expect(dependsOn(tree('x^2'), 'x')).toBe(true)
    expect(dependsOn(tree('2 + sin(f(−a)) + π'), 'x')).toBe(false)
  })
})
