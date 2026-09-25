import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ClavierMaths } from '../maths/clavier-maths'

describe('ClavierMaths', () => {
  it('insère le LaTeX de la touche cliquée (modèle à trou pour la fraction)', async () => {
    const onInserer = vi.fn()
    render(<ClavierMaths onInserer={onInserer} />)

    await userEvent.click(screen.getByRole('button', { name: 'Fraction' }))

    expect(onInserer).toHaveBeenCalledWith({ avant: '\\frac{', apres: '}{}' })
  })

  it('insère un opérateur simple sans trou', async () => {
    const onInserer = vi.fn()
    render(<ClavierMaths onInserer={onInserer} />)

    await userEvent.click(screen.getByRole('button', { name: 'Racine carrée' }))

    expect(onInserer).toHaveBeenCalledWith({ avant: '\\sqrt{', apres: '}' })
  })

  it('expose les touches minimales du CDC avec un libellé accessible', () => {
    render(<ClavierMaths onInserer={vi.fn()} />)
    for (const label of [
      'Racine carrée',
      'Au carré',
      'Exposant',
      'Fraction',
      'Pi',
      'Multiplié',
      'Divisé',
      'Inférieur ou égal',
      'Appartient à',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })
})
