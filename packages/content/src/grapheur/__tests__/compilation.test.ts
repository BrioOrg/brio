import { describe, expect, it } from 'vitest'

import { parseExpression, type ModeAngle, type ExpressionNode } from '../../expression'
import { compilerX, compilerXY } from '../compilation'

function tree(source: string, angle: ModeAngle = 'radians'): ExpressionNode {
  const r = parseExpression(source, { calculator: { angle, functions: ['f'] } })
  if (!r.ok) throw new Error(`${source}: ${r.error.message}`)
  return r.expression.tree
}

describe('compilerXY', () => {
  it.each([
    ['x + y', 2, 3, 5],
    ['x − y', 2, 3, -1],
    ['xy', 2, 3, 6],
    ['x/y', 3, 2, 1.5],
    ['x^y', 2, 3, 8],
    ['x + 1', 2, 0, 3],
    ['x − 1', 2, 0, 1],
    ['2x', 2, 0, 4],
    ['x/4', 2, 0, 0.5],
    ['x²', -3, 0, 9],
    ['x³', -2, 0, -8],
    ['1 + y', 0, 2, 3],
    ['1 − y', 0, 2, -1],
    ['3y', 0, 2, 6],
    ['1/y', 0, 4, 0.25],
    ['2^y', 0, 3, 8],
    ['−x', 2, 0, -2],
    ['|x|', -2, 0, 2],
    ['√x', 9, 0, 3],
    ['x² + y² − 4', 2, 0, 0],
    ['(1 + 2) x', 2, 0, 6],
  ])('%s at (%d, %d) = %d', (source, x, y, expected) => {
    expect(compilerXY(tree(source))(x, y)).toBeCloseTo(expected, 12)
  })

  it('should take sin, cos, tan in degrees', () => {
    expect(compilerXY(tree('sin(x)', 'degres'))(90, 0)).toBeCloseTo(1, 14)
    expect(compilerXY(tree('cos(y)', 'degres'))(0, 180)).toBeCloseTo(-1, 14)
    expect(compilerXY(tree('sin(30)', 'degres'))(0, 0)).toBeCloseTo(0.5, 14)
    expect(compilerXY(tree('sin(x)'))(Math.PI / 2, 0)).toBeCloseTo(1, 14)
  })

  it('should read the constants it is given, NaN for the others', () => {
    const c = new Map([['a', 2]])
    expect(compilerXY(tree('ax + b'), c)(3, 0)).toBeNaN()
    expect(compilerXY(tree('ax + 1'), c)(3, 0)).toBe(7)
    expect(compilerXY(tree('π + e'))(0, 0)).toBeCloseTo(Math.PI + Math.E, 14)
  })

  it('should return NaN where not defined, Infinity included', () => {
    const f = compilerXY(tree('1/x'))
    expect(f(0, 0)).toBeNaN()
    expect(f(2, 0)).toBe(0.5)
    expect(compilerXY(tree('√x'))(-1, 0)).toBeNaN()
    expect(compilerXY(tree('1/0'))(1, 1)).toBeNaN()
    expect(compilerXY(tree('ln(0)'))(1, 1)).toBeNaN()
    expect(compilerXY(tree('f(x)'))(1, 1)).toBeNaN()
  })

  it('should fold what does not depend on x or y', () => {
    expect(compilerXY(tree('2 + 3'))(NaN, NaN)).toBe(5)
    expect(compilerXY(tree('−(2^3)'))(NaN, NaN)).toBe(-8)
  })
})

describe('compilerX', () => {
  it('should read y as 0 and turn Infinity into NaN', () => {
    expect(compilerX(tree('x + y'))(2)).toBe(2)
    expect(compilerX(tree('1/x'))(0)).toBeNaN()
    expect(compilerX(tree('7'))(0)).toBe(7)
    expect(compilerX(tree('1/0'))(0)).toBeNaN()
  })

  // Counted, not timed: the closures must not read the tree again when they are called.
  it('should not walk the tree when called: changing it afterwards changes nothing', () => {
    const t = tree('3x³ − 2x² + x/4 − sin(2x) + √(x² + 1)')
    const f = compilerX(t)
    const g = compilerXY(t)
    const before = [f(0.5), g(0.5, 0), f(-2)]
    const visit = (node: ExpressionNode): void => {
      if (node.type === 'number') node.value = 1000
      if (node.type === 'variable') node.name = 'z'
      if (node.type === 'binary') node.op = '-'
      if ('left' in node) {
        visit(node.left)
        visit(node.right)
      }
      if ('operand' in node) visit(node.operand)
      if ('arg' in node) visit(node.arg)
    }
    visit(t)
    expect([f(0.5), g(0.5, 0), f(-2)]).toEqual(before)
  })
})

describe('compilerXY — folded operations', () => {
  it.each([
    ['(5 − 3)x', 2],
    ['(6/3)x', 2],
    ['(2·3)x', 6],
    ['2^3 x', 8],
    ['−(2)x', -2],
    ['√(4)x', 2],
    ['sin(90)x', 1],
  ])('%s at x = 1', (source, expected) => {
    expect(compilerXY(tree(source, 'degres'))(1, 0)).toBeCloseTo(expected, 14)
  })
})
