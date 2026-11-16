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

async function setup(redirectTo?: string) {
  const { login } = await import('@/lib/session')
  const { LoginForm } = await import('../login-form')
  render(<LoginForm redirectTo={redirectTo} />)
  return { login: vi.mocked(login) }
}

const ELEVE = { id: '1', role: 'eleve', statut: 'actif', nom: null, email: null }
const ENSEIGNANT = { id: '2', role: 'enseignant', statut: 'actif', nom: 'P', email: 'p@t.fr' }

async function submit() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/identifiant ou e-mail/i), 'lea.martin')
  await user.type(screen.getByLabelText(/mot de passe/i), 'motdepasse')
  await user.click(screen.getByRole('button', { name: 'Se connecter', exact: true }))
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

  // AC1 (#364) : le lien n'est plus mort — il pointe vers `/mot-de-passe-oublie`, une route
  // désormais vivante (voir la suite « MotDePasseOubliePage » plus bas, qui en prouve le rendu).
  it('propose le lien vers l’écran de récupération d’accès', async () => {
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

  it('envoie un élève vers le chemin de retour demandé', async () => {
    const { login } = await setup('/devoirs')
    login.mockResolvedValue(ELEVE)

    await submit()

    await waitFor(() => expect(push).toHaveBeenCalledWith('/devoirs'))
  })

  it('envoie un enseignant vers son espace', async () => {
    const { login } = await setup()
    login.mockResolvedValue(ENSEIGNANT)

    await submit()

    await waitFor(() => expect(push).toHaveBeenCalledWith('/prof'))
  })

  it('envoie un enseignant vers son espace quand le retour demandé est l’accueil', async () => {
    const { login } = await setup('/')
    login.mockResolvedValue(ENSEIGNANT)

    await submit()

    await waitFor(() => expect(push).toHaveBeenCalledWith('/prof'))
  })

  it('envoie un enseignant vers le chemin de retour demandé', async () => {
    const { login } = await setup('/prof/classes')
    login.mockResolvedValue(ENSEIGNANT)

    await submit()

    await waitFor(() => expect(push).toHaveBeenCalledWith('/prof/classes'))
  })

  // ADR 0036 §5 : connecté avec le mot de passe provisoire du prof, l'élève choisit d'abord le
  // sien — avant le chemin de retour demandé, quel qu'il soit.
  it('envoie un élève au mot de passe provisoire vers le choix de son mot de passe', async () => {
    const { login } = await setup('/devoirs')
    login.mockResolvedValue({ ...ELEVE, doitChangerMotDePasse: true })

    await submit()

    await waitFor(() => expect(push).toHaveBeenCalledWith('/changer-mot-de-passe'))
    expect(push).toHaveBeenCalledTimes(1)
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

// AC1-AC4 (#364, ADR 0036) : la cible du lien « Mot de passe oublié ? » est une page vivante
// qui dit la vérité — le prof réinitialise l'accès du compte EXISTANT de l'élève (identifiant +
// mot de passe provisoire, 7 jours), puis l'élève choisit son propre mot de passe. Rien n'y est
// demandé ni soumis, et plus aucun renvoi vers /rejoindre (qui créerait un autre compte).
describe('MotDePasseOubliePage', () => {
  async function renderPage() {
    const { default: Page } = await import('@/app/mot-de-passe-oublie/page')
    render(<Page />)
  }

  it('donne la consigne « va voir ton prof » en premier, juste sous le titre', async () => {
    await renderPage()
    const titre = screen.getByRole('heading', { level: 1 })
    expect(titre).toHaveTextContent(/récupérer ton accès/i)
    const consigne = titre.nextElementSibling
    expect(consigne).toHaveTextContent(/va voir ton prof/i)
    expect(consigne).toHaveTextContent(/ton identifiant et un mot de passe provisoire/i)
    expect(consigne).toHaveTextContent(/ton compte/i)
    expect(consigne).toHaveTextContent(/tu choisiras ensuite ton propre mot de passe/i)
    expect(consigne).toHaveTextContent(/expire au bout de 7\s*jours/i)
  })

  // AC3/AC4 : mot de passe oublié, identifiant oublié, ou les deux — une seule sortie, qui rend
  // les deux (le prof redonne l'identifiant ET un mot de passe), pour le même compte.
  it('couvre l’oubli du mot de passe, de l’identifiant et des deux', async () => {
    await renderPage()
    expect(
      screen.getByText(/mot de passe oublié, identifiant oublié, ou les deux/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/il te redonne ton/i)).toHaveTextContent(/identifiant/i)
    expect(screen.getByText(/il te redonne ton/i)).toHaveTextContent(/mot de passe provisoire/i)
    expect(
      screen.getByText(/tu gardes ton compte, ta classe et ta progression/i)
    ).toBeInTheDocument()
  })

  it('ne renvoie plus vers /rejoindre, qui créerait un nouveau compte', async () => {
    await renderPage()
    for (const lien of screen.getAllByRole('link')) {
      expect(lien).not.toHaveAttribute('href', '/rejoindre')
    }
    expect(screen.queryByText(/rejoindre ma classe/i)).toBeNull()
  })

  it('garde le retour à la connexion, flèche décorative masquée', async () => {
    await renderPage()
    const retour = screen.getByRole('link', { name: 'Revenir à la connexion' })
    expect(retour).toHaveAttribute('href', '/connexion')
    expect(retour.querySelector('[aria-hidden="true"]')).toHaveTextContent('←')
  })

  it('ne demande aucun e-mail ni identifiant (zéro champ, zéro soumission)', async () => {
    await renderPage()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(document.querySelector('form')).toBeNull()
    expect(screen.queryByText(/ton e-mail/i)).toBeNull()
  })
})
