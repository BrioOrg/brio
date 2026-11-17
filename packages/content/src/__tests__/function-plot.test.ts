import { describe, expect, it } from 'vitest'

import { buildDrawingModel, type FigureSpec } from '../figure'
import { formatReadingValue, sampleCurve, solveFor } from '../function-plot'

// A 1:1 transform for sampling tests: 20 px per unit, window [−5, 5] × [−5, 5].
const win = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }
const toSvg = (x: number, y: number) => ({ x: 100 + 20 * x, y: 100 - 20 * y })

function pieces(f: (x: number) => number, a = -5, b = 5) {
  return sampleCurve(f, a, b, win, toSvg)
}

function allPoints(ps: Array<Array<{ x: number; y: number }>>) {
  return ps.flat()
}

describe('sampleCurve', () => {
  it('should draw a straight line with its two ends only', () => {
    const ps = pieces((x) => 0.5 * x + 1)
    expect(ps).toHaveLength(1)
    expect(ps[0]).toHaveLength(2)
    expect(ps[0][0]).toEqual({ x: 0, y: 130 })
    expect(ps[0][1].x).toBeCloseTo(200)
  })

  it('should follow a parabola within a fraction of a pixel', () => {
    const [piece] = pieces((x) => x * x - 3)
    for (let i = 1; i < piece.length; i++) {
      const a = piece[i - 1]
      const b = piece[i]
      // The curve point halfway between the chord's ends, measured across the chord.
      const lx = ((a.x + b.x) / 2 - 100) / 20
      const m = { x: 100 + 20 * lx, y: 100 - 20 * (lx * lx - 3) }
      const l = Math.hypot(b.x - a.x, b.y - a.y)
      const across = Math.abs((m.x - a.x) * (b.y - a.y) - (m.y - a.y) * (b.x - a.x)) / l
      expect(across).toBeLessThan(0.35)
    }
  })

  it('should break 1/x at its asymptote, with no vertical line across it', () => {
    const ps = pieces((x) => 1 / x)
    expect(ps.length).toBe(2)
    for (const piece of ps) {
      const xs = piece.map((p) => p.x)
      // Every piece stays on one side of x = 0 (pixel 100).
      expect(xs.every((x) => x <= 100) || xs.every((x) => x >= 100)).toBe(true)
      for (let i = 1; i < piece.length; i++) {
        expect(Math.abs(piece[i].y - piece[i - 1].y)).toBeLessThan(40)
      }
    }
  })

  it('should break 1/(x − 0,3) at a pole that falls between two samples', () => {
    const ps = pieces((x) => 1 / (x - 0.3))
    expect(ps.length).toBe(2)
    const pole = 100 + 20 * 0.3
    for (const piece of ps) {
      const xs = piece.map((p) => p.x)
      expect(xs.every((x) => x <= pole + 1e-6) || xs.every((x) => x >= pole - 1e-6)).toBe(true)
    }
  })

  it('should start √x exactly at the origin and draw nothing where it is not defined', () => {
    const ps = pieces((x) => Math.sqrt(x))
    expect(ps).toHaveLength(1)
    const first = ps[0][0]
    expect(first.x).toBeCloseTo(100, 3)
    expect(first.y).toBeCloseTo(100, 3)
    expect(allPoints(ps).every((p) => p.x >= 100 - 1e-6)).toBe(true)
  })

  it('should clip the curve to the window and split it where it leaves', () => {
    // x² − 4 leaves through the top on both sides: one piece, inside the box.
    const ps = pieces((x) => x * x - 4)
    expect(ps).toHaveLength(1)
    for (const p of allPoints(ps)) {
      expect(p.y).toBeGreaterThanOrEqual(-1e-6)
      expect(p.y).toBeLessThanOrEqual(200 + 1e-6)
    }
    // 4 − x² + … that goes out and comes back: two pieces.
    const wavy = pieces((x) => 6 * Math.cos(x))
    expect(wavy.length).toBeGreaterThan(1)
  })

  it('should keep the domain', () => {
    const ps = pieces((x) => x, 0, 2)
    expect(ps[0][0].x).toBeCloseTo(100)
    expect(ps[0][ps[0].length - 1].x).toBeCloseTo(140)
  })

  it('should draw nothing for a function defined nowhere', () => {
    expect(pieces(() => NaN)).toEqual([])
  })
})

describe('solveFor', () => {
  it('should find both antecedents of 3 by x² − 1', () => {
    expect(solveFor((x) => x * x - 1, 3, -5, 5)).toEqual([-2, 2])
  })

  it('should find a touching point', () => {
    const roots = solveFor((x) => (x - 1) * (x - 1), 0, -5, 5)
    expect(roots).toHaveLength(1)
    expect(roots[0]).toBeCloseTo(1, 4)
  })

  it('should not take a pole for a root', () => {
    expect(solveFor((x) => 1 / x, 0, -5, 5)).toEqual([])
  })

  it('should find the antecedent of an affine function exactly', () => {
    expect(solveFor((x) => 4 * x, 20, 0, 6)).toEqual([5])
  })
})

