import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RejoindreError } from '@brio/api-client'

vi.mock('@/lib/enrollment', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return {
    rejoindreClasse: vi.fn(),
    RejoindreError: actual.RejoindreError,
  }
})

async function setup() {
  const { rejoindreClasse } = await import('@/lib/enrollment')
  const { RejoindreForm } = await import('../rejoindre-form')
  render(<RejoindreForm />)
  return { rejoindreClasse: vi.mocked(rejoindreClasse) }
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/code de la classe/i), '4EB-2K9P')
  await user.type(screen.getByLabelText(/ton prénom/i), 'Léa')
  await user.type(screen.getByLabelText(/mot de passe/i), 'motdepasse1')
}

describe('RejoindreForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rend les trois champs', async () => {
    await setup()
    expect(screen.getByLabelText(/code de la classe/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/ton prénom/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument()
  })

  it('envoie le code, le prénom et le mot de passe puis affiche l’identifiant une fois', async () => {
    const { rejoindreClasse } = await setup()
    rejoindreClasse.mockResolvedValue({
      id: '1',
      identifiantConnexion: 'lea.martin.4eb',
      nomAffiche: 'Léa',
      classeLibelle: '4e B',
    })

    const user = userEvent.setup()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /rejoindre ma classe/i }))

    await waitFor(() =>
      expect(rejoindreClasse).toHaveBeenCalledWith({
        code: '4EB-2K9P',
        nomAffiche: 'Léa',
        motDePasse: 'motdepasse1',
      })
    )

    // Success screen surfaces the one-time identifiant and the class.
    expect(await screen.findByText('lea.martin.4eb')).toBeInTheDocument()
    expect(screen.getByText(/te voilà dans la 4e b/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /me connecter/i })).toHaveAttribute('href', '/connexion')
  })

  it('refuse un mot de passe trop court sans appeler l’API', async () => {
    const { rejoindreClasse } = await setup()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/code de la classe/i), '4EB-2K9P')
    await user.type(screen.getByLabelText(/ton prénom/i), 'Léa')
    await user.type(screen.getByLabelText(/mot de passe/i), 'court')
    await user.click(screen.getByRole('button', { name: /rejoindre ma classe/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/au moins 8 caractères/i)
    expect(rejoindreClasse).not.toHaveBeenCalled()
  })

  it('affiche un message clair quand le code est introuvable (404)', async () => {
    const { rejoindreClasse } = await setup()
    rejoindreClasse.mockRejectedValue(new RejoindreError(404))

    const user = userEvent.setup()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /rejoindre ma classe/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/introuvable/i)
  })

  it('explique quand le code n’est plus valable (410)', async () => {
    const { rejoindreClasse } = await setup()
    rejoindreClasse.mockRejectedValue(new RejoindreError(410))

    const user = userEvent.setup()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /rejoindre ma classe/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/n’est plus valable/i)
  })
})
