import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InscrireEnseignantError } from '@brio/api-client'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/lib/enrollment', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return {
    inscrireEnseignant: vi.fn(),
    InscrireEnseignantError: actual.InscrireEnseignantError,
  }
})

const COMPTE = {
  id: 'uuid-prof',
  role: 'enseignant',
  statut: 'actif',
  nom: 'Mme Durand',
  email: 'durand@exemple.fr',
}

const ETABLISSEMENTS = [
  { id: 'etab-1', nom: 'Collège pilote', type: 'college' },
  { id: 'etab-2', nom: 'Lycée Voisin', type: 'lycee' },
]

async function setup(etablissements = ETABLISSEMENTS) {
  const { inscrireEnseignant } = await import('@/lib/enrollment')
  const { InscriptionEnseignantForm } = await import('../inscription-enseignant-form')
  render(<InscriptionEnseignantForm etablissements={etablissements} />)
  return { inscrireEnseignant: vi.mocked(inscrireEnseignant) }
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/votre nom/i), 'Mme Durand')
  await user.type(screen.getByLabelText(/votre e-mail/i), 'durand@exemple.fr')
  await user.selectOptions(screen.getByLabelText(/votre établissement/i), 'Lycée Voisin')
  await user.type(screen.getByLabelText(/mot de passe/i), 'motdepasse1')
}

describe('InscriptionEnseignantForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('demande le nom, l’e-mail et le mot de passe, sans identifiant à choisir', async () => {
    await setup()
    expect(screen.getByLabelText(/votre nom/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/votre e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/identifiant/i)).not.toBeInTheDocument()
  })

  it('envoie nom, email, motDePasse puis renvoie vers la connexion', async () => {
    const { inscrireEnseignant } = await setup()
    inscrireEnseignant.mockResolvedValue(COMPTE)
    const user = userEvent.setup()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/connexion?from=/prof&inscrit=1'))
    expect(inscrireEnseignant).toHaveBeenCalledWith({
      nom: 'Mme Durand',
      email: 'durand@exemple.fr',
      motDePasse: 'motdepasse1',
      etablissementId: 'etab-2',
    })
  })

  it('demande de choisir un établissement avant d’appeler l’API', async () => {
    const { inscrireEnseignant } = await setup()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/votre nom/i), 'Mme Durand')
    await user.type(screen.getByLabelText(/votre e-mail/i), 'durand@exemple.fr')
    await user.type(screen.getByLabelText(/mot de passe/i), 'motdepasse1')
    await user.click(screen.getByRole('button', { name: /créer mon compte/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/choisissez votre établissement/i)
    expect(inscrireEnseignant).not.toHaveBeenCalled()
  })

  it('présélectionne l’établissement quand il n’y en a qu’un', async () => {
    await setup([ETABLISSEMENTS[0]])
    expect(screen.getByLabelText(/votre établissement/i)).toHaveValue('etab-1')
  })

  it('n’offre pas de formulaire quand aucun établissement n’existe', async () => {
    await setup([])
    expect(screen.getByRole('status')).toHaveTextContent(/aucun établissement/i)
    expect(screen.queryByRole('button', { name: /créer mon compte/i })).not.toBeInTheDocument()
  })

  it('refuse un mot de passe trop court sans appeler l’API', async () => {
    const { inscrireEnseignant } = await setup()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/votre nom/i), 'Mme Durand')
    await user.type(screen.getByLabelText(/votre e-mail/i), 'durand@exemple.fr')
    await user.selectOptions(screen.getByLabelText(/votre établissement/i), 'Collège pilote')
    await user.type(screen.getByLabelText(/mot de passe/i), 'court')
    await user.click(screen.getByRole('button', { name: /créer mon compte/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/au moins 8 caractères/i)
    expect(inscrireEnseignant).not.toHaveBeenCalled()
  })

  it('signale un e-mail déjà utilisé (409) et reste sur le formulaire', async () => {
    const { inscrireEnseignant } = await setup()
    inscrireEnseignant.mockRejectedValue(new InscrireEnseignantError(409))
    const user = userEvent.setup()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /créer mon compte/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/un compte existe déjà/i)
    expect(push).not.toHaveBeenCalled()
  })

  it('signale des informations invalides (400)', async () => {
    const { inscrireEnseignant } = await setup()
    inscrireEnseignant.mockRejectedValue(new InscrireEnseignantError(400))
    const user = userEvent.setup()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /créer mon compte/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/vérifiez vos informations/i)
  })
})
