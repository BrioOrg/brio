import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InscrireEleveError } from '@brio/api-client'

vi.mock('@/lib/enrollment', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return {
    inscrireEleve: vi.fn(),
    InscrireEleveError: actual.InscrireEleveError,
  }
})

const EN_ATTENTE = {
  id: 'uuid-b',
  identifiantConnexion: 'eleve.6e.abc',
  statut: 'en_attente_consentement',
}

async function setup() {
  const { inscrireEleve } = await import('@/lib/enrollment')
  const { InscriptionForm } = await import('../inscription-form')
  render(<InscriptionForm />)
  return { inscrireEleve: vi.mocked(inscrireEleve) }
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/ton niveau/i), '4e')
  await user.type(screen.getByLabelText(/mot de passe/i), 'motdepasse1')
  await user.type(screen.getByLabelText(/e-mail de ton parent/i), 'parent@exemple.fr')
}

describe('InscriptionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rend le select de niveau, le mot de passe et l'e-mail parent", async () => {
    await setup()
    expect(screen.getByLabelText(/ton niveau/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/e-mail de ton parent/i)).toBeInTheDocument()
  })

  it('propose les quatre niveaux collège', async () => {
    await setup()
    const select = screen.getByLabelText(/ton niveau/i)
    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.value)
    expect(options).toEqual(['6e', '5e', '4e', '3e'])
  })

  it("envoie niveauDeclare, motDePasse, emailParent puis affiche l'ecran d'attente avec l'identifiant", async () => {
    const { inscrireEleve } = await setup()
    inscrireEleve.mockResolvedValue(EN_ATTENTE)

    const user = userEvent.setup()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() =>
      expect(inscrireEleve).toHaveBeenCalledWith({
        niveauDeclare: '4e',
        motDePasse: 'motdepasse1',
        emailParent: 'parent@exemple.fr',
      })
    )

    // Waiting screen: identifiant shown prominently, link to /connexion.
    expect(await screen.findByText('eleve.6e.abc')).toBeInTheDocument()
    expect(screen.getByText(/feu vert de ton parent/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /me connecter/i })).toHaveAttribute(
      'href',
      '/connexion'
    )
  })

  it("refuse un mot de passe trop court sans appeler l'API", async () => {
    const { inscrireEleve } = await setup()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/mot de passe/i), 'court')
    await user.type(screen.getByLabelText(/e-mail de ton parent/i), 'parent@exemple.fr')
    await user.click(screen.getByRole('button', { name: /créer mon compte/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/au moins 8 caractères/i)
    expect(inscrireEleve).not.toHaveBeenCalled()
  })

  it('affiche un message clair sur erreur 400', async () => {
    const { inscrireEleve } = await setup()
    inscrireEleve.mockRejectedValue(new InscrireEleveError(400))

    const user = userEvent.setup()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /créer mon compte/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/vérifie tes informations/i)
  })

  it('affiche un message générique sur erreur inattendue', async () => {
    const { inscrireEleve } = await setup()
    inscrireEleve.mockRejectedValue(new InscrireEleveError(500))

    const user = userEvent.setup()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /créer mon compte/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/la demande a échoué/i)
  })
})
