import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BlockRenderer, type Block } from '../block-renderer'

const block: Block = {
  id: 'fig',
  type: 'figure',
  alt: 'Une droite.',
  spec: {
    axes: { x: { from: 0, to: 5, step: 1 }, y: { from: 0, to: 10, step: 1 } },
    functions: [{ name: 'f', expr: '2x' }],
  },
}
const lien = { name: 'Ouvrir dans la calculatrice graphique' }

describe('the calculator link on a figure block', () => {
  it('is shown to a student', () => {
    render(<BlockRenderer block={block} apercu={false} />)
    expect(screen.getByRole('link', lien)).toBeTruthy()
  })

  it("is left out of the teacher's preview of the whole course, which must not navigate away", () => {
    render(<BlockRenderer block={block} apercu />)
    expect(screen.queryByRole('link', lien)).toBeNull()
  })

  it('is left out of the preview of a figure with sliders too', () => {
    const parametree: Block = {
      ...block,
      spec: {
        ...(block.spec as object),
        functions: [{ name: 'f', expr: 'ax' }],
        parameters: [{ name: 'a', min: 0, max: 4, step: 1, value: 1 }],
      },
    }
    render(<BlockRenderer block={parametree} apercu />)
    expect(screen.queryByRole('link', lien)).toBeNull()
  })
})
