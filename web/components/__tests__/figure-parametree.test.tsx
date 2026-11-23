import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FigureSpec } from '@brio/content'

import { decoderEtat } from '@/lib/calculatrice-etat'

import { FigureParametree } from '../figure-parametree'
import { FigureRenderer } from '../figure-renderer'

const axes: FigureSpec['axes'] = {
  x: { from: -4, to: 4, step: 1 },
  y: { from: -4, to: 4, step: 1 },
}

describe('FigureRenderer with functions', () => {
  it('draws one path per continuous piece of the curve', () => {
    const { container } = render(
      <FigureRenderer
        spec={{ axes, functions: [{ name: 'f', expr: '1/x' }] }}
        alt="La courbe de la fonction inverse."
      />
    )
    expect(container.querySelectorAll('path[data-function="f"]')).toHaveLength(2)
  })

  it('names the curve 𝒞f with an italic subscript', () => {
    const { container } = render(
      <FigureRenderer
        spec={{ axes, functions: [{ name: 'f', expr: 'x²/2 − 1', label: true }] }}
        alt="Une parabole."
      />
    )
    const label = [...container.querySelectorAll('text')].find((t) =>
      t.textContent?.startsWith('\u{1D49E}')
    )
    expect(label?.textContent).toBe('\u{1D49E}f')
    expect(label?.querySelector('tspan')?.getAttribute('font-style')).toBe('italic')
  })

  it('writes the values of a reading next to the axes', () => {
    const { container } = render(
      <FigureRenderer
        spec={{
          axes,
          functions: [{ name: 'f', expr: '2x − 1' }],
          readings: [{ function: 'f', x: 1.5 }],
        }}
        alt="La droite de f et la lecture de f(1,5) = 2."
      />
    )
    const values = [...container.querySelectorAll('text.fill-accent-ink')].map((t) => t.textContent)
    expect(values).toEqual(['1,5', '2'])
    expect(container.querySelectorAll('line.stroke-accent')).toHaveLength(2)
  })
})

describe('FigureParametree', () => {
  const spec: FigureSpec = {
    axes,
    functions: [{ name: 'f', expr: 'ax' }],
    parameters: [{ name: 'a', min: -2, max: 2, step: 0.5, value: 1 }],
    readings: [{ function: 'f', x: 2 }],
  }

  it('shows a slider named after its parameter, at its value', () => {
    render(<FigureParametree spec={spec} alt="La droite d’équation y = ax." />)
    const slider = screen.getByRole('slider', { name: 'Paramètre a' })
    expect(slider).toHaveAttribute('aria-valuetext', 'a = 1')
    expect(slider).toHaveValue('1')
  })

  it('moves the curve and its reading with the slider', () => {
    const { container } = render(
      <FigureParametree spec={spec} alt="La droite d’équation y = ax." />
    )
    const before = container.querySelector('path[data-function="f"]')?.getAttribute('d')
    fireEvent.change(screen.getByRole('slider', { name: 'Paramètre a' }), {
      target: { value: '1.5' },
    })
    expect(screen.getByRole('slider', { name: 'Paramètre a' })).toHaveAttribute(
      'aria-valuetext',
      'a = 1,5'
    )
    expect(container.querySelector('path[data-function="f"]')?.getAttribute('d')).not.toBe(before)
    const values = [...container.querySelectorAll('text.fill-accent-ink')].map((t) => t.textContent)
    expect(values).toEqual(['2', '3'])
  })

  it('keeps the sliders out of print', () => {
    render(<FigureParametree spec={spec} alt="La droite d’équation y = ax." />)
    expect(screen.getByRole('slider').closest('.print\\:hidden')).not.toBeNull()
  })
})

describe('the link to the calculator under a figure', () => {
  const lien = { name: 'Ouvrir dans la calculatrice graphique' }

  it('is under a figure with functions, with the calculator address, not printed', () => {
    render(
      <FigureRenderer spec={{ axes, functions: [{ name: 'f', expr: '2x' }] }} alt="Une droite." />
    )
    const a = screen.getByRole('link', lien)
    expect(a.textContent).toBe('Ouvrir dans la calculatrice')
    expect(a.getAttribute('href')).toMatch(/^\/explorer\/calculatrice\?e=/)
    expect(a.closest('p')?.className).toContain('print:hidden')
  })

  it('is absent from a figure without functions, and from a preview', () => {
    const { rerender } = render(<FigureRenderer spec={{ axes }} alt="Un repère." />)
    expect(screen.queryByRole('link', lien)).toBeNull()
    rerender(
      <FigureRenderer
        spec={{ axes, functions: [{ name: 'f', expr: '2x' }] }}
        alt="Une droite."
        sansLienCalculatrice
      />
    )
    expect(screen.queryByRole('link', lien)).toBeNull()
  })

  it('carries the current slider value, which follows the slider', () => {
    render(
      <FigureParametree
        spec={{
          axes,
          functions: [{ name: 'f', expr: 'ax' }],
          parameters: [{ name: 'a', min: 0, max: 4, step: 1, value: 1 }],
        }}
        alt="Une droite."
      />
    )
    const decode = () => {
      const href = screen.getByRole('link', lien).getAttribute('href')!
      return decoderEtat(new URL(href, 'http://x').searchParams.get('e')).lignes[1].texte
    }
    expect(decode()).toBe('a = 1')
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } })
    expect(decode()).toBe('a = 3')
  })
})
