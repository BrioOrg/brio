import { describe, expect, it } from 'vitest'
import { buildDrawingModel, type FigureSpec } from '../figure'
import {
  affineAt,
  applyAffine,
  checkFigureGeometry,
  expandTransformations,
  imageName,
  imageOf,
  placementToward,
  svgAffineAt,
  type FigureTransformation,
  type TransformationMotion,
} from '../transformations'

const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 9)
  expect(a.y).toBeCloseTo(b.y, 9)
}

const map = new Map([
  ['O', { x: 1, y: 1 }],
  ['A', { x: 0, y: 0 }],
  ['B', { x: 0, y: 4 }],
  ['M', { x: 3, y: 2 }],
  ['U', { x: 2, y: -1 }],
])

const triangle: FigureSpec = {
  points: [
    { name: 'A', x: 1, y: 1 },
    { name: 'B', x: 3, y: 1 },
    { name: 'C', x: 2, y: 3 },
    { name: 'O', x: 5, y: 2 },
  ],
  polygons: [{ vertices: ['A', 'B', 'C'] }],
}

function withTransformation(t: FigureTransformation, extra: Partial<FigureSpec> = {}): FigureSpec {
  return { ...triangle, ...extra, transformations: [t] }
}

describe('imageOf', () => {
  const m = { x: 3, y: 2 }
  it('reflects a point in a line', () => {
    close(imageOf({ kind: 'symetrie-axiale', axis: ['A', 'B'], source: [] }, m, map), {
      x: -3,
      y: 2,
    })
  })
  it('takes the point symmetric about a centre', () => {
    close(imageOf({ kind: 'symetrie-centrale', center: 'O', source: [] }, m, map), { x: -1, y: 0 })
  })
  it('translates by the vector from → to', () => {
    close(imageOf({ kind: 'translation', from: 'A', to: 'U', source: [] }, m, map), { x: 5, y: 1 })
  })
  it('turns counter-clockwise for a positive angle', () => {
    close(imageOf({ kind: 'rotation', center: 'O', angle: 90, source: [] }, m, map), { x: 0, y: 3 })
    close(imageOf({ kind: 'rotation', center: 'O', angle: -90, source: [] }, m, map), {
      x: 2,
      y: -1,
    })
  })
  it('scales from the centre, through it when the ratio is negative', () => {
    close(imageOf({ kind: 'homothetie', center: 'O', ratio: -0.5, source: [] }, m, map), {
      x: 0,
      y: 0.5,
    })
  })
})

describe('affineAt', () => {
  const motions: TransformationMotion[] = [
    { kind: 'translation', dx: 2, dy: -1 },
    { kind: 'rotation', cx: 1, cy: 1, degrees: 90 },
    { kind: 'homothetie', cx: 1, cy: 1, ratio: -0.5 },
    { kind: 'symetrie-axiale', px: 0, py: 0, nx: 1, ny: 0 },
  ]
  it.each(motions)('starts at the identity ($kind)', (m) => {
    close(applyAffine(affineAt(m, 0), { x: 3, y: 2 }), { x: 3, y: 2 })
  })
  it('folds a reflection flat onto its axis halfway', () => {
    close(applyAffine(affineAt(motions[3], 0.5), { x: 3, y: 2 }), { x: 0, y: 2 })
  })
  it('keeps the centre of a rotation fixed all along', () => {
    close(applyAffine(affineAt(motions[1], 0.37), { x: 1, y: 1 }), { x: 1, y: 1 })
  })
})

