import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { PaperExercise } from '../exercice-widget'

const PROMPT = 'Démontre que le triangle ABC est rectangle en A.'
const SOLUTION = 'BC² = 100\nAB² + AC² = 100\nDonc ABC est rectangle en A.'

describe('PaperExercise', () => {
  it('n’affiche pas la correction avant que l’élève la demande', () => {
    render(<PaperExercise prompt={PROMPT} solution={SOLUTION} />)
    expect(screen.getByText(PROMPT)).toBeInTheDocument()
    expect(screen.queryByText(/BC² = 100/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /voir la correction/i })).toBeInTheDocument()
  })

  it('révèle la correction puis propose l’auto-évaluation', async () => {
    const user = userEvent.setup()
    render(<PaperExercise prompt={PROMPT} solution={SOLUTION} />)

    await user.click(screen.getByRole('button', { name: /voir la correction/i }))

    expect(screen.getByText(/Correction/i)).toBeInTheDocument()
    expect(screen.getByText(/BC² = 100/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /j’avais juste/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /à revoir/i })).toBeInTheDocument()
  })

  it('donne un retour bienveillant après l’auto-évaluation', async () => {
    const user = userEvent.setup()
    render(<PaperExercise prompt={PROMPT} solution={SOLUTION} />)

    await user.click(screen.getByRole('button', { name: /voir la correction/i }))
    await user.click(screen.getByRole('button', { name: /j’avais juste/i }))

    expect(screen.getByRole('status')).toHaveTextContent(/bravo/i)
    // Can redo the self-assessment.
    expect(
      screen.getByRole('button', { name: /refaire mon auto-évaluation/i })
    ).toBeInTheDocument()
  })
})
