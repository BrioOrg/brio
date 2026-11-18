import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { FigureEditeur } from '../figure-editeur'
import type { Bloc } from '@/lib/cours-editeur'

function Harnais({ initial, onBloc }: { initial: Bloc; onBloc: (b: Bloc) => void }) {
  const [bloc, setBloc] = useState(initial)
  return (
    <FigureEditeur
      bloc={bloc}
      onModifier={(patch) => {
        const next = { ...bloc, ...patch }
        setBloc(next)
        onBloc(next)
      }}
    />
  )
}

function monter(spec: Record<string, unknown>) {
  let courant: Bloc = { id: 'f1', type: 'figure', alt: 'Triangle ABC rectangle en A', spec }
  render(<Harnais initial={courant} onBloc={(b) => (courant = b)} />)
  return () => courant.spec as Record<string, unknown>
}

const triangle = {
  points: [
    { name: 'A', x: 0, y: 0 },
    { name: 'B', x: 4, y: 0 },
    { name: 'C', x: 0, y: 3 },
  ],
  segments: [{ from: 'A', to: 'B' }],
  polygons: [{ vertices: ['A', 'B', 'C'] }],
}

describe('FigureEditeur — teintes (ADR 0037)', () => {
  it('colours a segment and previews it in its tone', () => {
    const spec = monter(triangle)
    fireEvent.change(screen.getByLabelText('Teinte du segment 1'), { target: { value: '1' } })
    expect(spec().segments).toEqual([{ from: 'A', to: 'B', tone: 1 }])
    expect(document.querySelector('svg line')?.getAttribute('class')).toBe('stroke-tone-1')
  })

  it('offers a soft fill only to a toned polygon, and drops it with the tone', () => {
    const spec = monter(triangle)
    expect(screen.queryByLabelText('Polygone 1 rempli d’un fond doux')).toBeNull()
    fireEvent.change(screen.getByLabelText('Teinte du polygone 1'), { target: { value: '3' } })
    fireEvent.click(screen.getByLabelText('Polygone 1 rempli d’un fond doux'))
    expect(spec().polygons).toEqual([{ vertices: ['A', 'B', 'C'], tone: 3, fill: 'soft' }])

    fireEvent.change(screen.getByLabelText('Teinte du polygone 1'), { target: { value: '' } })
    expect(spec().polygons).toEqual([{ vertices: ['A', 'B', 'C'] }])
  })

  it('colours a point back to ink', () => {
    const spec = monter({ ...triangle, points: [{ name: 'A', x: 0, y: 0, tone: 2 }] })
    fireEvent.change(screen.getByLabelText('Teinte du point A'), { target: { value: '' } })
    expect(spec().points).toEqual([{ name: 'A', x: 0, y: 0 }])
  })
})