describe('svgAffineAt', () => {
  const frames = [
    { ox: 100, oy: 200, sx: 20, sy: -20 },
    // A repère whose axes have different scales.
    { ox: 44, oy: 276, sx: 23, sy: -11.5 },
  ]
  it.each(frames)('is the logical map seen on screen', (f) => {
    const toSvg = (p: { x: number; y: number }) => ({ x: f.ox + f.sx * p.x, y: f.oy + f.sy * p.y })
    const motion: TransformationMotion = { kind: 'rotation', cx: 1, cy: 1, degrees: 90 }
    const p = { x: 3, y: 2 }
    for (const t of [0, 0.4, 1]) {
      close(
        applyAffine(svgAffineAt(motion, t, f), toSvg(p)),
        toSvg(applyAffine(affineAt(motion, t), p))
      )
    }
  })
})

describe('imageName', () => {
  it('adds a true prime, then turns two primes into a double prime', () => {
    expect(imageName('A')).toBe('A′')
    expect(imageName('A′')).toBe('A″')
    expect(imageName('A', '1')).toBe('A1')
  })
})

describe('placementToward', () => {
  it('maps a direction to the nearest of the eight placements', () => {
    expect(placementToward(1, 0)).toBe('right')
    expect(placementToward(-1, -1)).toBe('below-left')
    expect(placementToward(0, 1)).toBe('above')
    expect(placementToward(-1, 0.1)).toBe('left')
  })
})

describe('expandTransformations', () => {
  it('names the images and draws the image polygon', () => {
    const { points, layers } = expandTransformations(
      withTransformation({ kind: 'symetrie-centrale', center: 'O', source: ['A', 'B', 'C'] })
    )
    expect(points.map((p) => p.name)).toEqual(['A′', 'B′', 'C′'])
    expect(points.every((p) => p.dot === false && p.showName === false)).toBe(true)
    expect(layers[0].image.polygons).toEqual([{ vertices: ['A′', 'B′', 'C′'] }])
    const named = layers[0].image.points?.filter((p) => p.showName !== false)
    expect(named?.map((p) => [p.name, p.x, p.y])).toEqual([
      ['A′', 9, 3],
      ['B′', 7, 3],
      ['C′', 8, 1],
    ])
    // C′ is the lowest vertex of the image: its name goes below.
    expect(named?.[2].label?.placement).toBe('below')
  })

  it('leaves an invariant point unnamed: it is its own image', () => {
    const { layers } = expandTransformations({
      points: [
        { name: 'A', x: 0, y: 0 },
        { name: 'B', x: 0, y: 2 },
        { name: 'M', x: 0, y: 1 },
      ],
      lines: [{ through: ['A', 'B'] }],
      transformations: [{ kind: 'symetrie-axiale', axis: ['A', 'B'], source: ['M'] }],
    })
    const image = layers[0].image.points?.find((p) => p.name === 'M′')
    expect(image).toMatchObject({ dot: false, showName: false })
  })

  it('draws the coded perpendicular of a symétrie axiale', () => {
    const { layers } = expandTransformations(
      withTransformation(
        {
          kind: 'symetrie-axiale',
          axis: ['P', 'Q'],
          source: ['A', 'B'],
          show: { construction: true },
        },
        {
          points: [
            ...(triangle.points ?? []),
            { name: 'P', x: 4, y: 0 },
            { name: 'Q', x: 4, y: 4 },
          ],
        }
      )
    )
    const c = layers[0].construction
    expect(c.segments).toHaveLength(4)
    expect(c.segments?.every((s) => s.style === 'dashed')).toBe(true)
    expect(c.angleMarks?.every((m) => m.right)).toBe(true)
    expect(c.lengthMarks?.map((m) => m.ticks)).toEqual([1, 1, 2, 2])
    // The image figure has no polygon: the triangle's third vertex is not in the source.
    expect(layers[0].image.polygons).toEqual([])
    // The foot of the perpendicular from A is on the axis.
    const foot = c.points?.find((p) => p.name === c.segments?.[0].to)
    expect(foot).toMatchObject({ x: 4, y: 1 })
  })

  it('runs the arc of a clockwise rotation from the image back to the point', () => {
    const { layers } = expandTransformations(
      withTransformation({
        kind: 'rotation',
        center: 'O',
        angle: -90,
        source: ['A'],
        show: { construction: ['A'] },
      })
    )
    expect(layers[0].construction.arcs).toEqual([
      { center: 'O', from: 'A′', to: 'A', style: 'dashed' },
    ])
    expect(layers[0].construction.angleMarks?.[0].right).toBe(true)
  })

  it('takes an earlier image as a later source', () => {
    const { points } = expandTransformations({
      ...triangle,
      transformations: [
        { kind: 'translation', from: 'A', to: 'B', source: ['C'] },
        { kind: 'symetrie-centrale', center: 'O', source: ['C′'] },
      ],
    })
    expect(points.map((p) => [p.name, p.x, p.y])).toEqual([
      ['C′', 4, 3],
      ['C″', 6, 1],
    ])
  })
})

