import { describe, expect, it } from 'vitest'
import {
  checkTree,
  decimalString,
  findPath,
  parseProbability,
  probabilityValue,
  rational,
  type TreeIssue,
} from '../tree-rules'

function node(label: string, probability?: string, children?: unknown[]) {
  return {
    label,
    ...(probability !== undefined ? { probability } : {}),
    ...(children ? { children } : {}),
  }
}

/** Two draws without replacement from 3 red and 2 blue balls. */
const urn = {
  root: {
    children: [
      node('R', '3/5', [node('R', '2/4'), node('B', '2/4')]),
      node('B', '2/5', [node('R', '3/4'), node('B', '1/4')]),
    ],
  },
}

const codes = (issues: TreeIssue[]) => issues.map((i) => i.code)

describe('parseProbability', () => {
  it('should read a fraction, a decimal with a comma, a percentage and an integer exactly', () => {
    expect(parseProbability('3/5')).toEqual({
      kind: 'fraction',
      value: rational(3n, 5n),
      latex: '\\dfrac{3}{5}',
    })
    expect(parseProbability(' 2 / 4 ')).toMatchObject({
      value: rational(1n, 2n),
      latex: '\\dfrac{2}{4}',
    })
    expect(parseProbability('0,4')).toEqual({
      kind: 'decimal',
      value: rational(2n, 5n),
      latex: '0{,}4',
    })
    expect(parseProbability('25 %')).toEqual({
      kind: 'percent',
      value: rational(1n, 4n),
      latex: '25\\,\\%',
    })
    expect(parseProbability('12,5 %')).toMatchObject({ value: rational(1n, 8n) })
    expect(parseProbability('1')).toEqual({ kind: 'integer', value: rational(1n, 1n), latex: '1' })
  })

  it('should read a LaTeX fraction as a number and keep any other formula as written', () => {
    expect(parseProbability('$\\frac{1}{6}$')).toMatchObject({
      kind: 'fraction',
      value: rational(1n, 6n),
      latex: '\\dfrac{1}{6}',
    })
    expect(parseProbability('$0{,}3$')).toMatchObject({ kind: 'decimal', value: rational(3n, 10n) })
    expect(parseProbability('$1-p$')).toEqual({ kind: 'latex', latex: '1-p' })
    expect(parseProbability('?')).toEqual({ kind: 'blank', latex: '?' })
  })

  it('should refuse a decimal point, a zero denominator and free text', () => {
    expect(parseProbability('0.4')).toEqual({ kind: 'invalid', reason: 'decimal-point' })
    expect(parseProbability('1/0')).toEqual({ kind: 'invalid', reason: 'zero-denominator' })
    expect(parseProbability('un tiers')).toEqual({ kind: 'invalid', reason: 'format' })
  })

  it('should give a value only to numbers', () => {
    expect(probabilityValue('$p$')).toBeNull()
    expect(probabilityValue('?')).toBeNull()
    expect(probabilityValue(undefined)).toBeNull()
    expect(probabilityValue('6/8')).toEqual(rational(3n, 4n))
  })
})

describe('decimalString', () => {
  it('should write a finite decimal with a comma', () => {
    expect(decimalString(rational(3n, 25n))).toBe('0,12')
    expect(decimalString(rational(1n, 8n))).toBe('0,125')
    expect(decimalString(rational(1n, 1n))).toBe('1')
  })
})

