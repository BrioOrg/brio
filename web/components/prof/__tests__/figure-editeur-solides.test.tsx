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
  let courant: Bloc = { id: 'f1', type: 'figure', alt: 'Un solide', spec }
  render(<Harnais initial={courant} onBloc={(b) => (courant = b)} />)
  return () => courant.spec as Record<string, unknown>
}

describe('FigureEditeur — solides et pointillés', () => {
  it('adds a pavé droit and previews its hidden edges dashed', () => {
    const spec = monter()
    fireEvent.click(screen.getByRole('button', { name: '＋ Solide' }))
    expect(spec().solids).toEqual([{ kind: 'pave', x: 0, y: 0, width: 4, height: 3, depth: 2 }])
    const lines = Array.from(document.querySelectorAll('svg line'))
    expect(lines.filter((l) => l.hasAttribute('stroke-dasharray'))).toHaveLength(3)
  })

  it('switching to a cylinder keeps the position and drops the pavé dimensions', () => {
    const spec = monter({
      solids: [{ kind: 'pave', x: 1, y: 2, width: 4, height: 3, depth: 2, names: ['A'] }],
    })
    fireEvent.change(screen.getByLabelText('Solide 1 — type'), {
      target: { value: 'cylindre' },
    })
    expect(spec().solids).toEqual([{ kind: 'cylindre', x: 1, y: 2, radius: 2, height: 4 }])
  })

  it('reads vertex names typed with spaces', () => {
    const spec = monter({ solids: [{ kind: 'cube', x: 0, y: 0, edge: 2 }] })
    fireEvent.change(screen.getByLabelText('Solide 1 — noms des sommets'), {
      target: { value: 'A B C D E F G H ' },
    })
    expect((spec().solids as Array<{ names?: string[] }>)[0].names).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
    ])
  })

  it('marks a segment dashed without losing its points', () => {
    const spec = monter({
      points: [
        { name: 'A', x: 0, y: 0 },
        { name: 'B', x: 1, y: 0 },
      ],
      segments: [{ from: 'A', to: 'B' }],
    })
    fireEvent.click(screen.getByLabelText('Segment 1 en pointillés'))
    expect(spec().segments).toEqual([{ from: 'A', to: 'B', style: 'dashed' }])
  })

  it('cannot draw a repère while the figure holds a solid', () => {
    monter({ solids: [{ kind: 'cube', x: 0, y: 0, edge: 2 }] })
    expect(screen.getByRole('checkbox', { name: /Tracer un repère/ })).toBeDisabled()
  })
})
