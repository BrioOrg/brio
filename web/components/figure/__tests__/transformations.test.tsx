import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FigureSpec } from '@brio/content'

import { FigureRenderer } from '@/components/figure-renderer'
import { etapesParBloc, type ChapitreResponse } from '@/components/chapter-view'
import { problemesGeometrieFigure } from '@/lib/figure-geometrie'

const contexte = vi.hoisted(() => ({ valeur: null as unknown }))
vi.mock('@/components/chapitre-interactif/mode-context', () => ({
  useModeChapitre: () => contexte.valeur,
}))

const spec: FigureSpec = {
  points: [
    { name: 'A', x: 1, y: 1 },
    { name: 'B', x: 3, y: 1 },
    { name: 'C', x: 2, y: 3 },
    { name: 'O', x: 4, y: 2 },
    { name: 'U', x: 0, y: -1, dot: false, showName: false },
    { name: 'V', x: 2, y: -1, dot: false, showName: false },
  ],
  polygons: [{ vertices: ['A', 'B', 'C'] }],
  vectors: [{ from: 'U', to: 'V', label: '\\vec{u}' }],
  transformations: [
    {
      kind: 'symetrie-centrale',
      center: 'O',
      source: ['A', 'B', 'C'],
      show: { construction: true },
    },
  ],
}

function textes(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('text')).map((t) => t.textContent ?? '')
}

describe('FigureRenderer with transformations', () => {
  beforeEach(() => {
    contexte.valeur = null
  })

  it('draws the image named with primes, over its construction marks', () => {
    const { container } = render(<FigureRenderer spec={spec} alt="Un triangle et son image" />)
    expect(textes(container)).toEqual(
      expect.arrayContaining(['A', 'B', 'C', 'O', 'A′', 'B′', 'C′'])
    )
    const image = container.querySelector('[data-transformation="image"]')
    expect(image?.querySelectorAll('polygon')).toHaveLength(1)
    expect(image?.querySelectorAll('line[stroke-dasharray]').length).toBeGreaterThan(0)
  })

  it('typesets a vector name with KaTeX next to a filled arrowhead', () => {
    const { container } = render(<FigureRenderer spec={spec} alt="Un vecteur" />)
    expect(container.querySelector('foreignObject .katex')).not.toBeNull()
  })

  it('shows the source alone on the first step of the interactive mode', () => {
    contexte.valeur = { mode: 'interactif', etapesVisibles: { fig: 1 }, reducedMotion: true }
    const { container } = render(<FigureRenderer spec={spec} alt="Un triangle" blockId="fig" />)
    expect(container.querySelector('[data-transformation]')).toBeNull()
    expect(textes(container)).not.toContain('A′')
  })

  it('shows the image once its step is revealed, at once under reduced motion', () => {
    contexte.valeur = { mode: 'interactif', etapesVisibles: { fig: 2 }, reducedMotion: true }
    const { container } = render(<FigureRenderer spec={spec} alt="Un triangle" blockId="fig" />)
    expect(container.querySelector('[data-transformation="image"]')).not.toBeNull()
  })
})

describe('etapesParBloc', () => {
  it('counts the source then each image of a figure with transformations', () => {
    const chapitre = {
      sections: [
        {
          id: 's',
          title: 'S',
          blocks: [
            { id: 'fig', type: 'figure', spec },
            { id: 'plain', type: 'figure', spec: { points: [] } },
          ],
        },
      ],
    } as unknown as ChapitreResponse
    expect(etapesParBloc(chapitre)).toEqual({ fig: 2 })
  })
})

describe('problemesGeometrieFigure', () => {
  it('words the rules in French, on the field to fix', () => {
    expect(
      problemesGeometrieFigure({
        points: [{ name: 'A', x: 0, y: 0 }],
        transformations: [{ kind: 'rotation', center: 'O', angle: 0, source: ['A'] }],
      })
    ).toEqual([
      {
        code: 'FIGURE_UNKNOWN_POINT',
        champ: 'spec.transformations[0].center',
        message: 'Le point O n’existe pas : ajoute-le ou corrige son nom.',
      },
      {
        code: 'FIGURE_IDENTITY',
        champ: 'spec.transformations[0]',
        message: 'Cette rotation laisse chaque point à sa place : il n’y a pas d’image à tracer.',
      },
    ])
  })
})
