import { describe, expect, it } from 'vitest'
import {
  buildTreeModel,
  estimateLatex,
  outcomeText,
  productLatex,
  treeCollisions,
  type TreeNodeSpec,
  type TreeSpec,
} from '../tree'

const n = (label: string, probability?: string, children?: TreeNodeSpec[]): TreeNodeSpec => ({
  label,
  ...(probability !== undefined ? { probability } : {}),
  ...(children ? { children } : {}),
})

const urn: TreeSpec = {
  root: {
    children: [
      n('R', '3/5', [n('R', '2/4'), n('B', '2/4')]),
      n('B', '2/5', [n('R', '3/4'), n('B', '1/4')]),
    ],
  },
  outcomes: true,
  products: true,
  highlightPath: ['R', 'B'],
}

const coins: TreeSpec = {
  root: { children: [n('P', undefined, [n('P'), n('F')]), n('F', undefined, [n('P'), n('F')])] },
  outcomes: true,
}

const die3: TreeSpec = {
  root: {
    children: ['1', '2', '3'].map((a) =>
      n(
        a,
        '1/3',
        ['1', '2', '3'].map((b) => n(b, '1/3'))
      )
    ),
  },
  outcomes: true,
  products: true,
}

const threeSteps: TreeSpec = {
  root: {
    children: ['A', '$\\overline{A}$'].map((a, i) =>
      n(a, i === 0 ? '0,3' : '0,7', [
        n('B', '0,4', [n('C', '0,5'), n('$\\overline{C}$', '0,5')]),
        n('$\\overline{B}$', '0,6', [n('C', '0,9'), n('$\\overline{C}$', '0,1')]),
      ])
    ),
  },
  outcomes: true,
  products: true,
}

const uneven: TreeSpec = {
  root: {
    children: [
      n('R', '1/2'),
      n('V', '1/3', [n('R', '1/4'), n('V', '1/4'), n('B', '1/2')]),
      n('B', '1/6', [n('R', '12/25'), n('B', '13/25')]),
    ],
  },
  outcomes: true,
  products: true,
}

const battery: [string, TreeSpec][] = [
  ['urn', urn],
  ['coins', coins],
  ['die3', die3],
  ['threeSteps', threeSteps],
  ['uneven', uneven],
  ['vertical urn', { ...urn, orientation: 'vertical' }],
  ['vertical coins', { ...coins, orientation: 'vertical' }],
]

describe('outcomeText and productLatex', () => {
  it('should write an issue as a French pair, with a narrow space before the semicolon', () => {
    expect(outcomeText(['R', 'B'])).toBe('(R ; B)')
    expect(outcomeText(['R'])).toBe('R')
  })

  it('should multiply along a path and reduce the result', () => {
    expect(productLatex(['3/5', '2/4'])).toBe('\\dfrac{3}{5}\\times \\dfrac{2}{4}=\\dfrac{3}{10}')
    expect(productLatex(['1/2', '2/1'])).toBe('\\dfrac{1}{2}\\times \\dfrac{2}{1}=1')
  })

  it('should give a decimal when every factor is one, percentages included', () => {
    expect(productLatex(['0,4', '0,3'])).toBe('0{,}4\\times 0{,}3=0{,}12')
    expect(productLatex(['25 %', '0,4'])).toBe('0{,}25\\times 0{,}4=0{,}1')
  })

  it('should give nothing when a probability is not a number', () => {
    expect(productLatex(['3/5', '?'])).toBeNull()
    expect(productLatex(['$p$', '1/2'])).toBeNull()
    expect(productLatex(['3/5', undefined])).toBeNull()
  })
})

describe('estimateLatex', () => {
  it('should make a fraction taller than a decimal, and as wide as its widest term', () => {
    const frac = estimateLatex('\\dfrac{12}{25}')
    const dec = estimateLatex('0{,}25')
    expect(frac.height).toBeGreaterThan(dec.height * 1.5)
    expect(frac.width).toBeCloseTo(1.24, 2)
    expect(estimateLatex('\\overline{A}').width).toBeCloseTo(estimateLatex('A').width, 5)
  })
})

