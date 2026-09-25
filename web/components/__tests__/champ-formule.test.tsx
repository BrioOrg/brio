import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { ChampFormule } from '../maths/champ-formule'

// Harnais contrôlé : le champ est piloté par value/onChange, on reflète donc la valeur ici.
function Harnais({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <ChampFormule value={value} onChange={setValue} ariaLabel="Formule" placeholder="a^2 + b^2" />
  )
}

describe('ChampFormule', () => {
  it('met à jour la valeur à la frappe', async () => {
    render(<Harnais />)
    const input = screen.getByLabelText<HTMLInputElement>('Formule')
    await userEvent.type(input, 'x^2')
    expect(input.value).toBe('x^2')
  })

  it('affiche le clavier maths une fois le champ actif', async () => {
    render(<Harnais />)
    expect(screen.queryByRole('group', { name: 'Clavier mathématique' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Formule'))
    expect(screen.getByRole('group', { name: 'Clavier mathématique' })).toBeInTheDocument()
  })

  it('insère le symbole au curseur en enveloppant la sélection', async () => {
    render(<Harnais initial="1+2" />)
    const input = screen.getByLabelText<HTMLInputElement>('Formule')
    await userEvent.click(input)
    // Sélectionne « 2 » (dernier caractère) puis insère une racine carrée autour.
    input.setSelectionRange(2, 3)
    await userEvent.click(screen.getByRole('button', { name: 'Racine carrée' }))
    expect(input.value).toBe('1+\\sqrt{2}')
  })

  it('signale discrètement une formule invalide sans planter', async () => {
    render(<Harnais initial="\frac{" />)
    expect(await screen.findByText('Formule incomplète ou invalide.')).toBeInTheDocument()
  })
})
