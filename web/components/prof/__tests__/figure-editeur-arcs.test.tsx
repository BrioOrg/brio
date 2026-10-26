import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { FigureEditeur } from '../figure-editeur'
import type { Bloc } from '@/lib/cours-editeur'

// Holds the block like the course editor does, and exposes it to the assertions.
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

function monter(spec: Record<string, unknown> = {}) {
  let courant: Bloc = { id: 'f1', type: 'figure', alt: 'Un demi-disque', spec }
  render(<Harnais initial={courant} onBloc={(b) => (courant = b)} />)
  return () => courant.spec as Record<string, unknown>
}

const diametre = {
  points: [
    { name: 'O', x: 0, y: 0 },
    { name: 'A', x: -4, y: 0 },
    { name: 'B', x: 4, y: 0 },
  ],
}

describe('FigureEditeur — arcs', () => {
  it('adds an arc by points, closes it by its chord and previews it', () => {
    const spec = monter(diametre)
    fireEvent.click(screen.getByRole('button', { name: '＋ Arc' }))
    fireEvent.change(screen.getByLabelText('Arc 1 — centre'), { target: { value: 'O' } })
    fireEvent.change(screen.getByLabelText('Arc 1 — départ'), { target: { value: 'B' } })
    fireEvent.change(screen.getByLabelText('Arc 1 — arrivée'), { target: { value: 'A' } })
    fireEvent.change(screen.getByLabelText('Arc 1 — fermeture'), { target: { value: 'chord' } })
    expect(spec().arcs).toEqual([{ center: 'O', from: 'B', to: 'A', closed: 'chord' }])
    const path = document.querySelector('svg path')
    expect(path?.getAttribute('d')).toMatch(/ Z$/)
  })

  it('switches to radius and angles, keeping the centre, the closing and the style', () => {
    const spec = monter({
      ...diametre,
      arcs: [{ center: 'O', from: 'B', to: 'A', closed: 'sector', style: 'dashed' }],
    })
    fireEvent.change(screen.getByLabelText('Arc 1 — défini par'), { target: { value: 'angles' } })
    expect(spec().arcs).toEqual([
      {
        center: 'O',
        closed: 'sector',
        style: 'dashed',
        radius: 1,
        startAngle: 0,
        endAngle: 180,
      },
    ])
    fireEvent.change(screen.getByLabelText('Arc 1 — angle de fin (degrés)'), {
      target: { value: '90' },
    })
    expect((spec().arcs as Array<{ endAngle: number }>)[0].endAngle).toBe(90)
  })

  it('shows a readable message instead of a preview while the angles are impossible', () => {
    monter({
      ...diametre,
      arcs: [{ center: 'O', radius: 2, startAngle: 90, endAngle: 30 }],
    })
    expect(screen.getByText(/Aperçu indisponible.*angle de fin/)).toBeInTheDocument()
  })
})
