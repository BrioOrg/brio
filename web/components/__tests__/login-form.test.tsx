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
  await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse')
  await user.click(screen.getByRole('button', { name: 'Se connecter', exact: true }))
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rend les champs identifiant et mot de passe', async () => {
    await setup()
    expect(screen.getByLabelText(/identifiant ou e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Se connecter', exact: true })).toBeInTheDocument()
  })

  // AC1 (#364) : le lien n'est plus mort — il pointe vers `/mot-de-passe-oublie`, une route
  // désormais vivante (voir la suite « MotDePasseOubliePage » plus bas, qui en prouve le rendu).
  it('propose le lien vers l’écran de récupération d’accès', async () => {
    await setup()
    expect(
      screen.getByRole('link', { name: 'Identifiant ou mot de passe oublié ?' })
    ).toHaveAttribute('href', '/mot-de-passe-oublie')
  })

  // Simulation porte 6 : sur téléphone, le clavier mettait une majuscule à l'identifiant.
  it('ne laisse pas le clavier corriger l’identifiant', async () => {
    await setup()
    const identifiant = screen.getByLabelText(/identifiant ou e-mail/i)
    expect(identifiant).toHaveAttribute('autocapitalize', 'off')
    expect(identifiant).toHaveAttribute('autocorrect', 'off')
    expect(identifiant).toHaveAttribute('spellcheck', 'false')
  })

  // D7 : l'exemple ressemble aux vrais identifiants générés (10 lettres et chiffres minuscules).
  it('donne un exemple d’identifiant à la forme des identifiants générés', async () => {
    await setup()
    expect(screen.getByLabelText(/identifiant ou e-mail/i)).toHaveAttribute(
      'placeholder',
      expect.stringMatching(/^[23456789a-hjkmnp-z]{10}$/)
    )
  })

  // R5 : un bouton à bascule, au libellé fixe, montre le mot de passe tapé.
  it('affiche le mot de passe à la demande, libellé fixe et aria-pressed', async () => {
    await setup()
    const user = userEvent.setup()
    const champ = screen.getByLabelText('Mot de passe')
    const afficher = screen.getByRole('button', { name: 'Afficher le mot de passe' })
    expect(champ).toHaveAttribute('type', 'password')
    expect(afficher).toHaveAttribute('aria-pressed', 'false')
    expect(afficher).toHaveAttribute('type', 'button')

    await user.click(afficher)
    expect(champ).toHaveAttribute('type', 'text')
    expect(afficher).toHaveAttribute('aria-pressed', 'true')
    expect(afficher).toHaveAccessibleName('Afficher le mot de passe')

    await user.click(afficher)
    expect(champ).toHaveAttribute('type', 'password')
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
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse')
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
    await user.type(screen.getByLabelText('Mot de passe'), 'faux')
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
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse')
    await user.click(screen.getByRole('button', { name: 'Se connecter', exact: true }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/la connexion a échoué/i)
  })
})

// AC1-AC4 (#364, ADR 0036) : la cible du lien « Identifiant ou mot de passe oublié ? » est une page vivante
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
    expect(consigne).toHaveTextContent(/ensuite, tu choisis ton propre mot de passe/i)
    expect(screen.getByText(/il expire au bout de 7\s*jours/i)).toBeInTheDocument()
  })

  // Arbitrage N3 (porte 6) : pas d'autre solution que le prof, ne pas créer de nouveau compte,
  // la progression attend. Aucun canal de contact n'existe : la page n'en invente pas.
  it('dit qu’il n’y a pas d’autre solution et de ne pas créer de nouveau compte', async () => {
    await renderPage()
    expect(screen.getByText(/il n’y a pas d’autre solution/i)).toBeInTheDocument()
    expect(screen.getByText(/ne crée pas de nouveau compte/i)).toBeInTheDocument()
    expect(screen.getByText(/ta progression t’attend/i, { exact: false })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/@|mailto/)
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

  // Décision N3 du 2026-11-17 : sans classe active, l'élève n'a pas de prof pour réinitialiser.
  // La page le dit sans inventer de canal de contact (ticket #367).
  it('dit honnêtement qu’un élève sans classe active ne peut pas encore récupérer son accès', async () => {
    await renderPage()
    expect(
      screen.getByText(/tu t’es inscrit sans classe, ou ta classe est fermée/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/ton accès ne peut pas encore être récupéré en ligne/i)
    ).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/@|mailto/)
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
    // The page says the opposite: no e-mail is ever needed.
    expect(screen.getByText(/pas besoin de ton e-mail/i)).toBeInTheDocument()
  })
})
