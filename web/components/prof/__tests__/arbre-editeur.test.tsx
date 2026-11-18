import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { BlocEditeur } from '../bloc-editeur'
import { ProblemesDuBlocProvider } from '../problemes-du-bloc'
import { nouveauBloc, type Bloc, type NoeudArbre } from '@/lib/cours-editeur'

function Harnais() {
  const [bloc, setBloc] = useState<Bloc>(() => ({ ...nouveauBloc('tree'), id: 'a1' }))
  return (
    <ProblemesDuBlocProvider value={{ problemes: [] }}>
      <BlocEditeur bloc={bloc} onModifier={(patch) => setBloc((b) => ({ ...b, ...patch }))} />
      <output data-testid="etat">{JSON.stringify(bloc)}</output>
    </ProblemesDuBlocProvider>
  )
}

function branches(): NoeudArbre[] {
  return JSON.parse(screen.getByTestId('etat').textContent as string).root.children
}

describe('ArbreEditeur', () => {
  it('should name branches, give probabilities and add a second level', async () => {
    render(<Harnais />)
    await userEvent.type(screen.getByLabelText('Nom de la branche 1'), 'Pile')
    await userEvent.type(screen.getByLabelText('Probabilité de la branche 1'), '1/2')
    await userEvent.type(screen.getByLabelText('Nom de la branche 2'), 'Face')
    await userEvent.click(screen.getAllByRole('button', { name: '＋ Sous-branche' })[0])
    await userEvent.type(screen.getByLabelText('Nom de la branche 1.1'), 'P')
    expect(branches()).toEqual([
      { label: 'Pile', probability: '1/2', children: [{ label: 'P' }] },
      { label: 'Face' },
    ])
  })

  it('should draw the preview once a branch is named', async () => {
    render(<Harnais />)
    expect(screen.getByText('Nomme au moins une branche pour voir l’arbre.')).toBeDefined()
    await userEvent.type(screen.getByLabelText('Nom de la branche 1'), 'R')
    expect(screen.getAllByRole('img', { name: 'Aperçu de l’arbre' })).toHaveLength(2)
  })

  it('should remove a branch', async () => {
    render(<Harnais />)
    await userEvent.type(screen.getByLabelText('Nom de la branche 2'), 'B')
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer la branche 1' }))
    expect(branches()).toEqual([{ label: 'B' }])
  })
})
