import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FigureRenderer } from '../figure-renderer'
import type { FigureSpec } from '@brio/content'

// 3-4-5 right triangle: right angle at A, hypotenuse BC.
// Mirrors the figure spec used in theoreme-de-pythagore.json.
const pythagoreanSpec: FigureSpec = {
  points: [
    { name: 'A', x: 0, y: 0, label: { placement: 'below-left' } },
    { name: 'B', x: 4, y: 0, label: { placement: 'below-right' } },
    { name: 'C', x: 0, y: 3, label: { placement: 'above-left' } },
  ],
  polygons: [{ vertices: ['A', 'B', 'C'] }],
  angleMarks: [{ vertex: 'A', from: 'B', to: 'C', right: true }],
}

describe('FigureRenderer', () => {
  it('renders an svg with role="img"', () => {
    const { getByRole } = render(
      <FigureRenderer
        spec={pythagoreanSpec}
        alt="Triangle rectangle ABC, l'angle droit est en A."
      />
    )
    expect(getByRole('img')).toBeDefined()
  })

  it('exposes the alt text via <title>', () => {
    const { container } = render(
      <FigureRenderer
        spec={pythagoreanSpec}
        alt="Triangle rectangle ABC, l'angle droit est en A."
      />
    )
    const title = container.querySelector('svg title')
    expect(title?.textContent).toBe("Triangle rectangle ABC, l'angle droit est en A.")
  })

  it('renders a <desc> when a caption is provided', () => {
    const { container } = render(
      <FigureRenderer
        spec={pythagoreanSpec}
        alt="Triangle ABC"
        caption="Le triangle rectangle ABC, rectangle en A."
      />
    )
    const desc = container.querySelector('svg desc')
    expect(desc?.textContent).toBe('Le triangle rectangle ABC, rectangle en A.')
  })

  it('renders no <desc> when caption is absent', () => {
    const { container } = render(<FigureRenderer spec={pythagoreanSpec} alt="Triangle ABC" />)
    expect(container.querySelector('svg desc')).toBeNull()
  })

  it('snapshot: Pythagore triangle SVG is stable', () => {
    const { container } = render(
      <FigureRenderer
        spec={pythagoreanSpec}
        alt="Triangle rectangle ABC, l'angle droit est en A et l'hypoténuse est le côté BC."
        caption="Le triangle rectangle ABC, rectangle en A."
      />
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('draws a repère: grid, two arrowed axes, French numbers, a single 0', () => {
    const { container } = render(
      <FigureRenderer
        alt="Repère"
        spec={{
          axes: {
            x: { from: -2, to: 2, step: 1, title: 'x' },
            y: { from: -2, to: 2, step: 0.5, labelEvery: 1 },
            grid: true,
          },
        }}
      />
    )
    expect(container.querySelectorAll('line.stroke-line')).toHaveLength(5 + 9)
    expect(container.querySelectorAll('polygon')).toHaveLength(2) // two arrowheads
    const texts = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(texts).toContain('\u22122')
    expect(texts.filter((t) => t === '0')).toHaveLength(1)
    expect(texts).toContain('x')
  })

  it('draws a polyline and no dot for a hidden point', () => {
    const { container } = render(
      <FigureRenderer
        alt="Courbe"
        spec={{
          points: [
            { name: 'a', x: 0, y: 0, dot: false, showName: false },
            { name: 'b', x: 1, y: 2, dot: false, showName: false },
            { name: 'c', x: 2, y: 1, dot: false, showName: false },
          ],
          polylines: [{ points: ['a', 'b', 'c'] }],
        }}
      />
    )
    expect(container.querySelectorAll('polyline')).toHaveLength(1)
    expect(container.querySelectorAll('circle')).toHaveLength(0)
    expect(container.querySelectorAll('text')).toHaveLength(0)
  })

  it('draws the hidden edges of a cube dashed, and only those', () => {
    const { container } = render(
      <FigureRenderer
        spec={{ solids: [{ kind: 'cube', x: 0, y: 0, edge: 2 }] }}
        alt="Un cube en perspective cavalière."
      />
    )
    const lines = Array.from(container.querySelectorAll('line'))
    expect(lines).toHaveLength(12)
    expect(lines.filter((l) => l.hasAttribute('stroke-dasharray'))).toHaveLength(3)
  })

  it('draws a cylinder with one dashed half-ellipse', () => {
    const { container } = render(
      <FigureRenderer
        spec={{ solids: [{ kind: 'cylindre', x: 0, y: 0, radius: 2, height: 5 }] }}
        alt="Un cylindre."
      />
    )
    const paths = Array.from(container.querySelectorAll('path'))
    expect(paths).toHaveLength(4)
    expect(paths.filter((p) => p.hasAttribute('stroke-dasharray'))).toHaveLength(1)
  })
})
