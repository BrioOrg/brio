import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChapterInteractionProvider } from '@/components/chapter-interaction-context'
import { ExerciceWidget } from '@/components/exercice-widget'

vi.mock('@/lib/api', () => ({ soumettre: vi.fn() }))

function renderWidget() {
  return render(
    <ChapterInteractionProvider>
      <ExerciceWidget
        exerciceId="ex-1"
        exerciseType="fill-blank"
        prompt="Complète le théorème."
        template="a² + b² = {}"
        bank={['c²', '2c', 'c']}
      />
    </ChapterInteractionProvider>
  )
}

describe('ExerciceWidget — fill-blank', () => {
  beforeEach(() => vi.clearAllMocks())

  it('demande de remplir le trou avant d’envoyer', async () => {
    const { soumettre } = await import('@/lib/api')
    renderWidget()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /vérifier/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/remplis tous les trous/i)
    expect(soumettre).not.toHaveBeenCalled()
  })

  it('place une étiquette puis envoie { blanks } au back', async () => {
    const { soumettre } = await import('@/lib/api')
    vi.mocked(soumettre).mockResolvedValue({ correct: true, choiceFeedback: [] } as never)
    renderWidget()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /^c²$/ }))
    await user.click(screen.getByRole('button', { name: /vérifier/i }))

    await waitFor(() =>
      expect(soumettre).toHaveBeenCalledWith('ex-1', { blanks: ['c²'] })
    )
  })

  it('libère le trou quand on touche l’étiquette placée', async () => {
    const { soumettre } = await import('@/lib/api')
    renderWidget()
    const user = userEvent.setup()

    // Place c² → tile becomes disabled (used).
    await user.click(screen.getByRole('button', { name: /^c²$/ }))
    // The filled blank is a button labelled "…retirer"; clicking frees it.
    await user.click(screen.getByRole('button', { name: /retirer/i }))
    // Submitting now fails validation again → nothing sent.
    await user.click(screen.getByRole('button', { name: /vérifier/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/remplis tous les trous/i)
    expect(soumettre).not.toHaveBeenCalled()
  })
})
