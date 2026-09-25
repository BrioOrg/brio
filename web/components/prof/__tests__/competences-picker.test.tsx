import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import type { Competence } from '@brio/api-client'

import { CompetencesPicker } from '../competences-picker'

const COMPETENCES: Competence[] = [
  {
    code: 'c4.geo.pythagore.calculer',
    intitule: 'Calculer une longueur avec le théorème de Pythagore',
    domaine: 'espace-et-geometrie',
    niveaux: ['4e'],
  },
  {
    code: 'c4.num.fractions.additionner',
    intitule: 'Additionner deux fractions',
    domaine: 'nombres-et-calculs',
    niveaux: ['4e'],
  },
]

// Harnais contrôlé : la sélection vit dans l'état et remonte via onChange, comme dans le bloc.
function Harnais({ initial = [] as string[] }) {
  const [selection, setSelection] = useState<string[]>(initial)
  return (
    <>
      <CompetencesPicker competences={COMPETENCES} selection={selection} onChange={setSelection} />
      <output data-testid="selection">{JSON.stringify(selection)}</output>
    </>
  )
}

function selection(): string[] {
  return JSON.parse(screen.getByTestId('selection').textContent as string)
}

describe('CompetencesPicker', () => {
  it('coche une compétence et enregistre son code', async () => {
    render(<Harnais />)

    await userEvent.click(
      screen.getByRole('checkbox', { name: /Calculer une longueur avec le théorème de Pythagore/ })
    )

    expect(selection()).toEqual(['c4.geo.pythagore.calculer'])
  })

  it('filtre la liste par la recherche (accents et casse ignorés)', async () => {
    render(<Harnais />)

    await userEvent.type(screen.getByLabelText('Rechercher une compétence'), 'FRACTION')

    expect(screen.getByText('Additionner deux fractions')).toBeInTheDocument()
    expect(
      screen.queryByText('Calculer une longueur avec le théorème de Pythagore')
    ).not.toBeInTheDocument()
  })

  it('retire une compétence retenue via sa puce', async () => {
    render(<Harnais initial={['c4.num.fractions.additionner']} />)

    await userEvent.click(
      screen.getByRole('button', { name: /Retirer Additionner deux fractions/ })
    )

    expect(selection()).toEqual([])
  })

  it('affiche un message quand aucune compétence n’est disponible', () => {
    render(<CompetencesPicker competences={[]} selection={[]} onChange={() => {}} />)

    expect(screen.getByText(/Aucune compétence du référentiel/)).toBeInTheDocument()
  })
})
