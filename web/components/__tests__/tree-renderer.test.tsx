import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TreeSpec } from '@brio/content'
import { TreeRenderer } from '../tree-renderer'

const urn: TreeSpec = {
  root: {
    children: [
      {
        label: 'R',
        probability: '3/5',
        children: [
          { label: 'R', probability: '2/4' },
          { label: 'B', probability: '2/4' },
        ],
      },
      {
        label: 'B',
        probability: '2/5',
        children: [
          { label: 'R', probability: '3/4' },
          { label: 'B', probability: '1/4' },
        ],
      },
    ],
  },
  outcomes: true,
  products: true,
  highlightPath: ['R', 'B'],
}

describe('TreeRenderer', () => {
  it('should expose the alt text as the name of each drawing (wide and compact)', () => {
    render(<TreeRenderer spec={urn} alt="Deux tirages sans remise" />)
    // Two layouts are emitted; CSS shows one of them.
    expect(screen.getAllByRole('img', { name: 'Deux tirages sans remise' })).toHaveLength(2)
  })

  it('should list every path in a table for a screen reader', () => {
    render(<TreeRenderer spec={urn} alt="Arbre" title="Urne" />)
    const table = screen.getByRole('table', { name: 'Urne' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(5)
    expect(within(table).getByRole('columnheader', { name: 'Probabilité' })).toBeDefined()
    expect(rows[2].textContent).toContain('(R ; B)')
  })

  it('should draw probabilities as fractions and colour only the highlighted path', () => {
    const { container } = render(<TreeRenderer spec={urn} alt="Arbre" />)
    const [wide] = screen.getAllByRole('img')
    expect(wide.querySelectorAll('[data-role="probability"] .mfrac').length).toBe(6)
    expect(wide.querySelectorAll('line.stroke-tone-1')).toHaveLength(2)
    expect(wide.querySelectorAll('.text-tone-1')).toHaveLength(4)
    expect(container.querySelector('figcaption')).toBeNull()
  })

  it('should write no issue and no product unless asked', () => {
    render(<TreeRenderer spec={{ root: urn.root }} alt="Arbre" />)
    const [wide] = screen.getAllByRole('img')
    expect(wide.querySelector('[data-role="outcome"]')).toBeNull()
    expect(wide.querySelector('[data-role="product"]')).toBeNull()
  })

  it('should render nothing for a tree without branches', () => {
    const { container } = render(<TreeRenderer spec={{ root: { children: [] } }} alt="Vide" />)
    expect(container.innerHTML).toBe('')
  })
})
