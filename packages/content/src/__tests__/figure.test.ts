import { describe, expect, it } from 'vitest'
import {
  angleDegrees,
  buildDrawingModel,
  euclideanLength,
  isCollinear,
  type FigureSpec,
} from '../figure'

// A 3-4-5 right triangle: right angle at A, hypotenuse BC.
const pythagorean: FigureSpec = {
  points: [
    { name: 'A', x: 0, y: 0, label: { placement: 'below-left' } },
    { name: 'B', x: 4, y: 0, label: { placement: 'below-right' } },
    { name: 'C', x: 0, y: 3, label: { placement: 'above-left' } },
  ],
  polygons: [{ vertices: ['A', 'B', 'C'] }],
  angleMarks: [{ vertex: 'A', from: 'B', to: 'C', right: true }],
}

describe('angleDegrees', () => {
  it('returns 90 for a right angle', () => {
    const A = { x: 0, y: 0 }
    const B = { x: 4, y: 0 }
    const C = { x: 0, y: 3 }
    expect(angleDegrees(A, B, C)).toBeCloseTo(90, 8)
  })

  it('returns NaN when a degenerate arm has zero length', () => {
    const A = { x: 0, y: 0 }
    expect(angleDegrees(A, A, { x: 1, y: 0 })).toBeNaN()
  })

  it('rejects an 89-degree angle as not right', () => {
    const vertex = { x: 0, y: 0 }
    const arm1 = { x: 1, y: 0 }
    const angle89Rad = (89 * Math.PI) / 180
    const arm2 = { x: Math.cos(angle89Rad), y: Math.sin(angle89Rad) }
    expect(angleDegrees(vertex, arm1, arm2)).toBeCloseTo(89, 5)
    expect(Math.abs(angleDegrees(vertex, arm1, arm2) - 90)).toBeGreaterThan(0.5)
  })
})

describe('isCollinear', () => {
  it('returns true for three collinear points', () => {
    expect(
      isCollinear([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ])
    ).toBe(true)
  })

  it('returns false for a valid triangle', () => {
    expect(
      isCollinear([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 3 },
      ])
    ).toBe(false)
  })
})

describe('euclideanLength', () => {
  it('computes the length of a 3-4-5 hypotenuse', () => {
    expect(euclideanLength({ x: 0, y: 0 }, { x: 4, y: 3 })).toBeCloseTo(5, 10)
  })
})

describe('buildDrawingModel', () => {
  it('is deterministic: two calls with the same spec produce identical output', () => {
    const a = buildDrawingModel(pythagorean)
    const b = buildDrawingModel(pythagorean)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('produces a right-angle square for the Pythagore triangle', () => {
    const model = buildDrawingModel(pythagorean)
    expect(model.rightAngleSquares).toHaveLength(1)
    expect(model.angleArcs).toHaveLength(0)
  })

  it('produces one polygon for the triangle', () => {
    const model = buildDrawingModel(pythagorean)
    expect(model.polygons).toHaveLength(1)
  })

  it('produces three dots and three labels for the three named points', () => {
    const model = buildDrawingModel(pythagorean)
    expect(model.dots).toHaveLength(3)
    expect(model.pointLabels).toHaveLength(3)
  })

  it('places the label for A at below-left (end anchor, hanging baseline)', () => {
    const model = buildDrawingModel(pythagorean)
    const labelA = model.pointLabels.find((l) => l.text === 'A')
    expect(labelA?.anchor).toBe('end')
    expect(labelA?.baseline).toBe('hanging')
  })

  it('label placement is stable across repeated calls', () => {
    const m1 = buildDrawingModel(pythagorean)
    const m2 = buildDrawingModel(pythagorean)
    expect(m1.pointLabels).toEqual(m2.pointLabels)
  })

  it('respects explicit coordinateSpace without cropping', () => {
    const spec: FigureSpec = {
      coordinateSpace: { xMin: 0, xMax: 10, yMin: 0, yMax: 1 },
      points: [{ name: 'P', x: 3, y: 0 }],
    }
    const model = buildDrawingModel(spec)
    // The dot for P should be inside the viewBox (not clipped)
    const dot = model.dots[0]
    expect(dot.cx).toBeGreaterThan(0)
    expect(dot.cx).toBeLessThan(320)
  })

  it('computes bounding box from points when coordinateSpace is absent', () => {
    const spec: FigureSpec = {
      points: [
        { name: 'A', x: 0, y: 0 },
        { name: 'B', x: 10, y: 0 },
      ],
    }
    const model = buildDrawingModel(spec)
    // Both dots should be inside the SVG viewport
    for (const dot of model.dots) {
      expect(dot.cx).toBeGreaterThan(0)
      expect(dot.cx).toBeLessThan(320)
      expect(dot.cy).toBeGreaterThan(0)
      expect(dot.cy).toBeLessThan(320)
    }
  })

  it('renders a circle defined by center+through', () => {
    const spec: FigureSpec = {
      points: [
        { name: 'O', x: 0, y: 0 },
        { name: 'A', x: 3, y: 0 },
      ],
      circles: [{ center: 'O', through: 'A' }],
    }
    const model = buildDrawingModel(spec)
    expect(model.circles).toHaveLength(1)
    expect(model.circles[0].r).toBeGreaterThan(0)
  })

  it('renders a non-right angle mark as an arc', () => {
    const spec: FigureSpec = {
      points: [
        { name: 'A', x: 0, y: 0 },
        { name: 'B', x: 2, y: 0 },
        { name: 'C', x: 1, y: 2 },
      ],
      angleMarks: [{ vertex: 'A', from: 'B', to: 'C' }],
    }
    const model = buildDrawingModel(spec)
    expect(model.angleArcs).toHaveLength(1)
    expect(model.rightAngleSquares).toHaveLength(0)
  })

  it('renders length ticks on a segment', () => {
    const spec: FigureSpec = {
      points: [
        { name: 'A', x: 0, y: 0 },
        { name: 'B', x: 4, y: 0 },
      ],
      segments: [{ from: 'A', to: 'B' }],
      lengthMarks: [{ segment: 'AB', ticks: 2 }],
    }
    const model = buildDrawingModel(spec)
    expect(model.lengthTicks).toHaveLength(1)
    expect(model.lengthTicks[0].lines).toHaveLength(2)
  })

  it('throws when a length mark references an unknown segment', () => {
    const spec: FigureSpec = {
      points: [
        { name: 'A', x: 0, y: 0 },
        { name: 'B', x: 1, y: 0 },
      ],
      lengthMarks: [{ segment: 'XY', ticks: 1 }],
    }
    expect(() => buildDrawingModel(spec)).toThrow('Segment "XY" not found')
  })

  it('renders a number line with derived ticks', () => {
    const spec: FigureSpec = {
      numberLines: [{ from: 0, to: 5, step: 1 }],
    }
    const model = buildDrawingModel(spec)
    expect(model.numberLines).toHaveLength(1)
    // 0, 1, 2, 3, 4, 5 → 6 ticks
    expect(model.numberLines[0].ticks.length).toBeGreaterThanOrEqual(6)
  })
})
