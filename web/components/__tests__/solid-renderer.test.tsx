import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SolidSpec } from '@brio/content'
import { SolidRenderer } from '../solid-renderer'

const cube: SolidSpec = { kind: 'cube', edge: 3, names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] }

function visiblePath(container: HTMLElement): string {
  // The visible edges: solid strokes in ink, the last unfilled path without a dash.
  const paths = [...container.querySelectorAll('path')].filter(
    (p) => p.getAttribute('stroke') === 'currentColor' && !p.getAttribute('stroke-dasharray')
  )
  return paths[0]?.getAttribute('d') ?? ''
}

function reduceMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => vi.unstubAllGlobals())

describe('SolidRenderer', () => {
  it('should expose the alt text as the accessible name of the drawing', () => {
    render(<SolidRenderer spec={cube} alt="Un cube ABCDEFGH" />)
    expect(screen.getByRole('img', { name: 'Un cube ABCDEFGH' })).toBeDefined()
  })

  it('should be focusable and tell how to turn it, in French', () => {
    render(<SolidRenderer spec={cube} alt="Un cube" />)
    const group = screen.getByRole('group', { name: 'Un cube' })
    expect(group.tabIndex).toBe(0)
    expect(group.getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByText(/flèches du clavier/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Revenir à la vue de départ' })).toBeDefined()
  })

  it('should name every vertex', () => {
    const { container } = render(<SolidRenderer spec={cube} alt="Un cube" />)
    const names = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(names).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
  })

  it('should dash the hidden edges', () => {
    const { container } = render(<SolidRenderer spec={cube} alt="Un cube" />)
    const dashed = container.querySelector('path[stroke-dasharray="5 4"]')
    expect(dashed?.getAttribute('d')).toMatch(/^M/)
  })

  it('should turn with the arrow keys, and come back to the starting view', () => {
    reduceMotion(true)
    const { container } = render(<SolidRenderer spec={cube} alt="Un cube" />)
    const start = visiblePath(container)
    const group = screen.getByRole('group', { name: 'Un cube' })

    const right = fireEvent.keyDown(group, { key: 'ArrowRight' })
    // The key is consumed: the slide mode does not change slide.
    expect(right).toBe(false)
    expect(visiblePath(container)).not.toBe(start)

    fireEvent.click(screen.getByRole('button', { name: 'Revenir à la vue de départ' }))
    expect(visiblePath(container)).toBe(start)
  })

  it('should leave other keys alone', () => {
    render(<SolidRenderer spec={cube} alt="Un cube" />)
    expect(fireEvent.keyDown(screen.getByRole('group'), { key: 'a' })).toBe(true)
  })

  it('should draw the section of a cone in the maths tone', () => {
    const { container } = render(
      <SolidRenderer
        spec={{ kind: 'cone', radius: 2, height: 4, section: { at: 1 } }}
        alt="Un cône coupé"
      />
    )
    const fill = container.querySelector('path.fill-tone-1-soft\\/80')
    expect(fill?.getAttribute('d')).toMatch(/^M/)
  })
})
