import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

vi.mock('@brio/api-client', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return { ...actual, changerMotDePasse: vi.fn() }
})

vi.mock('@/lib/session', () => ({ logout: vi.fn() }))

async function setup() {
  const client = await import('@brio/api-client')
  const { ChangerMotDePasseForm } = await import('../changer-mot-de-passe-form')
  render(<ChangerMotDePasseForm />)
  return { changer: vi.mocked(client.changerMotDePasse), client }
}

async function saisir(motDePasse: string, confirmation = motDePasse) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Ton nouveau mot de passe'), motDePasse)
  await user.type(screen.getByLabelText('Retape-le pour vérifier'), confirmation)
  await user.click(screen.getByRole('button', { name: /enregistrer mon mot de passe/i }))
}

// ADR 0036 §5 : connecté avec le provisoire du prof, l'élève choisit son propre mot de passe.
describe('ChangerMotDePasseForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('enregistre le nouveau mot de passe puis mène à l’accueil', async () => {
    const { changer } = await setup()
    changer.mockResolvedValue()

    await saisir('mon-secret-a-moi')

    await waitFor(() =>
      expect(changer).toHaveBeenCalledWith(expect.any(String), 'mon-secret-a-moi')
    )
    expect(push).toHaveBeenCalledWith('/')
  })

  it('refuse moins de 8 caractères sans appeler le serveur', async () => {
    const { changer } = await setup()
    await saisir('court')
    expect(await screen.findByRole('alert')).toHaveTextContent(/au moins 8 caractères/i)
    expect(changer).not.toHaveBeenCalled()
  })

  it('refuse deux saisies différentes', async () => {
    const { changer } = await setup()
    await saisir('mon-secret-a-moi', 'mon-secret-a-toi')
    expect(await screen.findByRole('alert')).toHaveTextContent(/pas identiques/i)
    expect(changer).not.toHaveBeenCalled()
  })

  it('affiche le refus du serveur et reste sur la page', async () => {
    const { changer, client } = await setup()
    changer.mockRejectedValue(
      new client.ChangerMotDePasseError(
        422,
        'Choisis un mot de passe différent du mot de passe provisoire.'
      )
    )
    await saisir('abcd-efgh-jkmn')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /différent du mot de passe provisoire/i
    )
    expect(push).not.toHaveBeenCalled()
  })

  it('prévient qu’une déconnexion coûte le mot de passe provisoire', async () => {
    await setup()
    expect(screen.getByRole('button', { name: /se déconnecter/i })).toBeInTheDocument()
    expect(
      screen.getByText(/redemander un mot de passe provisoire à ton prof/i)
    ).toBeInTheDocument()
  })

  it('lit l’aide « au moins 8 caractères » avec le champ', async () => {
    await setup()
    const champ = screen.getByLabelText('Ton nouveau mot de passe')
    expect(champ).toHaveAccessibleDescription(/au moins 8 caractères/i)
  })

  it('garde l’aide et ajoute l’erreur à la description du champ', async () => {
    await setup()
    await saisir('court')
    const champ = screen.getByLabelText('Ton nouveau mot de passe')
    expect(champ).toHaveAccessibleDescription(/au moins 8 caractères.*au moins 8 caractères/i)
  })

  it('dit « trop long » au-delà de 128 caractères, sans appeler le serveur', async () => {
    const { changer } = await setup()
    const user = userEvent.setup()
    const long = 'a'.repeat(129)
    await user.click(screen.getByLabelText('Ton nouveau mot de passe'))
    await user.paste(long)
    await user.click(screen.getByLabelText('Retape-le pour vérifier'))
    await user.paste(long)
    await user.click(screen.getByRole('button', { name: /enregistrer mon mot de passe/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/trop long.*128 caractères/i)
    expect(changer).not.toHaveBeenCalled()
  })
})

describe('ChangerMotDePassePage', () => {
  it('avertit de le faire maintenant, avant de fermer le navigateur', async () => {
    const { default: Page } = await import('@/app/changer-mot-de-passe/page')
    render(<Page />)
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent(/fais-le maintenant/i)
    expect(note).toHaveTextContent(/si tu fermes le navigateur, il faudra redemander à ton prof/i)
  })
})
