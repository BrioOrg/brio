import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExerciceWidget } from '../exercice-widget'

vi.mock('@/lib/api', () => ({
  soumettre: vi.fn(),
}))

import { soumettre } from '@/lib/api'
const mockSoumettre = vi.mocked(soumettre)

const MC_PROPS = {
  exerciceId: 'uuid-mc',
  exerciseType: 'multiple-choice' as const,
  prompt: "Quel côté est l'hypoténuse ?",
  choices: [
    { id: 'choice-rs', text: 'Le côté [RS]' },
    { id: 'choice-rt', text: 'Le côté [RT]' },
  ],
  multiple: false,
}

const NUMERIC_PROPS = {
  exerciceId: 'uuid-num',
  exerciseType: 'numeric' as const,
  prompt: "Quelle est la longueur de l'hypoténuse ?",
  unit: 'cm',
}

const SUCCESS_MC = {
  soumissionId: 'sid-1',
  correct: true,
  score: 1.0,
  choiceFeedback: [
    { choiceId: 'choice-rs', correct: false },
    { choiceId: 'choice-rt', correct: true },
  ],
  expectedValue: null,
  explanation: "L'hypoténuse est [RT].",
}

const INCORRECT_MC = {
  soumissionId: 'sid-2',
  correct: false,
  score: 0.0,
  choiceFeedback: [
    { choiceId: 'choice-rs', correct: false },
    { choiceId: 'choice-rt', correct: true },
  ],
  expectedValue: null,
  explanation: null,
}

const SUCCESS_NUMERIC = {
  soumissionId: 'sid-3',
  correct: true,
  score: 1.0,
  choiceFeedback: [],
  expectedValue: 10,
  explanation: 'BC = 10 cm.',
}

const INCORRECT_NUMERIC = {
  soumissionId: 'sid-4',
  correct: false,
  score: 0.0,
  choiceFeedback: [],
  expectedValue: 10,
  explanation: null,
}

describe('ExerciceWidget — choix multiple', () => {
  beforeEach(() => {
    mockSoumettre.mockReset()
  })

  it('affiche la question et les boutons radio', () => {
    render(<ExerciceWidget {...MC_PROPS} />)
    expect(screen.getByText(/Quel côté est l'hypoténuse/)).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Vérifier' })).toBeInTheDocument()
  })

  it('bloque la soumission si aucun choix sélectionné', async () => {
    render(<ExerciceWidget {...MC_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sélectionne au moins une réponse.')
    expect(mockSoumettre).not.toHaveBeenCalled()
  })

  it('affiche le résultat correct après soumission réussie', async () => {
    mockSoumettre.mockResolvedValue(SUCCESS_MC)
    render(<ExerciceWidget {...MC_PROPS} />)

    fireEvent.click(screen.getByLabelText('Le côté [RT]'))
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Correct')
    expect(screen.getByText(/L'hypoténuse est \[RT\]/)).toBeInTheDocument()
  })

  it('affiche le résultat incorrect avec feedback par choix', async () => {
    mockSoumettre.mockResolvedValue(INCORRECT_MC)
    render(<ExerciceWidget {...MC_PROPS} />)

    fireEvent.click(screen.getByLabelText('Le côté [RS]'))
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Incorrect')
  })

  it('affiche une erreur réseau quand le backend est inaccessible', async () => {
    mockSoumettre.mockRejectedValue(new Error('Erreur réseau. Réessaie plus tard.'))
    render(<ExerciceWidget {...MC_PROPS} />)

    fireEvent.click(screen.getByLabelText('Le côté [RT]'))
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Erreur réseau')
    })
  })
})

describe('ExerciceWidget — numérique', () => {
  beforeEach(() => {
    mockSoumettre.mockReset()
  })

  it('affiche la question et le champ numérique avec unité', () => {
    render(<ExerciceWidget {...NUMERIC_PROPS} />)
    expect(screen.getByText(/Quelle est la longueur/)).toBeInTheDocument()
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
    expect(screen.getByText('cm')).toBeInTheDocument()
  })

  it('bloque la soumission si le champ est vide', async () => {
    render(<ExerciceWidget {...NUMERIC_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Saisis une valeur numérique.')
    expect(mockSoumettre).not.toHaveBeenCalled()
  })

  it('affiche le résultat correct', async () => {
    mockSoumettre.mockResolvedValue(SUCCESS_NUMERIC)
    render(<ExerciceWidget {...NUMERIC_PROPS} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Correct')
    expect(screen.getByText(/BC = 10 cm/)).toBeInTheDocument()
  })

  it('affiche la bonne réponse quand la réponse est incorrecte', async () => {
    mockSoumettre.mockResolvedValue(INCORRECT_NUMERIC)
    render(<ExerciceWidget {...NUMERIC_PROPS} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Incorrect')
    expect(screen.getByText(/10 cm/)).toBeInTheDocument()
  })

  it('affiche une erreur réseau quand le backend est inaccessible', async () => {
    mockSoumettre.mockRejectedValue(new Error('Erreur réseau. Réessaie plus tard.'))
    render(<ExerciceWidget {...NUMERIC_PROPS} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Erreur réseau')
    })
  })
})
