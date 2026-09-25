import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { BlocEditeur } from '../bloc-editeur'
import { nouveauBloc, type Bloc, type Choix, type ExerciceType } from '@/lib/cours-editeur'

// Harnais contrôlé : chaque `onModifier(patch)` est fusionné dans le bloc, comme dans l'éditeur.
// On expose le bloc courant via une réf pour l'inspecter après édition.
function Harnais({ exerciseType }: { exerciseType: ExerciceType }) {
  const [bloc, setBloc] = useState<Bloc>(() => nouveauBloc('exercise', exerciseType))
  return (
    <>
      <BlocEditeur bloc={bloc} onModifier={(patch) => setBloc((b) => ({ ...b, ...patch }))} />
      <output data-testid="etat">{JSON.stringify(bloc)}</output>
    </>
  )
}

function etat(): Bloc {
  return JSON.parse(screen.getByTestId('etat').textContent as string)
}

describe('BlocEditeur — exercice QCM', () => {
  it('coche une proposition comme bonne réponse et bascule « plusieurs »', async () => {
    render(<Harnais exerciseType="multiple-choice" />)

    await userEvent.type(screen.getByPlaceholderText('Réponse 1'), 'Le grand côté')
    await userEvent.click(screen.getByLabelText('Bonne réponse 1'))
    await userEvent.click(screen.getByLabelText('Plusieurs bonnes réponses'))

    const choix = etat().choices as Choix[]
    expect(choix[0]).toMatchObject({ text: 'Le grand côté', correct: true })
    expect(choix[1].correct).toBe(false)
    expect(etat().multiple).toBe(true)
  })

  it('ajoute une proposition et empêche de descendre sous deux', async () => {
    render(<Harnais exerciseType="multiple-choice" />)

    // Deux propositions au départ ; on ne peut pas descendre sous deux (boutons désactivés).
    const supprimer = screen.getAllByRole('button', { name: 'Supprimer la réponse' })
    expect(supprimer).toHaveLength(2)
    supprimer.forEach((b) => expect(b).toBeDisabled())

    await userEvent.click(screen.getByRole('button', { name: '＋ Ajouter une réponse' }))
    expect((etat().choices as Choix[]).length).toBe(3)
  })
})

describe('BlocEditeur — réponse courte', () => {
  it('saisit une réponse acceptée et active la sensibilité à la casse', async () => {
    render(<Harnais exerciseType="short-answer" />)

    await userEvent.type(screen.getByPlaceholderText('Ex. hypoténuse'), 'hypoténuse')
    await userEvent.click(screen.getByLabelText('Sensible à la casse'))

    expect(etat().acceptedAnswers).toEqual(['hypoténuse'])
    expect(etat().caseSensitive).toBe(true)
  })
})

describe('BlocEditeur — numérique', () => {
  it('enregistre la réponse comme nombre et l’unité comme texte', async () => {
    render(<Harnais exerciseType="numeric" />)

    await userEvent.type(screen.getByLabelText('Réponse attendue'), '5')
    await userEvent.type(screen.getByLabelText('Unité'), 'cm')

    expect(etat().answer).toBe(5)
    expect(etat().unit).toBe('cm')
  })

  it('n’émet pas de réponse quand le champ est vidé (distinct de zéro)', async () => {
    render(<Harnais exerciseType="numeric" />)

    const champ = screen.getByLabelText('Réponse attendue')
    await userEvent.type(champ, '7')
    expect(etat().answer).toBe(7)
    await userEvent.clear(champ)
    expect(etat()).not.toHaveProperty('answer')
  })
})
