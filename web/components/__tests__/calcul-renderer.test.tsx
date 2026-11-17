import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CalculSpec } from '@brio/content'

import { CalculRenderer } from '../calcul-renderer'
import { etapesParBloc } from '../chapter-view'

const equation: CalculSpec = {
  mode: 'equation',
  title: 'Résoudre $x + 13 = 41$',
  lines: [
    { latex: 'x + 13 = 41' },
    { latex: 'x = 41 - 13', op: '-13', focus: '- 13', note: 'on soustrait 13 aux deux membres' },
    { latex: 'x = 28', note: 'on calcule' },
  ],
  conclusion: 'La solution est $28$.',
}

function lignes(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('li[data-etape]'))
}

describe('CalculRenderer', () => {
  it('should draw each line in three columns, aligned on its relation', () => {
    const { container } = render(<CalculRenderer id="k" spec={equation} />)
    const [premiere] = lignes(container)
    const colonnes = Array.from(premiere.children).filter((c) => !c.classList.contains('sr-only'))
    expect(colonnes.map((c) => c.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('x+13'), expect.stringContaining('=')])
    )
    expect(premiere.querySelector('.col-start-2')?.textContent).toContain('=')
    expect(premiere.querySelector('.col-start-3')?.textContent).toContain('41')
  })

  it('should give a screen reader one MathML formula per line, with its operation', () => {
    const { container } = render(<CalculRenderer id="k" spec={equation} />)
    const lus = lignes(container).map((li) => li.querySelector('.sr-only'))
    expect(lus.every((l) => l?.querySelector('math'))).toBe(true)
    expect(lus[1]?.textContent).toMatch(/^Aux deux membres : .*13/)
  })

  it('should emphasise the part that changed and write the operation under both members', () => {
    const { container } = render(<CalculRenderer id="k" spec={equation} />)
    const deuxieme = lignes(container)[1]
    expect(deuxieme.querySelector('.calcul-focus')?.textContent).toBe('−13')
    expect(deuxieme.querySelectorAll('.text-tone-1')).toHaveLength(2)
    expect(screen.getByText('on soustrait 13 aux deux membres')).toBeInTheDocument()
  })

  it('should keep a line not revealed yet in place, invisible and hidden from assistive technology', () => {
    const { container } = render(<CalculRenderer id="k" spec={equation} visibles={1} />)
    const [premiere, deuxieme, troisieme] = lignes(container)
    expect(premiere).not.toHaveClass('invisible')
    expect(deuxieme).toHaveClass('invisible')
    expect(deuxieme).toHaveAttribute('aria-hidden', 'true')
    expect(troisieme).toHaveClass('invisible')
    expect(screen.getByText(/La solution est/).closest('p')).toHaveClass('invisible')
  })

  it('should show everything outside the interactive mode', () => {
    const { container } = render(<CalculRenderer id="k" spec={equation} />)
    expect(lignes(container).some((li) => li.classList.contains('invisible'))).toBe(false)
    expect(screen.getByText(/La solution est/).closest('p')).not.toHaveClass('invisible')
  })
})

describe('etapesParBloc', () => {
  it('should count a calculation’s lines, then its conclusion, as steps to reveal', () => {
    const chapitre = {
      sections: [{ id: 's', blocks: [{ id: 'k', type: 'calcul', ...equation }] }],
    } as unknown as Parameters<typeof etapesParBloc>[0]
    expect(etapesParBloc(chapitre)).toEqual({ k: 4 })
  })
})
