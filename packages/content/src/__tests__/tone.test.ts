import { describe, expect, it } from 'vitest'

import { buildDrawingModel, type FigureSpec } from '../figure'
import { MAX_TONES_PER_BLOCK, checkTones, isTone, toneArguments } from '../tone'

// Pythagore as the 3e chapter colours it: a and b, the sides of the right angle, and c, the
// hypotenuse, wear the same tones in the triangle and in a² + b² = c².
const triangle: FigureSpec = {
  points: [
    { name: 'A', x: 0, y: 0 },
    { name: 'B', x: 4, y: 0 },
    { name: 'C', x: 0, y: 3, tone: 2 },
  ],
  segments: [
    { from: 'A', to: 'B', tone: 1 },
    { from: 'A', to: 'C', tone: 2 },
    { from: 'B', to: 'C', tone: 3, style: 'dashed' },
  ],
  polygons: [{ vertices: ['A', 'B', 'C'], tone: 1, fill: 'soft' }],
  circles: [{ center: 'A', radius: 1, tone: 4 }],
  arcs: [{ center: 'A', radius: 2, startAngle: 0, endAngle: 90, tone: 2 }],
  angleMarks: [
    { vertex: 'A', from: 'B', to: 'C', right: true, tone: 1 },
    { vertex: 'B', from: 'C', to: 'A', tone: 3 },
  ],
  labels: [{ text: 'a', x: 2, y: -0.4, tone: 1 }],
}

describe('buildDrawingModel — tones', () => {
  const model = buildDrawingModel(triangle)

  it('carries the tone of every toned element into the drawing', () => {
    expect(model.segments.map((s) => s.tone)).toEqual([1, 2, 3])
    expect(model.segments[2].dashed).toBe(true)
    expect(model.circles[0].tone).toBe(4)
    expect(model.curves[0].tone).toBe(2)
    expect(model.rightAngleSquares[0].tone).toBe(1)
    expect(model.angleArcs[0].tone).toBe(3)
    expect(model.freeLabels[0].tone).toBe(1)
  })

  it('colours the dot and the name of a toned point only', () => {
    expect(model.dots.map((d) => d.tone)).toEqual([undefined, undefined, 2])
    expect(model.pointLabels.find((l) => l.text === 'C')?.tone).toBe(2)
    expect(model.pointLabels.find((l) => l.text === 'A')).not.toHaveProperty('tone')
  })

  it('fills a polygon softly only when it has a tone', () => {
    expect(model.polygons[0]).toMatchObject({ tone: 1, soft: true })
    const untoned = buildDrawingModel({
      points: triangle.points,
      polygons: [{ vertices: ['A', 'B', 'C'], fill: 'soft' }],
    })
    expect(untoned.polygons[0]).not.toHaveProperty('soft')
  })

  it('leaves an all-ink figure without any tone field', () => {
    const ink = buildDrawingModel({
      points: [
        { name: 'A', x: 0, y: 0 },
        { name: 'B', x: 1, y: 0 },
      ],
      segments: [{ from: 'A', to: 'B' }],
    })
    expect(ink.segments[0]).not.toHaveProperty('tone')
    expect(ink.dots[0]).not.toHaveProperty('tone')
  })
})

describe('toneArguments', () => {
  it('reads the first argument of every \\tone', () => {
    expect(toneArguments('\\tone{1}{a}^2 + \\tone{2}{b}^2 = \\tone{3}{c}^2')).toEqual([
      '1',
      '2',
      '3',
    ])
  })

  it('reads an unbraced argument and spaces as TeX does', () => {
    expect(toneArguments('\\tone1{a} + \\tone {2}{b}')).toEqual(['1', '2'])
  })

  it('ignores another command that starts with tone', () => {
    expect(toneArguments('\\tones{1}')).toEqual([])
  })
})

describe('checkTones', () => {
  it('collects the tones of formulas and figures, in order', () => {
    const block = {
      type: 'steps',
      steps: [{ text: 'On a $\\tone{2}{b} = 3$.', formula: '\\tone{1}{a}^2' }],
    }
    expect(checkTones(block)).toEqual({ tones: [1, 2], issues: [] })
    expect(checkTones({ type: 'figure', spec: triangle }).tones).toEqual([1, 2, 3, 4])
  })

  it('accepts a tone used in a figure and in no formula', () => {
    const block = { type: 'figure', spec: { segments: [{ from: 'A', to: 'B', tone: 4 }] } }
    expect(checkTones(block).issues).toEqual([])
  })

  it('reports a tone outside 1…4 where it is written', () => {
    const block = { type: 'formula', latex: '\\tone{5}{a} + \\tone{x}{b} + \\tone{0}{c}' }
    expect(checkTones(block).issues).toEqual([
      { code: 'UNKNOWN_TONE', path: 'latex', value: '5' },
      { code: 'UNKNOWN_TONE', path: 'latex', value: 'x' },
      { code: 'UNKNOWN_TONE', path: 'latex', value: '0' },
    ])
    const figure = { spec: { segments: [{ from: 'A', to: 'B', tone: 7 }] } }
    expect(checkTones(figure).issues).toEqual([
      { code: 'UNKNOWN_TONE', path: 'spec.segments[0].tone', value: '7' },
    ])
  })

  it(`warns past ${MAX_TONES_PER_BLOCK} distinct tones in one block`, () => {
    expect(checkTones({ spec: triangle }).issues).toEqual([
      { code: 'TOO_MANY_TONES', path: '', tones: [1, 2, 3, 4], max: 3 },
    ])
    const repeated = { latex: '\\tone{1}{a} \\tone{1}{b} \\tone{2}{c} \\tone{3}{d}' }
    expect(checkTones(repeated).issues).toEqual([])
  })
})

describe('isTone', () => {
  it('accepts 1 to 4 only', () => {
    expect([0, 1, 2, 3, 4, 5, 1.5, '1'].map(isTone)).toEqual([
      false,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
    ])
  })
})