describe('buildDrawingModel with lines, vectors and transformations', () => {
  it('cuts a line to the canvas and names it near its far end', () => {
    const model = buildDrawingModel({
      points: [
        { name: 'A', x: 0, y: 0 },
        { name: 'B', x: 2, y: 1 },
      ],
      lines: [{ through: ['A', 'B'], label: '(d)' }],
    })
    const line = model.segments[0]
    for (const v of [line.x1, line.y1, line.x2, line.y2]) {
      expect(v).toBeGreaterThanOrEqual(4 - 1e-9)
      expect(v).toBeLessThanOrEqual(316 + 1e-9)
    }
    expect(Math.hypot(line.x2 - line.x1, line.y2 - line.y1)).toBeGreaterThan(300)
    expect(model.pointLabels.find((l) => l.text === '(d)')).toBeDefined()
  })

  it('starts a ray at its origin', () => {
    const model = buildDrawingModel({
      points: [
        { name: 'A', x: 0, y: 0 },
        { name: 'B', x: 1, y: 1 },
      ],
      rays: [{ from: 'A', through: 'B' }],
    })
    const dotA = model.dots[0]
    expect(model.segments[0].x1).toBeCloseTo(dotA.cx)
    expect(model.segments[0].y1).toBeCloseTo(dotA.cy)
  })

  it('stops a vector shaft at its arrowhead', () => {
    const model = buildDrawingModel({
      points: [
        { name: 'A', x: 0, y: 0 },
        { name: 'B', x: 4, y: 0 },
      ],
      vectors: [{ from: 'A', to: 'B', label: '\\vec{u}' }],
    })
    const v = model.vectors[0]
    const tip = model.dots[1]
    expect(v.head.startsWith(`${tip.cx.toFixed(2)},${tip.cy.toFixed(2)}`)).toBe(true)
    expect(tip.cx - v.x2).toBeCloseTo(7.5)
    expect(v.label?.tex).toBe('\\vec{u}')
  })

  it('draws an image in its own layer and lets the figure name the image points', () => {
    const model = buildDrawingModel({
      ...triangle,
      segments: [{ from: 'A', to: 'A′', style: 'dashed' }],
      transformations: [{ kind: 'symetrie-centrale', center: 'O', source: ['A', 'B', 'C'] }],
    })
    expect(model.transformations).toHaveLength(1)
    const layer = model.transformations[0]
    expect(layer.image.polygons).toHaveLength(1)
    expect(layer.image.pointLabels.map((l) => l.text)).toEqual(['A′', 'B′', 'C′'])
    expect(layer.ghost.polygons).toEqual(model.polygons)
    // The base figure does not name the images: the layer does, once revealed.
    expect(model.pointLabels.map((l) => l.text)).toEqual(['A', 'B', 'C', 'O'])
  })

  it('keeps a tone on the source and draws the image without it', () => {
    const model = buildDrawingModel({
      ...triangle,
      polygons: [{ vertices: ['A', 'B', 'C'], tone: 2, fill: 'soft' }],
      transformations: [{ kind: 'symetrie-centrale', center: 'O', source: ['A', 'B', 'C'] }],
    })
    expect(model.polygons[0].tone).toBe(2)
    expect(model.transformations[0].image.polygons[0].tone).toBeUndefined()
    expect(model.transformations[0].ghost.polygons[0].tone).toBeUndefined()
  })

  it('fits the frame to the images', () => {
    const without = buildDrawingModel(triangle)
    const withImage = buildDrawingModel(
      withTransformation({ kind: 'symetrie-centrale', center: 'O', source: ['A', 'B', 'C'] })
    )
    expect(withImage.polygons[0].points).not.toBe(without.polygons[0].points)
  })
})

