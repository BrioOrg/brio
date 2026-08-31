import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({ askTuteur: vi.fn() }))
vi.mock('@brio/api-client', () => ({ createApiClient: vi.fn() }))

import { TuteurPanel } from '../tutor-panel'
import { ChapterInteractionProvider } from '../chapter-interaction-context'
import { askTuteur } from '@/lib/api'

const PROPS = { niveau: '3e', matiere: 'mathematiques', slug: 'theoreme-de-pythagore' }

function renderPanel() {
  return render(
    <ChapterInteractionProvider>
      <TuteurPanel {...PROPS} />
    </ChapterInteractionProvider>
  )
}

describe('TuteurPanel', () => {
  beforeEach(() => {
    vi.mocked(askTuteur).mockReset()
  })

  it('does not send an empty question', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: /envoyer/i }))
    expect(askTuteur).not.toHaveBeenCalled()
  })

  it('does not send a whitespace-only question', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.type(screen.getByLabelText('Ta question au tuteur'), '   ')
    await user.click(screen.getByRole('button', { name: /envoyer/i }))
    expect(askTuteur).not.toHaveBeenCalled()
  })

  it('renders a refusal as a normal non-alarming message', async () => {
    const REFUSAL = 'Je ne peux pas répondre à cette question à partir du contenu de ce chapitre.'
    vi.mocked(askTuteur).mockResolvedValueOnce({ reponse: REFUSAL, citations: [] })
    const user = userEvent.setup()
    renderPanel()
    await user.type(screen.getByLabelText('Ta question au tuteur'), 'Hors sujet')
    await user.click(screen.getByRole('button', { name: /envoyer/i }))
    await waitFor(() => expect(screen.getByText(REFUSAL)).toBeInTheDocument())
    // Refusals render as plain text in the history, never as role="alert"
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('citation button scrolls to the cited block and marks it with data-cited', async () => {
    const scrollIntoView = vi.fn()
    const target = document.createElement('p')
    target.id = 'definition-hypotenuse'
    target.scrollIntoView = scrollIntoView
    document.body.appendChild(target)

    vi.mocked(askTuteur).mockResolvedValueOnce({
      reponse: 'Voir la définition.',
      citations: ['enonce-du-theoreme/definition-hypotenuse'],
    })

    const user = userEvent.setup()
    renderPanel()
    await user.type(screen.getByLabelText('Ta question au tuteur'), "Qu'est-ce que l'hypoténuse ?")
    await user.click(screen.getByRole('button', { name: /envoyer/i }))
    await waitFor(() => expect(screen.getByText('definition-hypotenuse')).toBeInTheDocument())

    await user.click(screen.getByText('definition-hypotenuse'))
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(target.getAttribute('data-cited')).toBe('true')

    document.body.removeChild(target)
  })
})

describe('TuteurPanel — session cap', () => {
  it('hides the form and shows the cap message after cap requests', async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_TUTEUR_REQUEST_CAP', '2')

    const mockAsk = vi.fn().mockResolvedValue({ reponse: 'OK', citations: [] })
    vi.doMock('@/lib/api', () => ({ askTuteur: mockAsk }))

    const { TuteurPanel: Panel } = await import('../tutor-panel')
    const { ChapterInteractionProvider: Provider } = await import('../chapter-interaction-context')

    const user = userEvent.setup()
    render(
      <Provider>
        <Panel {...PROPS} />
      </Provider>
    )

    // First submission
    await user.type(screen.getByLabelText('Ta question au tuteur'), 'Question 1')
    await user.click(screen.getByRole('button', { name: /envoyer/i }))
    await waitFor(() => expect(screen.getByText('Question 1')).toBeInTheDocument())

    // Second submission (hits the cap)
    await user.type(screen.getByLabelText('Ta question au tuteur'), 'Question 2')
    await user.click(screen.getByRole('button', { name: /envoyer/i }))
    await waitFor(() => expect(screen.getByText('Question 2')).toBeInTheDocument())

    // Form is gone, cap message is visible as role="status"
    expect(screen.queryByLabelText('Ta question au tuteur')).toBeNull()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(mockAsk).toHaveBeenCalledTimes(2)

    vi.unstubAllEnvs()
  })
})
