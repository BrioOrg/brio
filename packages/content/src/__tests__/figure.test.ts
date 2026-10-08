import { describe, expect, it } from 'vitest'
import {
  angleDegrees,
  buildDrawingModel,
  euclideanLength,
  expandSolid,
  formatNumber,
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

describe('formatNumber', () => {
  it('writes a negative number with a true minus sign', () => {
    expect(formatNumber(-3)).toBe('\u22123')
  })

  it('writes a decimal with a comma', () => {
    expect(formatNumber(0.5)).toBe('0,5')
    expect(formatNumber(-1.5)).toBe('\u22121,5')
  })

  it('rounds away floating-point noise', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0,3')
  })

  it('writes zero without a sign', () => {
    expect(formatNumber(-0)).toBe('0')
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

  it('labels number-line ticks in French notation', () => {
    const model = buildDrawingModel({ numberLines: [{ from: -1, to: 1, step: 0.5 }] })
    const labels = model.numberLines[0].ticks.map((t) => t.label)
    expect(labels).toEqual(['\u22121', '\u22120,5', '0', '0,5', '1'])
  })

  it('puts a mark label above the line and the numbers below it', () => {
    const model = buildDrawingModel({
      numberLines: [{ from: 0, to: 4, step: 1, marks: [{ value: 2, label: 'A' }] }],
    })
    const ticks = model.numberLines[0].ticks
    const number = ticks.find((t) => t.label === '2')
    const mark = ticks.find((t) => t.label === 'A')
    expect(number?.labelBaseline).toBe('hanging')
    expect(mark?.labelBaseline).toBe('auto')
    expect(mark!.labelY).toBeLessThan(number!.labelY)
  })
})

describe('buildDrawingModel — repère (axes)', () => {
  const repere: FigureSpec = {
    axes: {
      x: { from: 0, to: 24, step: 2, labelEvery: 4, title: 'Heure (h)' },
      y: { from: -4, to: 20, step: 2, labelEvery: 4, title: 'Température (°C)' },
      grid: true,
    },
  }

  it('returns no axes for a figure without a repère', () => {
    expect(buildDrawingModel(pythagorean).axes).toBeNull()
  })

  it('puts a tick on every multiple of step, aligned on the origin', () => {
    const axes = buildDrawingModel(repere).axes!
    expect(axes.x.ticks).toHaveLength(13) // 0, 2, …, 24
    expect(axes.y.ticks).toHaveLength(13) // −4, −2, …, 20
  })

  it('labels every labelEvery in French notation, never 0 on an axis', () => {
    const axes = buildDrawingModel(repere).axes!
    const yLabels = axes.y.ticks.flatMap((t) => (t.label ? [t.label.text] : []))
    expect(yLabels).toEqual(['\u22124', '4', '8', '12', '16', '20'])
    const xLabels = axes.x.ticks.flatMap((t) => (t.label ? [t.label.text] : []))
    expect(xLabels).not.toContain('0')
    expect(axes.origin?.text).toBe('0')
  })

  it('places the single 0 below-left of the origin', () => {
    const axes = buildDrawingModel(repere).axes!
    expect(axes.origin!.x).toBeLessThan(axes.y.line.x1)
    expect(axes.origin!.y).toBeGreaterThan(axes.x.line.y1)
  })

  it('lets a named point at the origin replace the 0', () => {
    const named = buildDrawingModel({ ...repere, points: [{ name: 'O', x: 0, y: 0 }] })
    expect(named.axes!.origin).toBeNull()
    const hidden = buildDrawingModel({
      ...repere,
      points: [{ name: 'o', x: 0, y: 0, showName: false }],
    })
    expect(hidden.axes!.origin?.text).toBe('0')
  })

  it('draws one grid line per step of each axis', () => {
    expect(buildDrawingModel(repere).axes!.grid).toHaveLength(13 + 13)
    const noGrid = { ...repere, axes: { ...repere.axes!, grid: false } }
    expect(buildDrawingModel(noGrid).axes!.grid).toHaveLength(0)
  })

  it('gives each axis its own scale and fills the frame', () => {
    const model = buildDrawingModel({
      axes: { x: { from: 0, to: 5, step: 1 }, y: { from: 0, to: 200, step: 50 } },
      points: [
        { name: 'O', x: 0, y: 0 },
        { name: 'M', x: 5, y: 200 },
      ],
    })
    const [o, m] = model.dots
    // Same pixel extent on both axes although the spans differ by 40×
    expect(m.cx - o.cx).toBeCloseTo(o.cy - m.cy, 6)
  })

  it('keeps one scale when both spans are equal', () => {
    const model = buildDrawingModel({
      axes: { x: { from: -3, to: 3, step: 1 }, y: { from: -3, to: 3, step: 1 } },
      points: [
        { name: 'A', x: 1, y: 0 },
        { name: 'B', x: 0, y: 1 },
        { name: 'O', x: 0, y: 0 },
      ],
    })
    const [a, b, o] = model.dots
    expect(a.cx - o.cx).toBeCloseTo(o.cy - b.cy, 6)
  })

  it('throws a readable error for an axis that cannot be drawn', () => {
    const flat = { axes: { x: { from: 0, to: 0, step: 1 }, y: { from: 0, to: 5, step: 1 } } }
    expect(() => buildDrawingModel(flat)).toThrow('Axe des abscisses')
    const noOrigin = { axes: { x: { from: 0, to: 5, step: 1 }, y: { from: 2, to: 5, step: 1 } } }
    expect(() => buildDrawingModel(noOrigin)).toThrow('0 doit être entre')
    const tooDense = {
      axes: { x: { from: 0, to: 5, step: 0.001 }, y: { from: 0, to: 5, step: 1 } },
    }
    expect(() => buildDrawingModel(tooDense)).toThrow('trop de graduations')
  })

  it('titles each axis at its arrow', () => {
    const axes = buildDrawingModel(repere).axes!
    expect(axes.x.title?.text).toBe('Heure (h)')
    expect(axes.y.title?.text).toBe('Température (°C)')
    expect(axes.x.title?.x).toBeCloseTo(axes.x.line.x2, 6)
  })
})

describe('buildDrawingModel — hidden points and polylines', () => {
  it('hides the dot and the name on request', () => {
    const model = buildDrawingModel({
      points: [
        { name: 'A', x: 0, y: 0 },
        { name: 'c1', x: 1, y: 1, dot: false, showName: false },
        { name: 'B', x: 2, y: 0, dot: false },
      ],
    })
    expect(model.dots).toHaveLength(1) // only A keeps its dot
    expect(model.pointLabels.map((l) => l.text)).toEqual(['A', 'B'])
  })

  it('draws a polyline through its points in order', () => {
    const model = buildDrawingModel({
      points: [
        { name: 'P', x: 0, y: 0 },
        { name: 'Q', x: 1, y: 1 },
        { name: 'R', x: 2, y: 0 },
      ],
      polylines: [{ points: ['P', 'Q', 'R'] }],
    })
    expect(model.polylines).toHaveLength(1)
    expect(model.polylines[0].points.split(' ')).toHaveLength(3)
  })

  it('throws when a polyline names an unknown point', () => {
    expect(() =>
      buildDrawingModel({
        points: [{ name: 'P', x: 0, y: 0 }],
        polylines: [{ points: ['P', 'Z'] }],
      })
    ).toThrow('Point "Z" not found')
  })
})

describe('line styles', () => {
  const square: FigureSpec = {
    points: [
      { name: 'A', x: 0, y: 0 },
      { name: 'B', x: 1, y: 0 },
      { name: 'C', x: 1, y: 1 },
    ],
    segments: [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C', style: 'dashed' },
    ],
    polygons: [{ vertices: ['A', 'B', 'C'], style: 'dashed' }],
    polylines: [{ points: ['A', 'C'] }],
  }

  it('marks dashed segments, polygons and polylines, and only those', () => {
    const model = buildDrawingModel(square)
    expect(model.segments.map((s) => s.dashed)).toEqual([false, true])
    expect(model.polygons[0].dashed).toBe(true)
    expect(model.polylines[0].dashed).toBe(false)
  })
})

describe('expandSolid', () => {
  const hidden = (drawing: ReturnType<typeof expandSolid>) =>
    drawing.edges.filter((e) => e.hidden).map((e) => [e.from, e.to])

  it('hides the three edges of the back bottom-left vertex of a cube', () => {
    const cube = expandSolid({ kind: 'cube', x: 0, y: 0, edge: 2 })
    expect(cube.edges).toHaveLength(12)
    // Vertices: A B C D (front), E F G H (back); E is behind A.
    expect(hidden(cube)).toEqual([
      [4, 5], // EF, back bottom
      [0, 4], // AE, receding from A
      [7, 4], // HE, back left
    ])
  })

  it('projects the back face along the receding direction, reduced', () => {
    const pave = expandSolid({ kind: 'pave', x: 1, y: 2, width: 4, height: 3, depth: 2 })
    const offset = 2 * 0.5 * Math.cos(Math.PI / 4)
    expect(pave.vertices[4].x).toBeCloseTo(1 + offset, 9)
    expect(pave.vertices[4].y).toBeCloseTo(2 + offset, 9)
    expect(pave.vertices[6].x).toBeCloseTo(5 + offset, 9)
    expect(pave.vertices[6].y).toBeCloseTo(5 + offset, 9)
  })

  it('hides the back bottom-right vertex instead when the receding edges go up-left', () => {
    const cube = expandSolid({ kind: 'cube', x: 0, y: 0, edge: 1, angle: 135 })
    expect(hidden(cube)).toEqual([
      [4, 5], // EF, back bottom
      [5, 6], // FG, back right
      [1, 5], // BF, receding from B
    ])
  })

  it('does not depend on the orientation the base is written in', () => {
    const base = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 0, y: 2 },
    ]
    const ccw = expandSolid({ kind: 'prisme', x: 0, y: 0, base, depth: 4 })
    const cw = expandSolid({ kind: 'prisme', x: 0, y: 0, base: [...base].reverse(), depth: 4 })
    expect(ccw.edges).toHaveLength(9)
    expect(hidden(ccw)).toHaveLength(hidden(cw).length)
  })

  it('hides only the receding edge and back side behind a right-angled triangular prism', () => {
    // Right angle at the bottom-left: the bottom and left sides face away from the viewer.
    const prism = expandSolid({
      kind: 'prisme',
      x: 0,
      y: 0,
      base: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 0, y: 2 },
      ],
      depth: 4,
    })
    expect(hidden(prism)).toEqual([
      [3, 4], // back bottom side
      [0, 3], // receding from the right angle
      [5, 3], // back left side
    ])
  })

  it('draws an upright cylinder with the back half of its lower base dashed', () => {
    const cyl = expandSolid({ kind: 'cylindre', x: 0, y: 0, radius: 2, height: 5 })
    expect(cyl.edges.every((e) => !e.hidden)).toBe(true)
    expect(cyl.arcs.filter((a) => a.hidden)).toEqual([
      expect.objectContaining({ cy: 0, half: 'upper' }),
    ])
    expect(cyl.arcs[0].ry).toBeCloseTo(2 * 0.5 * Math.sin(Math.PI / 4), 9)
  })
})