describe('buildTreeModel', () => {
  it('should draw one branch per node and one label per event and probability', () => {
    const model = buildTreeModel(urn)
    expect(model.branches).toHaveLength(6)
    expect(model.labels.filter((l) => l.role === 'event')).toHaveLength(6)
    expect(model.labels.filter((l) => l.role === 'probability')).toHaveLength(6)
    expect(model.labels.filter((l) => l.role === 'outcome').map((l) => l.content)).toEqual([
      { kind: 'rich', text: '(R ; R)' },
      { kind: 'rich', text: '(R ; B)' },
      { kind: 'rich', text: '(B ; R)' },
      { kind: 'rich', text: '(B ; B)' },
    ])
  })

  it('should put each parent at the middle of its children and the leaves at equal steps', () => {
    const model = buildTreeModel(coins)
    const events = model.labels.filter((l) => l.role === 'event')
    const [p, pp, pf, f, fp, ff] = events
    expect(p.y).toBeCloseTo((pp.y + pf.y) / 2, 5)
    expect(f.y).toBeCloseTo((fp.y + ff.y) / 2, 5)
    expect(pf.y - pp.y).toBeCloseTo(fp.y - pf.y, 5)
    expect(model.root.y).toBeCloseTo((p.y + f.y) / 2, 5)
    // Horizontal: the depth grows to the right.
    expect(pp.x).toBeGreaterThan(p.x)
  })

  it('should put a branch label on the side away from its siblings', () => {
    const model = buildTreeModel(urn)
    const probabilities = model.labels.filter((l) => l.role === 'probability')
    const [first] = probabilities
    const up = model.branches[0]
    const down = model.branches[3]
    // The upper branch's label is above its middle, the lower one's below.
    expect(first.y).toBeLessThan((up.y1 + up.y2) / 2)
    expect(probabilities[3].y).toBeGreaterThan((down.y1 + down.y2) / 2)
  })

  it('should write the products and colour only the highlighted path', () => {
    const model = buildTreeModel(urn)
    const products = model.labels.filter((l) => l.role === 'product')
    expect(products.map((l) => l.content)).toContainEqual({
      kind: 'math',
      latex: '\\dfrac{3}{5}\\times \\dfrac{2}{4}=\\dfrac{3}{10}',
    })
    expect(model.branches.filter((b) => b.emphasis)).toHaveLength(2)
    expect(model.labels.filter((l) => l.emphasis).map((l) => l.role)).toEqual([
      'probability',
      'probability',
      'outcome',
      'product',
    ])
    expect(model.rows.filter((r) => r.emphasis).map((r) => r.outcome)).toEqual(['(R ; B)'])
  })

  it('should leave products and issues out unless asked', () => {
    const model = buildTreeModel({ root: urn.root })
    expect(model.labels.some((l) => l.role === 'outcome' || l.role === 'product')).toBe(false)
    expect(model.rows.every((r) => r.product === null)).toBe(true)
  })

  it.each(battery)(
    'should never let two labels or a label and a branch collide (%s)',
    (_, spec) => {
      expect(treeCollisions(buildTreeModel(spec))).toEqual([])
      expect(treeCollisions(buildTreeModel(spec, { compact: true }))).toEqual([])
    }
  )

  it.each(battery)('should keep every label inside the canvas (%s)', (_, spec) => {
    for (const model of [buildTreeModel(spec), buildTreeModel(spec, { compact: true })]) {
      for (const l of model.labels) {
        const x0 = l.anchor === 'start' ? l.x : l.x - l.width / 2
        expect(x0).toBeGreaterThanOrEqual(0)
        expect(x0 + l.width).toBeLessThanOrEqual(model.width)
        expect(l.y - l.height / 2).toBeGreaterThanOrEqual(0)
        expect(l.y + l.height / 2).toBeLessThanOrEqual(model.height)
      }
    }
  })

  it('should fit a phone in its compact form, even three steps deep with products', () => {
    for (const [, spec] of battery) {
      expect(buildTreeModel(spec, { compact: true }).width).toBeLessThanOrEqual(328)
    }
  })

  it('should lay a compact tree out horizontally whatever the authored orientation', () => {
    const vertical = { ...urn, orientation: 'vertical' as const }
    expect(buildTreeModel(vertical).orientation).toBe('vertical')
    expect(buildTreeModel(vertical, { compact: true }).orientation).toBe('horizontal')
  })

  it('should grow downwards when vertical, with the issues under the leaves', () => {
    const model = buildTreeModel({ ...coins, orientation: 'vertical' })
    const events = model.labels.filter((l) => l.role === 'event')
    const outcomes = model.labels.filter((l) => l.role === 'outcome')
    expect(events[1].y).toBeGreaterThan(events[0].y)
    expect(outcomes[0].x).toBeCloseTo(events[1].x, 5)
    expect(outcomes[0].y).toBeGreaterThan(events[1].y)
  })

  it('should list one row per path for the hidden table', () => {
    const model = buildTreeModel(urn)
    expect(model.rows).toHaveLength(4)
    expect(model.rows[1]).toEqual({
      steps: [
        { label: 'R', probability: '\\dfrac{3}{5}' },
        { label: 'B', probability: '\\dfrac{2}{4}' },
      ],
      outcome: '(R ; B)',
      product: '\\dfrac{3}{5}\\times \\dfrac{2}{4}=\\dfrac{3}{10}',
      emphasis: true,
    })
  })
})