describe('checkTree', () => {
  it('should accept a complete weighted tree and a tree of possibles', () => {
    expect(checkTree(urn)).toEqual([])
    expect(
      checkTree({ root: { children: [node('P', undefined, [node('P'), node('F')]), node('F')] } })
    ).toEqual([])
  })

  it('should add mixed writings exactly: 0,5 + 1/4 + 25 % = 1', () => {
    expect(
      checkTree({ root: { children: [node('A', '0,5'), node('B', '1/4'), node('C', '25 %')] } })
    ).toEqual([])
  })

  it('should reject siblings whose probabilities do not sum to 1', () => {
    const issues = checkTree({
      root: {
        children: [node('R', '3/5', [node('R', '2/4'), node('B', '3/4')]), node('B', '2/5')],
      },
    })
    expect(issues).toEqual([
      { code: 'SUM_NOT_ONE', path: 'root.children[0].children', sum: '5/4', severity: 'error' },
    ])
  })

  it('should reject given probabilities already above 1, and warn when some are missing', () => {
    expect(
      codes(checkTree({ root: { children: [node('A', '0,7'), node('B', '0,6'), node('C', '?')] } }))
    ).toEqual(['SUM_ABOVE_ONE'])
    expect(checkTree({ root: { children: [node('A', '0,3'), node('B')] } })).toEqual([
      {
        code: 'PARTIAL_PROBABILITIES',
        path: 'root.children',
        given: 1,
        count: 2,
        severity: 'warning',
      },
    ])
    // A blank to fill or a formula is a given probability without a value: no warning, no sum.
    expect(checkTree({ root: { children: [node('A', '0,3'), node('B', '?')] } })).toEqual([])
    expect(checkTree({ root: { children: [node('A', '$p$'), node('B', '$1-p$')] } })).toEqual([])
  })

  it('should reject an invalid probability and one above 1', () => {
    const issues = checkTree({ root: { children: [node('A', '0.5'), node('B', '3/2')] } })
    expect(issues).toContainEqual({
      code: 'INVALID_PROBABILITY',
      path: 'root.children[0].probability',
      value: '0.5',
      reason: 'decimal-point',
      severity: 'error',
    })
    expect(codes(issues)).toContain('PROBABILITY_ABOVE_ONE')
  })

  it('should reject blank and duplicated sibling labels', () => {
    expect(codes(checkTree({ root: { children: [node(' '), node('A'), node('A')] } }))).toEqual([
      'BLANK_LABEL',
      'DUPLICATE_LABEL',
    ])
  })

  it('should bound the depth to 3, the branches of a node to 6 and the leaves to 12', () => {
    const deep = {
      root: {
        children: [
          node('A', undefined, [node('B', undefined, [node('C', undefined, [node('D')])])]),
        ],
      },
    }
    expect(codes(checkTree(deep))).toEqual(['TOO_DEEP'])
    const die = Array.from({ length: 7 }, (_, i) => node(String(i + 1)))
    expect(codes(checkTree({ root: { children: die } }))).toEqual(['TOO_MANY_CHILDREN'])
    const wide = {
      root: {
        children: [1, 2, 3, 4, 5].map((i) =>
          node(String(i), undefined, [node('P'), node('F'), node('X')])
        ),
      },
    }
    expect(checkTree(wide)).toEqual([
      { code: 'TOO_MANY_LEAVES', path: 'root', count: 15, max: 12, severity: 'error' },
    ])
  })

  it('should need at least one branch', () => {
    expect(codes(checkTree({ root: { children: [] } }))).toEqual(['NO_BRANCH'])
    expect(codes(checkTree({}))).toEqual(['NO_BRANCH'])
  })

  it('should need a number on every branch to write the products', () => {
    expect(checkTree({ ...urn, products: true })).toEqual([])
    const blank = { root: { children: [node('A', '?'), node('B', '1/2')] }, products: true }
    expect(codes(checkTree(blank))).toEqual(['PRODUCT_NEEDS_PROBABILITIES'])
  })

  it('should allow an outcome on a leaf only', () => {
    const tree = {
      root: {
        children: [{ ...node('A', '1/2', [node('B', '1')]), outcome: '$A$' }, node('C', '1/2')],
      },
    }
    expect(codes(checkTree(tree))).toEqual(['OUTCOME_ON_BRANCH'])
  })

  it('should need the highlighted path to lead to a leaf', () => {
    expect(checkTree({ ...urn, highlightPath: ['R', 'B'] })).toEqual([])
    expect(codes(checkTree({ ...urn, highlightPath: ['R'] }))).toEqual(['HIGHLIGHT_NOT_A_PATH'])
    expect(codes(checkTree({ ...urn, highlightPath: ['V', 'B'] }))).toEqual([
      'HIGHLIGHT_NOT_A_PATH',
    ])
  })
})

describe('findPath', () => {
  it('should give the child indices of a root-to-leaf path', () => {
    expect(findPath(urn.root, ['B', 'R'])).toEqual([1, 0])
    expect(findPath(urn.root, [])).toBeNull()
  })
})