describe('buildDrawingModel with solids', () => {
  it('turns solid edges into segments, dashed when hidden', () => {
    const model = buildDrawingModel({ solids: [{ kind: 'cube', x: 0, y: 0, edge: 2 }] })
    expect(model.segments).toHaveLength(12)
    expect(model.segments.filter((s) => s.dashed)).toHaveLength(3)
  })

  it('fits the whole solid in the frame', () => {
    const model = buildDrawingModel({
      solids: [{ kind: 'pave', x: 0, y: 0, width: 4, height: 3, depth: 2 }],
    })
    for (const s of model.segments) {
      for (const v of [s.x1, s.y1, s.x2, s.y2]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(320)
      }
    }
  })

  it('writes vertex names away from the solid, hidden vertices included', () => {
    const model = buildDrawingModel({
      solids: [
        {
          kind: 'cube',
          x: 0,
          y: 0,
          edge: 2,
          names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        },
      ],
    })
    expect(model.pointLabels.map((l) => l.text)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    expect(model.dots).toHaveLength(0)
    const a = model.pointLabels[0]
    expect(a.anchor).toBe('end') // A is bottom-left: its name goes to the left
  })

  it('draws the cylinder bases as four half-ellipses, one dashed', () => {
    const model = buildDrawingModel({
      solids: [{ kind: 'cylindre', x: 0, y: 0, radius: 2, height: 5 }],
    })
    expect(model.curves).toHaveLength(4)
    expect(model.curves.filter((c) => c.dashed)).toHaveLength(1)
    expect(model.curves[0].d).toMatch(/^M [\d.]+ [\d.]+ A [\d.]+ [\d.]+ 0 0 0 /)
    expect(model.segments).toHaveLength(2)
  })
})
