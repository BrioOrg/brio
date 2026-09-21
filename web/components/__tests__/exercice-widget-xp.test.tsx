import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({ soumettre: vi.fn() }))
vi.mock('../progression-context', () => ({ useProgression: vi.fn() }))

import { ExerciceWidget } from '../exercice-widget'
import { soumettre } from '@/lib/api'
import { useProgression } from '../progression-context'

const mockSoumettre = vi.mocked(soumettre)
const mockUseProgression = vi.mocked(useProgression)

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

const SUCCESS = {
  soumissionId: 'sid-1',
  correct: true,
  score: 1,
  choiceFeedback: [{ choiceId: 'choice-rt', correct: true }],
  expectedValue: null,
  explanation: "L'hypoténuse est [RT].",
}

const WRONG = { ...SUCCESS, soumissionId: 'sid-2', correct: false, explanation: null }

beforeEach(() => {
  mockSoumettre.mockReset()
  mockUseProgression.mockReset()
})

describe('ExerciceWidget — XP reward wiring (#80)', () => {
  it('shows the real "+N XP" gain after a correct answer', async () => {
    const refresh = vi.fn().mockResolvedValue(10)
    mockUseProgression.mockReturnValue({ info: null, gain: null, refresh })
    mockSoumettre.mockResolvedValue(SUCCESS)

    render(<ExerciceWidget {...MC_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /Le côté \[RT\]/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    // The correct answer re-reads progression...
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    // ...and the real awarded amount is shown (10, the first-try barème — not a fixed number).
    expect(await screen.findByText(/\+10/)).toBeTruthy()
  })

  it('does not re-read progression or show a gain on a wrong answer', async () => {
    const refresh = vi.fn().mockResolvedValue(0)
    mockUseProgression.mockReturnValue({ info: null, gain: null, refresh })
    mockSoumettre.mockResolvedValue(WRONG)

    render(<ExerciceWidget {...MC_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /Le côté \[RS\]/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    await waitFor(() => expect(screen.getByText(/Pas tout à fait/)).toBeInTheDocument())
    expect(refresh).not.toHaveBeenCalled()
    expect(screen.queryByText(/XP/)).toBeNull()
  })

  it('shows no gain pill when the answer was correct but nothing was awarded', async () => {
    const refresh = vi.fn().mockResolvedValue(0) // cap reached / already earned
    mockUseProgression.mockReturnValue({ info: null, gain: null, refresh })
    mockSoumettre.mockResolvedValue(SUCCESS)

    render(<ExerciceWidget {...MC_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /Le côté \[RT\]/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }))

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText(/Bien vu/)).toBeInTheDocument())
    expect(screen.queryByText(/\+/)).toBeNull()
  })
})
