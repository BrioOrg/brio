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
})
