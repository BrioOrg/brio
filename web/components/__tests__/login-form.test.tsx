import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginError } from '@brio/api-client'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

vi.mock('@/lib/session', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return {
    login: vi.fn(),
    LoginError: actual.LoginError,
  }
})

async function setup() {
  const { login } = await import('@/lib/session')
  const { LoginForm } = await import('../login-form')
  render(<LoginForm />)
  return { login: vi.mocked(login) }
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rend les champs identifiant et mot de passe', async () => {
    await setup()
    expect(screen.getByLabelText(/identifiant ou e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Se connecter', exact: true })).toBeInTheDocument()
  })

  it('propose le lien mot de passe oublié', async () => {
    await setup()
    expect(screen.getByRole('link', { name: /mot de passe oublié/i })).toHaveAttribute(
      'href',
      '/mot-de-passe-oublie'
    )
  })

  it('affiche le SSO établissement désactivé (aucun endpoint back)', async () => {
    await setup()
    const sso = screen.getByRole('button', { name: /se connecter avec mon établissement/i })
    expect(sso).toBeDisabled()
  })

  it('connecte puis redirige vers la page d’accueil', async () => {
    const { login } = await setup()
    login.mockResolvedValue({ id: '1', role: 'eleve', statut: 'actif', nom: null, email: null })

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/identifiant ou e-mail/i), 'lea.martin')
    await user.type(screen.getByLabelText(/mot de passe/i), 'motdepasse')
    await user.click(screen.getByRole('button', { name: 'Se connecter', exact: true }))

    await waitFor(() => expect(login).toHaveBeenCalledWith('lea.martin', 'motdepasse'))
    expect(push).toHaveBeenCalledWith('/')
  })

  it('affiche un message d’erreur quand les identifiants sont invalides', async () => {
    const { login } = await setup()
    login.mockRejectedValue(new LoginError(401, 'Identifiant ou mot de passe incorrect.'))

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/identifiant ou e-mail/i), 'lea.martin')
    await user.type(screen.getByLabelText(/mot de passe/i), 'faux')
    await user.click(screen.getByRole('button', { name: 'Se connecter', exact: true }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/identifiant ou mot de passe incorrect/i)
    expect(push).not.toHaveBeenCalled()
  })

  it('affiche un message générique sur erreur réseau', async () => {
    const { login } = await setup()
    login.mockRejectedValue(new Error('network down'))

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/identifiant ou e-mail/i), 'lea.martin')
    await user.type(screen.getByLabelText(/mot de passe/i), 'motdepasse')
    await user.click(screen.getByRole('button', { name: 'Se connecter', exact: true }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/la connexion a échoué/i)
  })
})
