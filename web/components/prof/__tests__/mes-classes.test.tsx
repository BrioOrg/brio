import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

vi.mock('@brio/api-client', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return {
    ...actual,
    listerMesClasses: vi.fn(),
    listerMesEtablissements: vi.fn(),
    listerEtablissements: vi.fn(),
    creerMaClasse: vi.fn(),
    rattacherEtablissement: vi.fn(),
  }
})

vi.mock('@/lib/api', () => ({
  getCatalogue: vi.fn(async () => [
    { niveauCode: '4e', niveauLibelle: 'Quatrième', matieres: [] },
    { niveauCode: '3e', niveauLibelle: 'Troisième', matieres: [] },
  ]),
}))

const PILOTE = { id: 'e1', nom: 'Collège pilote', type: 'college' }
const VOISIN = { id: 'e2', nom: 'Lycée Voisin', type: 'lycee' }
const CLASSE = {
  id: 'cl1',
  etablissementId: 'e1',
  niveauCode: '4e',
  libelle: '4e B',
  anneeScolaire: '2026-2027',
  statut: 'active',
}

async function api() {
  const client = await import('@brio/api-client')
  return {
    listerMesClasses: vi.mocked(client.listerMesClasses),
    listerMesEtablissements: vi.mocked(client.listerMesEtablissements),
    listerEtablissements: vi.mocked(client.listerEtablissements),
    creerMaClasse: vi.mocked(client.creerMaClasse),
    rattacherEtablissement: vi.mocked(client.rattacherEtablissement),
    CoursApiError: client.CoursApiError,
  }
}

async function renderMesClasses() {
  const { MesClasses } = await import('../mes-classes')
  render(<MesClasses />)
}

describe('MesClasses', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const a = await api()
    a.listerMesClasses.mockResolvedValue([])
    a.listerMesEtablissements.mockResolvedValue([PILOTE])
    a.listerEtablissements.mockResolvedValue([PILOTE, VOISIN])
  })

  it('guide un enseignant sans classe vers la création', async () => {
    await renderMesClasses()
    expect(await screen.findByText(/vous n’avez pas encore de classe/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /créer ma première classe/i })).toBeInTheDocument()
  })

  it('liste les classes sous leur établissement', async () => {
    ;(await api()).listerMesClasses.mockResolvedValue([CLASSE])
    await renderMesClasses()

    const section = await screen.findByRole('region', { name: 'Collège pilote' })
    expect(within(section).getByRole('link', { name: /4e B/ })).toHaveAttribute(
      'href',
      '/prof/classes/cl1'
    )
  })

  it('crée une classe dans le seul établissement de l’enseignant puis ouvre sa page', async () => {
    const a = await api()
    a.creerMaClasse.mockResolvedValue(CLASSE)
    const user = userEvent.setup()
    await renderMesClasses()

    await user.click(await screen.findByRole('button', { name: /créer ma première classe/i }))
    // Un seul établissement : rien à choisir.
    expect(screen.queryByLabelText('Établissement')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Niveau'), 'Quatrième')
    await user.type(screen.getByLabelText('Nom de la classe'), ' 4e B ')
    await user.click(screen.getByRole('button', { name: 'Créer la classe' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/prof/classes/cl1'))
    expect(a.creerMaClasse).toHaveBeenCalledWith(expect.any(String), {
      etablissementId: 'e1',
      niveauCode: '4e',
      libelle: '4e B',
    })
  })

  it('demande l’établissement quand l’enseignant en a plusieurs', async () => {
    const a = await api()
    a.listerMesEtablissements.mockResolvedValue([PILOTE, VOISIN])
    const user = userEvent.setup()
    await renderMesClasses()

    await user.click(await screen.findByRole('button', { name: /créer ma première classe/i }))
    await user.selectOptions(screen.getByLabelText('Niveau'), 'Troisième')
    await user.type(screen.getByLabelText('Nom de la classe'), '3e A')
    await user.click(screen.getByRole('button', { name: 'Créer la classe' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/indiquez l’établissement/i)
    expect(a.creerMaClasse).not.toHaveBeenCalled()
  })

  it('affiche le refus du serveur et reste sur le formulaire', async () => {
    const a = await api()
    a.creerMaClasse.mockRejectedValue(
      new a.CoursApiError(403, "Vous n'êtes pas rattaché à cet établissement.")
    )
    const user = userEvent.setup()
    await renderMesClasses()

    await user.click(await screen.findByRole('button', { name: /créer ma première classe/i }))
    await user.selectOptions(screen.getByLabelText('Niveau'), 'Quatrième')
    await user.type(screen.getByLabelText('Nom de la classe'), '4e B')
    await user.click(screen.getByRole('button', { name: 'Créer la classe' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/pas rattaché/i)
    expect(push).not.toHaveBeenCalled()
  })

  it('ne propose d’ajouter que les établissements où l’enseignant n’est pas déjà', async () => {
    const a = await api()
    a.rattacherEtablissement.mockResolvedValue(VOISIN)
    const user = userEvent.setup()
    await renderMesClasses()

    const choix = await screen.findByLabelText(/vous enseignez aussi ailleurs/i)
    expect(within(choix).queryByRole('option', { name: 'Collège pilote' })).not.toBeInTheDocument()
    await user.selectOptions(choix, 'Lycée Voisin')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))

    await waitFor(() =>
      expect(a.rattacherEtablissement).toHaveBeenCalledWith(expect.any(String), 'e2')
    )
  })
})
