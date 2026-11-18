import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FigureSpec } from '@brio/content'

import { FigureRenderer } from '../figure-renderer'

// The 3e Pythagore triangle: a and b the sides of the right angle, c the hypotenuse (ADR 0037).
const spec: FigureSpec = {
  points: [
    { name: 'A', x: 0, y: 0 },
    { name: 'B', x: 4, y: 0 },
    { name: 'C', x: 0, y: 3, tone: 2 },
  ],
  polygons: [{ vertices: ['A', 'B', 'C'], tone: 3, fill: 'soft' }],
  segments: [
    { from: 'A', to: 'B', tone: 1 },
    { from: 'A', to: 'C' },
  ],
  angleMarks: [{ vertex: 'A', from: 'B', to: 'C', right: true, tone: 1 }],
  labels: [{ text: 'a', x: 2, y: -0.4, tone: 1 }],
}

function draw() {
  const { container } = render(<FigureRenderer spec={spec} alt="Triangle ABC rectangle en A." />)
  return container
}

describe('FigureRenderer — tones', () => {
  it('strokes a toned segment with its tone and leaves the others in ink', () => {
    const [ab, ac] = Array.from(draw().querySelectorAll('line'))
    expect(ab.getAttribute('class')).toBe('stroke-tone-1')
    expect(ac.getAttribute('class')).toBeNull()
    expect(ac.getAttribute('stroke')).toBe('currentColor')
  })

  it('fills a soft polygon with the soft fill of its tone, under its stroke', () => {
    const polygon = draw().querySelector('polygon')
    expect(polygon?.getAttribute('class')).toBe('stroke-tone-3 fill-tone-3-soft')
  })

  it('colours the right-angle mark, the label and the toned point', () => {
    const container = draw()
    expect(container.querySelector('polyline')?.getAttribute('class')).toBe('stroke-tone-1')
    const texts = Array.from(container.querySelectorAll('text'))
    expect(texts.find((t) => t.textContent === 'a')?.getAttribute('class')).toBe('fill-tone-1')
    expect(texts.find((t) => t.textContent === 'C')?.getAttribute('class')).toBe('fill-tone-2')
    expect(texts.find((t) => t.textContent === 'A')?.getAttribute('class')).toBeNull()
  })

  it('writes no colour value into the drawing', () => {
    expect(draw().innerHTML).not.toMatch(/#[0-9a-f]{3,6}|rgb\(/i)
  })
})