describe('checkFigureGeometry', () => {
  const codes = (spec: unknown) => checkFigureGeometry(spec).map((i) => i.code)

  it('accepts a well-formed figure', () => {
    expect(
      codes({
        ...triangle,
        points: [...(triangle.points ?? []), { name: 'P', x: 4, y: 0 }, { name: 'Q', x: 4, y: 4 }],
        lines: [{ through: ['P', 'Q'], label: '(d)' }],
        vectors: [{ from: 'A', to: 'B', label: '\\vec{u}' }],
        transformations: [
          { kind: 'symetrie-axiale', axis: ['P', 'Q'], source: ['A', 'B', 'C'] },
          { kind: 'rotation', center: 'O', angle: 60, source: ['A′'] },
        ],
      })
    ).toEqual([])
  })

  it('reports unknown points, identities and taken names', () => {
    expect(
      codes({
        ...triangle,
        transformations: [
          { kind: 'symetrie-centrale', center: 'Z', source: ['A'] },
          { kind: 'rotation', center: 'O', angle: 0, source: ['A'] },
          { kind: 'homothetie', center: 'O', ratio: 0, source: ['A'] },
          { kind: 'homothetie', center: 'O', ratio: 1, source: ['B'] },
          { kind: 'translation', from: 'A', to: 'A', source: ['B'] },
          { kind: 'rotation', center: 'O', angle: 400, source: ['C'] },
        ],
      })
    ).toEqual(['UNKNOWN_POINT', 'IDENTITY', 'ZERO_RATIO', 'IDENTITY', 'IDENTITY', 'ANGLE_RANGE'])
    expect(
      codes({
        ...triangle,
        points: [...(triangle.points ?? []), { name: 'A′', x: 0, y: 0 }],
        transformations: [{ kind: 'symetrie-centrale', center: 'O', source: ['A', 'A'] }],
      })
    ).toEqual(['DUPLICATE_SOURCE', 'IMAGE_NAME_TAKEN'])
  })

  it('requires the axis of a symétrie axiale to be drawn', () => {
    expect(
      codes({
        ...triangle,
        transformations: [{ kind: 'symetrie-axiale', axis: ['A', 'B'], source: ['C'] }],
      })
    ).toEqual(['AXIS_NOT_DRAWN'])
  })

  it('refuses construction marks in a repère whose axes have different scales', () => {
    expect(
      codes({
        ...triangle,
        axes: { x: { from: -1, to: 9, step: 1 }, y: { from: -1, to: 4, step: 1 } },
        transformations: [
          { kind: 'symetrie-centrale', center: 'O', source: ['A'], show: { construction: true } },
          { kind: 'translation', from: 'A', to: 'B', source: ['C'], show: { construction: true } },
        ],
      })
    ).toEqual(['UNEQUAL_SCALES'])
  })

  it('checks lines, rays and vectors', () => {
    expect(
      codes({
        points: [
          { name: 'A', x: 0, y: 0 },
          { name: 'B', x: 0, y: 0 },
        ],
        lines: [{ through: ['A', 'B'], label: ' ' }],
        rays: [{ from: 'A', through: 'C' }],
        vectors: [{ from: 'A', to: 'B' }],
      })
    ).toEqual(['SAME_POINTS', 'SAME_POINTS', 'BLANK_LABEL', 'UNKNOWN_POINT'])
  })
})
