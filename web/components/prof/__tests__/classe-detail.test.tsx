import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@brio/api-client', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return {
    ...actual,
    listerMesClasses: vi.fn(),
    getCodeClasse: vi.fn(),
    genererCodeClasse: vi.fn(),
    listerInscrits: vi.fn(),
    renommerEleve: vi.fn(),
  }
})

const CLASSE = {
  id: 'cl1',
  etablissementId: 'e1',
  niveauCode: '4e',
  libelle: '4e B',
  anneeScolaire: '2026-2027',
  statut: 'active',
}
const CODE_ACTIF = { id: 'k1', expireAt: '2026-10-14T10:00:00Z', usages: 3, usagesMax: 40 }
const LEA = { compteId: 'a1', nomAffiche: 'Léa', depuis: '2026-09-30', homonyme: false }

async function api() {
  const client = await import('@brio/api-client')
  return {
    listerMesClasses: vi.mocked(client.listerMesClasses),
    getCodeClasse: vi.mocked(client.getCodeClasse),
    genererCodeClasse: vi.mocked(client.genererCodeClasse),
    listerInscrits: vi.mocked(client.listerInscrits),
    renommerEleve: vi.mocked(client.renommerEleve),
  }
}

async function renderClasse(classeId = 'cl1') {
  const { ClasseDetail } = await import('../classe-detail')
  render(<ClasseDetail classeId={classeId} />)
}

describe('ClasseDetail', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const a = await api()
    a.listerMesClasses.mockResolvedValue([CLASSE])
    a.getCodeClasse.mockResolvedValue(null)
    a.listerInscrits.mockResolvedValue([])
  })

  afterEach(() => vi.unstubAllGlobals())

  it('ne montre rien d’une classe qui n’est pas celle de l’enseignant', async () => {
    await renderClasse('autre')
    expect(await screen.findByText(/cette classe est introuvable/i)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Code de classe' })).not.toBeInTheDocument()
  })

  it('génère un premier code et l’affiche une fois, en groupes lisibles', async () => {
    const a = await api()
    a.genererCodeClasse.mockResolvedValue({ ...CODE_ACTIF, usages: 0, code: '4EB22K9PXYZ7' })
    const user = userEvent.setup()
    await renderClasse()

    expect(await screen.findByText(/n’a pas de code actif/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Générer un code' }))

    expect(await screen.findByTestId('code-genere')).toHaveTextContent('4EB2-2K9P-XYZ7')
    expect(screen.getByText(/il ne sera plus affiché/i)).toBeInTheDocument()
    expect(screen.getByText(/0 utilisation sur 40/)).toBeInTheDocument()
  })

  it('ne réaffiche jamais un code existant, seulement son usage', async () => {
    ;(await api()).getCodeClasse.mockResolvedValue(CODE_ACTIF)
    await renderClasse()

    expect(await screen.findByText(/3 utilisations sur 40/)).toBeInTheDocument()
    expect(screen.getByText(/n’est pas réaffichable/i)).toBeInTheDocument()
    expect(screen.queryByTestId('code-genere')).not.toBeInTheDocument()
  })

  it('demande confirmation avant de remplacer un code actif', async () => {
    const a = await api()
    a.getCodeClasse.mockResolvedValue(CODE_ACTIF)
    const confirmer = vi.fn(() => false)
    vi.stubGlobal('confirm', confirmer)
    const user = userEvent.setup()
    await renderClasse()

    await user.click(await screen.findByRole('button', { name: 'Générer un nouveau code' }))

    expect(confirmer).toHaveBeenCalled()
    expect(a.genererCodeClasse).not.toHaveBeenCalled()
  })

  it('dit qu’aucun élève n’a rejoint la classe', async () => {
    await renderClasse()
    expect(await screen.findByText(/aucun élève n’a encore rejoint/i)).toBeInTheDocument()
  })

  it('signale un homonyme et suggère une initiale', async () => {
    ;(await api()).listerInscrits.mockResolvedValue([
      { ...LEA, homonyme: true },
      { ...LEA, compteId: 'a2', homonyme: true },
    ])
    await renderClasse()
    expect(await screen.findAllByText(/un autre élève de la classe porte ce nom/i)).toHaveLength(2)
  })

  it('renomme un élève puis recharge la liste', async () => {
    const a = await api()
    a.listerInscrits.mockResolvedValueOnce([LEA])
    a.listerInscrits.mockResolvedValueOnce([{ ...LEA, nomAffiche: 'Léa B.' }])
    a.renommerEleve.mockResolvedValue({ ...LEA, nomAffiche: 'Léa B.' })
    const user = userEvent.setup()
    await renderClasse()

    await user.click(await screen.findByRole('button', { name: 'Renommer Léa' }))
    const champ = screen.getByLabelText('Nom affiché de Léa')
    await user.clear(champ)
    await user.type(champ, 'Léa B.')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(a.renommerEleve).toHaveBeenCalledWith(expect.any(String), 'cl1', 'a1', 'Léa B.')
    )
    expect(await screen.findByText('Léa B.')).toBeInTheDocument()
  })
})
