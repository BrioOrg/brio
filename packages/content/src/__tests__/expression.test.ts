import { describe, expect, it } from 'vitest'

import { parseExpression } from '../expression'

function value(source: string, scope: Record<string, number> = {}, variables?: string[]): number {
  const result = parseExpression(source, { variables: variables ?? ['x', ...Object.keys(scope)] })
  if (!result.ok) throw new Error(`${source}: ${result.error.message}`)
  return result.expression.evaluate(scope)
}

function error(source: string, variables?: string[]) {
  const result = parseExpression(source, variables ? { variables } : {})
  if (result.ok) throw new Error(`${source} should not parse`)
  return result.error
}

describe('parseExpression — numbers', () => {
  it('should read a decimal comma and a decimal point alike', () => {
    expect(value('2,5')).toBe(2.5)
    expect(value('2.5')).toBe(2.5)
    expect(value(',5')).toBe(0.5)
    expect(value('0,25x', { x: 4 })).toBe(1)
  })

  it('should refuse a number with two decimal separators', () => {
    expect(error('2,5,3').message).toMatch(/une seule virgule/)
  })

  it('should refuse a separator without digits after it', () => {
    expect(error('2, + x').message).toMatch(/suivie de chiffres/)
    expect(error('2,').position).toBe(1)
  })

  it('should refuse two numbers in a row', () => {
    expect(error('1 000').message).toMatch(/sans opération/)
  })
})

describe('parseExpression — operators and precedence', () => {
  it.each([
    ['2 + 3 × 4', 14],
    ['2 * 3 - 4', 2],
    ['(2 + 3) × 4', 20],
    ['10 − 4 − 3', 3],
    ['12 / 3 / 2', 2],
    ['12 ÷ 4', 3],
    ['12 : 4', 3],
    ['2 · 3', 6],
    ['2^3^2', 512],
    ['−2²', -4],
    ['(−2)²', 4],
    ['2^-1', 0.5],
    ['3²', 9],
    ['2³', 8],
    ['−−3', 3],
    ['+3', 3],
    ['2 – 1', 1],
  ])('should compute %s = %d', (source, expected) => {
    expect(value(source)).toBeCloseTo(expected, 12)
  })

  it('should read implicit products as on paper', () => {
    expect(value('2x', { x: 3 })).toBe(6)
    expect(value('2x + 1', { x: 3 })).toBe(7)
    expect(value('3(x + 1)', { x: 2 })).toBe(9)
    expect(value('(x − 1)(x + 2)', { x: 3 })).toBe(10)
    expect(value('2x²', { x: 3 })).toBe(18)
    expect(value('ax + b', { x: 2, a: 3, b: 1 })).toBe(7)
    expect(value('2πx', { x: 1 })).toBeCloseTo(2 * Math.PI)
    expect(value('x(x + 1)', { x: 2 })).toBe(6)
  })

  it('should read 1/2x as (1/2)·x, left to right', () => {
    expect(value('1/2x', { x: 4 })).toBe(2)
  })

  it('should refuse a number written after a letter', () => {
    const e = error('x2')
    expect(e.message).toMatch(/2x et non x2/)
    expect(e.position).toBe(1)
  })
})

describe('parseExpression — functions', () => {
  it('should know sqrt, racine and √', () => {
    expect(value('sqrt(9)')).toBe(3)
    expect(value('racine(16)')).toBe(4)
    expect(value('√x', { x: 25 })).toBe(5)
    expect(value('√(x + 7)', { x: 2 })).toBe(3)
    expect(value('2√x', { x: 4 })).toBe(4)
  })

  it('should know abs and the bars of an absolute value', () => {
    expect(value('abs(x)', { x: -3 })).toBe(3)
    expect(value('|x − 2|', { x: 0 })).toBe(2)
    expect(value('2|x|', { x: -1.5 })).toBe(3)
    expect(value('|x| + |x − 1|', { x: 3 })).toBe(5)
  })

  it('should know π, as π and as pi', () => {
    expect(value('π')).toBe(Math.PI)
    expect(value('pi')).toBe(Math.PI)
  })

  it('should ask for brackets after a function name', () => {
    expect(error('sqrt x').message).toMatch(/sqrt\(x\)/)
  })

  it('should return NaN where the expression is not defined', () => {
    expect(value('sqrt(x)', { x: -1 })).toBeNaN()
    expect(value('1/x', { x: 0 })).toBeNaN()
    expect(value('1/x', { x: 2 })).toBe(0.5)
  })
})

describe('parseExpression — letters', () => {
  it('should only allow x by default', () => {
    const e = error('2t + 1')
    expect(e.message).toBe('La lettre « t » n’est pas connue : la seule lettre permise est x.')
    expect(e.position).toBe(1)
  })

  it('should name the parameters in the message', () => {
    expect(error('ax + c', ['x', 'a', 'b']).message).toMatch(/x et a, b/)
  })

  it('should list the letters an expression uses', () => {
    const r = parseExpression('a x² + b x + 1', { variables: ['x', 'a', 'b'] })
    expect(r.ok && r.expression.variables).toEqual(['a', 'b', 'x'])
  })

  it('should treat a missing letter value as undefined', () => {
    const r = parseExpression('ax', { variables: ['x', 'a'] })
    expect(r.ok && r.expression.evaluate({ x: 1 })).toBeNaN()
  })
})

describe('parseExpression — French messages', () => {
  it.each([
    ['', /vide/],
    ['   ', /vide/],
    ['2x +', /s’arrête après « \+ »/],
    ['(x + 1', /parenthèse fermante/],
    ['x + 1)', /en trop/],
    ['()', /vides/],
    ['× 2', /avant lui/],
    ['|x', /barre/],
    ['2x $ 1', /« \$ » n’est pas permis/],
    ['f(x) = 2x', /sans « f\(x\) = »/],
    ['y = 2x', /sans « f\(x\) = » ni « y = »/],
  ])('should explain %j', (source, pattern) => {
    expect(error(source).message).toMatch(pattern)
  })

  it('should never use eval or Function', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(new URL('../expression.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/\beval\s*\(|new Function|Function\s*\(/)
  })
})
