import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({ askTuteurForTarget: vi.fn() }))
vi.mock('@brio/api-client', () => ({
  createApiClient: vi.fn(),
  controleActif: vi.fn().mockResolvedValue({ enControle: false, titre: null, echeanceAt: null }),
  examenActif: vi
    .fn()
    .mockResolvedValue({ enExamen: false, annaleId: null, titre: null, endsAt: null }),
}))

import { TuteurPanel } from '../tutor-panel'
import { ChapterInteractionProvider } from '../chapter-interaction-context'
import { askTuteurForTarget, type TutorTarget } from '@/lib/api'

const TARGET: TutorTarget = {
  kind: 'chapitre',
  niveau: '3e',
  matiere: 'mathematiques',
  slug: 'theoreme-de-pythagore',
}

function renderPanel() {
  return render(
    <ChapterInteractionProvider>
      <TuteurPanel target={TARGET} />
    </ChapterInteractionProvider>
  )
}

describe('TuteurPanel', () => {
  beforeEach(() => {
    vi.mocked(askTuteurForTarget).mockReset()
  })

  it('does not send an empty question', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: /envoyer/i }))
    expect(askTuteurForTarget).not.toHaveBeenCalled()
  })

  it('does not send a whitespace-only question', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.type(screen.getByLabelText('Ta question au tuteur'), '   ')
    await user.click(screen.getByRole('button', { name: /envoyer/i }))
    expect(askTuteurForTarget).not.toHaveBeenCalled()
  })

  it('renders a refusal as a normal non-alarming message', async () => {
    const REFUSAL = 'Je ne peux pas répondre à cette question à partir du contenu de ce chapitre.'
    vi.mocked(askTuteurForTarget).mockResolvedValueOnce({ reponse: REFUSAL, citations: [] })
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

    vi.mocked(askTuteurForTarget).mockResolvedValueOnce({
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

    const mockAsk = vi.fn().mockResolvedValue({ reponse: 'OK', citations: [] })
    vi.doMock('@/lib/api', () => ({ askTuteurForTarget: mockAsk }))

    const { TuteurPanel: Panel } = await import('../tutor-panel')
    const { ChapterInteractionProvider: Provider } = await import('../chapter-interaction-context')

    const user = userEvent.setup()
    render(
      <Provider tutorRequestCap={2}>
        <Panel target={TARGET} />
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
  })

  it('counts the questions of every panel on the page, and keeps them when one remounts', async () => {
    vi.mocked(askTuteurForTarget).mockReset().mockResolvedValue({ reponse: 'OK', citations: [] })
    const user = userEvent.setup()
    function Page({ drawer }: { drawer: boolean }) {
      return (
        <ChapterInteractionProvider tutorRequestCap={2}>
          <div data-testid="rail">
            <TuteurPanel target={TARGET} />
          </div>
          {drawer && (
            <div data-testid="tiroir">
              <TuteurPanel target={TARGET} />
            </div>
          )}
        </ChapterInteractionProvider>
      )
    }
    const { rerender } = render(<Page drawer />)
    const rail = within(screen.getByTestId('rail'))

    await user.type(rail.getByLabelText('Ta question au tuteur'), 'Question 1')
    await user.click(rail.getByRole('button', { name: /envoyer/i }))
    await waitFor(() => expect(rail.getByText('Question 1')).toBeInTheDocument())

    // The drawer closes and opens again: its panel remounts, the session does not restart.
    rerender(<Page drawer={false} />)
    rerender(<Page drawer />)
    const tiroir = within(screen.getByTestId('tiroir'))
    expect(tiroir.getByText('Question 1')).toBeInTheDocument()
    expect(tiroir.getByText('1 question restante')).toBeInTheDocument()

    await user.type(tiroir.getByLabelText('Ta question au tuteur'), 'Question 2')
    await user.click(tiroir.getByRole('button', { name: /envoyer/i }))
    await waitFor(() => expect(tiroir.getByText('Question 2')).toBeInTheDocument())

    // The cap is reached in the drawer: the rail is locked too.
    expect(rail.queryByLabelText('Ta question au tuteur')).toBeNull()
    expect(askTuteurForTarget).toHaveBeenCalledTimes(2)
  })

  it('sends the exercise it is given rather than the last one touched, null included', async () => {
    vi.mocked(askTuteurForTarget).mockReset().mockResolvedValue({ reponse: 'OK', citations: [] })
    const user = userEvent.setup()
    render(
      <ChapterInteractionProvider>
        <TuteurPanel target={TARGET} exerciceId={null} contexte="À propos de : Définition" />
      </ChapterInteractionProvider>
    )
    expect(screen.getByText('À propos de : Définition')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Ta question au tuteur'), 'Pourquoi ?')
    await user.click(screen.getByRole('button', { name: /envoyer/i }))
    await waitFor(() =>
      expect(askTuteurForTarget).toHaveBeenCalledWith(TARGET, 'Pourquoi ?', null)
    )
  })

  it('hands a citation to onCitation instead of scrolling', async () => {
    vi.mocked(askTuteurForTarget)
      .mockReset()
      .mockResolvedValue({ reponse: 'Voir la définition.', citations: ['intro/def-1'] })
    const onCitation = vi.fn()
    const user = userEvent.setup()
    render(
      <ChapterInteractionProvider>
        <TuteurPanel target={TARGET} onCitation={onCitation} />
      </ChapterInteractionProvider>
    )
    await user.type(screen.getByLabelText('Ta question au tuteur'), 'Rappel ?')
    await user.click(screen.getByRole('button', { name: /envoyer/i }))
    await user.click(await screen.findByRole('button', { name: 'def-1' }))
    expect(onCitation).toHaveBeenCalledWith('def-1')
  })
})