describe('formatReadingValue', () => {
  it('should write exact values as a French page does', () => {
    expect(formatReadingValue(2.5)).toBe('2,5')
    expect(formatReadingValue(-3)).toBe('−3')
  })

  it('should round to the hundredth with ≈', () => {
    expect(formatReadingValue(Math.sqrt(3))).toBe('≈ 1,73')
  })
})

const axes: FigureSpec['axes'] = {
  x: { from: -4, to: 4, step: 1 },
  y: { from: -4, to: 4, step: 1 },
}

describe('buildDrawingModel with functions', () => {
  it('should have no function plot without functions', () => {
    expect(buildDrawingModel({ axes }).functionPlot).toBeNull()
  })

  it('should draw one path per continuous piece', () => {
    const model = buildDrawingModel({ axes, functions: [{ name: 'f', expr: '1/x' }] })
    expect(model.functionPlot?.curves).toHaveLength(2)
    expect(model.functionPlot?.curves[0].d).toMatch(/^M [\d.]+ [\d.]+ L/)
  })

  it('should carry the tone of a curve to its path and its name', () => {
    const model = buildDrawingModel({
      axes,
      functions: [{ name: 'f', expr: 'x', label: true, tone: 2 }],
    })
    expect(model.functionPlot?.curves[0].tone).toBe(2)
    expect(model.functionPlot?.labels[0].tone).toBe(2)
  })

  it('should mark a dashed curve', () => {
    const model = buildDrawingModel({
      axes,
      functions: [{ name: 'g', expr: 'x', style: 'dashed' }],
    })
    expect(model.functionPlot?.curves[0].dashed).toBe(true)
  })

  it('should name the curve 𝒞_f where it touches nothing', () => {
    const model = buildDrawingModel({
      axes,
      functions: [{ name: 'f', expr: 'x²/2 − 1', label: true }],
    })
    const [label] = model.functionPlot!.labels
    expect(label).toMatchObject({ name: 'f', kind: 'curve', subscript: 'f' })
    // Inside the window (44 … 276 px).
    expect(label.x).toBeGreaterThan(44)
    expect(label.x).toBeLessThan(276)
    expect(label.y).toBeGreaterThan(44)
    expect(label.y).toBeLessThan(276)
  })

  it('should write the author’s text instead of 𝒞_f', () => {
    const model = buildDrawingModel({
      axes,
      functions: [{ name: 'f', expr: 'x', label: 'Tarif A' }],
    })
    expect(model.functionPlot!.labels[0]).toMatchObject({ kind: 'text', text: 'Tarif A' })
  })

  it('should draw the reading of an image with its two guides and its values', () => {
    const model = buildDrawingModel({
      axes,
      functions: [{ name: 'f', expr: '2x − 1' }],
      readings: [{ function: 'f', x: 1.5 }],
    })
    const [reading] = model.functionPlot!.readings
    expect(reading.guides).toHaveLength(2)
    expect(reading.dots).toHaveLength(1)
    expect(reading.values.map((v) => v.text)).toEqual(['1,5', '2'])
  })

  it('should replace the graduation number a reading writes over', () => {
    const model = buildDrawingModel({
      axes,
      functions: [{ name: 'f', expr: '2x − 1' }],
      readings: [{ function: 'f', x: 1.5 }],
    })
    const yLabels = model.axes!.y.ticks.flatMap((t) => (t.label ? [t.label.text] : []))
    expect(yLabels).not.toContain('2')
    const xLabels = model.axes!.x.ticks.flatMap((t) => (t.label ? [t.label.text] : []))
    expect(xLabels).toContain('3')
  })

  it('should draw every antecedent of a value', () => {
    const model = buildDrawingModel({
      axes,
      functions: [{ name: 'f', expr: 'x² − 1' }],
      readings: [{ function: 'f', y: 3 }],
    })
    const [reading] = model.functionPlot!.readings
    expect(reading.dots).toHaveLength(2)
    expect(reading.values.map((v) => v.text).sort()).toEqual(['2', '3', '−2'])
  })

  it('should follow the parameters, and fall back on their value', () => {
    const spec: FigureSpec = {
      axes,
      functions: [{ name: 'f', expr: 'ax' }],
      parameters: [{ name: 'a', min: -2, max: 2, step: 0.5, value: 1 }],
      readings: [{ function: 'f', x: 2 }],
    }
    const byDefault = buildDrawingModel(spec).functionPlot!.readings[0]
    expect(byDefault.values.map((v) => v.text)).toEqual(['2', '2'])
    const moved = buildDrawingModel(spec, { parameterValues: { a: 1.5 } }).functionPlot!
    expect(moved.readings[0].values.map((v) => v.text)).toEqual(['2', '3'])
  })

  it('should explain an unreadable expression in French', () => {
    expect(() => buildDrawingModel({ axes, functions: [{ name: 'f', expr: '2x +' }] })).toThrow(
      /Fonction f : L’expression s’arrête/
    )
  })
})
