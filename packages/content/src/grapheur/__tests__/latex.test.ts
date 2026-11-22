import { describe, expect, it } from 'vitest'

import { parseExpression, type ExpressionNode } from '../../expression'
import { latexName, latexNumber, latexOf } from '../latex'

function tex(source: string): string {
  const r = parseExpression(source, { calculator: { functions: ['f', 'g1'] } })
  if (!r.ok) throw new Error(`${source}: ${r.error.message}`)
  return latexOf(r.expression.tree)
}

describe('latexOf', () => {
  it.each([
    // The criteria of #418
    ['1/2x', '\\frac{1}{2}x'],
    ['(x+1)/(x−1)', '\\frac{x+1}{x-1}'],
    ['√(x+1)', '\\sqrt{x+1}'],
    ['2^(x+1)', '2^{x+1}'],
    // Numbers
    ['2,5x', '2{,}5x'],
    ['0.25', '0{,}25'],
    ['12345', '12\\,345'],
    ['1234', '1234'],
    ['1234567,5', '1\\,234\\,567{,}5'],
    // Products
    ['2x', '2x'],
    ['2 × 3', '2\\times 3'],
    ['x × 2', 'x\\times 2'],
    ['ax + b', 'ax+b'],
    ['2πx', '2\\pi x'],
    ['πe', '\\pi e'],
    ['2(x + 1)', '2\\left(x+1\\right)'],
    ['(x − 1)(x + 2)', '\\left(x-1\\right)\\left(x+2\\right)'],
    ['(1/2)(3/4)', '\\frac{1}{2}\\times \\frac{3}{4}'],
    ['2 × (−3)', '2\\left(-3\\right)'],
    ['2 · 3²', '2\\times 3^{2}'],
    ['x·x', 'xx'],
    // Sums and signs
    ['x − (x + 1)', 'x-\\left(x+1\\right)'],
    ['x − (x − 1)', 'x-\\left(x-1\\right)'],
    ['x + (−1)', 'x+\\left(-1\\right)'],
    ['x − −1', 'x-\\left(-1\\right)'],
    ['x + (1 + x)', 'x+\\left(1+x\\right)'],
    ['x − 2x', 'x-2x'],
    ['−x', '-x'],
    ['−(x + 1)', '-\\left(x+1\\right)'],
    ['−−x', '-\\left(-x\\right)'],
    ['−2x', '-2x'],
    ['−x²', '-x^{2}'],
    ['(x + 1)x', '\\left(x+1\\right)x'],
    // Powers
    ['x²', 'x^{2}'],
    ['x³', 'x^{3}'],
    ['(x + 1)²', '\\left(x+1\\right)^{2}'],
    ['(−2)²', '\\left(-2\\right)^{2}'],
    ['(2x)²', '\\left(2x\\right)^{2}'],
    ['(x²)³', '\\left(x^{2}\\right)^{3}'],
    ['2^3^2', '2^{3^{2}}'],
    ['(1/2)^3', '\\left(\\frac{1}{2}\\right)^{3}'],
    ['sin(x)²', '\\left(\\sin\\left(x\\right)\\right)^{2}'],
    // √ takes the factor right after it, as in ADR 0038: √x² is (√x)².
    ['√x²', '\\sqrt{x}^{2}'],
    ['√(x²)', '\\sqrt{x^{2}}'],
    ['x(2y)', 'x\\times 2y'],
    ['x(ab)', 'xab'],
    ['(√x)²', '\\sqrt{x}^{2}'],
    ['|x|²', '\\left|x\\right|^{2}'],
    ['e^x', 'e^{x}'],
    ['e^(−x²)', 'e^{-x^{2}}'],
    ['f(x)²', 'f(x)^{2}'],
    // Functions
    ['sin(x)', '\\sin\\left(x\\right)'],
    ['cos(2x)', '\\cos\\left(2x\\right)'],
    ['tan(x)', '\\tan\\left(x\\right)'],
    ['exp(x)', '\\exp\\left(x\\right)'],
    ['ln(x)', '\\ln\\left(x\\right)'],
    ['log(x)', '\\log\\left(x\\right)'],
    ['|x − 1|', '\\left|x-1\\right|'],
    ['abs(x)', '\\left|x\\right|'],
    ['sqrt(x)', '\\sqrt{x}'],
    ['2√x', '2\\sqrt{x}'],
    ['sin(x)cos(x)', '\\sin\\left(x\\right)\\cos\\left(x\\right)'],
    ['π x', '\\pi x'],
    ['π sin(x)', '\\pi\\sin\\left(x\\right)'],
    // Calls of the student's functions
    ['f(x − 1)', 'f(x-1)'],
    ["f'(x)", "f'(x)"],
    ["f''(x)", "f''(x)"],
    ["f'''(x)", "f'''(x)"],
    ["f''''(x)", 'f^{(4)}(x)'],
    ['g1(2)', 'g_{1}(2)'],
    ["f'(2)(x − 2) + f(2)", "f'(2)\\left(x-2\\right)+f(2)"],
  ])('%s → %s', (source, expected) => {
    expect(tex(source)).toBe(expected)
  })

  it('should write numbers folded into the tree', () => {
    const n = (value: number): ExpressionNode => ({ type: 'number', value })
    expect(latexOf(n(-3))).toBe('-3')
    expect(latexOf({ type: 'binary', op: '+', left: n(1), right: n(-3) })).toBe(
      '1+\\left(-3\\right)'
    )
    expect(latexOf({ type: 'binary', op: '^', left: n(-3), right: n(2) })).toBe(
      '\\left(-3\\right)^{2}'
    )
    expect(latexOf({ type: 'negate', operand: n(-3) })).toBe('-\\left(-3\\right)')
    expect(latexOf({ type: 'binary', op: '*', left: n(2), right: n(-3) })).toBe(
      '2\\left(-3\\right)'
    )
  })
})

describe('latexNumber', () => {
  it.each([
    [0, '0'],
    [-2.5, '-2{,}5'],
    [1e21, '1\\times 10^{21}'],
    [1.5e-7, '1{,}5\\times 10^{-7}'],
    [NaN, '\\text{?}'],
    [Infinity, '\\infty'],
    [-Infinity, '-\\infty'],
  ])('%d → %s', (value, expected) => {
    expect(latexNumber(value)).toBe(expected)
  })
})

describe('latexName', () => {
  it('should put the digit of a name as a subscript', () => {
    expect(latexName('f')).toBe('f')
    expect(latexName('f1')).toBe('f_{1}')
  })
})
