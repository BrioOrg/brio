import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/session', () => ({
  logout: vi.fn(),
  getMoi: vi.fn(),
}))

const ELEVE = { id: 'abc', role: 'eleve', statut: 'actif', nom: null, email: null }
const ENSEIGNANT = { id: 'def', role: 'enseignant', statut: 'actif', nom: 'P', email: 'p@t.fr' }
const ADMIN = { id: 'ghi', role: 'admin_brio', statut: 'actif', nom: 'A', email: 'a@t.fr' }

async function setup() {
  const { getMoi } = await import('@/lib/session')
  const { SessionActions } = await import('../session-actions')
  return {
    getMoi: vi.mocked(getMoi),
    renderActions: () => render(<SessionActions />),
  }
}

describe('SessionActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche le bouton de déconnexion quand une session existe', async () => {
    const { getMoi, renderActions } = await setup()
    getMoi.mockResolvedValue(ELEVE)
    renderActions()

    expect(await screen.findByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  })

  it("propose l'espace enseignant à un enseignant", async () => {
    const { getMoi, renderActions } = await setup()
    getMoi.mockResolvedValue(ENSEIGNANT)
    renderActions()

    expect(await screen.findByRole('link', { name: 'Espace enseignant' })).toHaveAttribute(
      'href',
      '/prof'
    )
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  })

  it('affiche le rôle élève du compte (#285)', async () => {
    const { getMoi, renderActions } = await setup()
    getMoi.mockResolvedValue(ELEVE)
    renderActions()

    expect(await screen.findByText('Compte élève')).toBeInTheDocument()
    expect(screen.queryByText('Compte enseignant')).not.toBeInTheDocument()
  })

  it('affiche le rôle enseignant, y compris dans le catalogue élève (#285)', async () => {
    const { getMoi, renderActions } = await setup()
    getMoi.mockResolvedValue(ENSEIGNANT)
    renderActions()

    expect(await screen.findByText('Compte enseignant')).toBeInTheDocument()
    expect(screen.queryByText('Compte élève')).not.toBeInTheDocument()
  })

  it("ne propose pas l'espace enseignant à un élève", async () => {
    const { getMoi, renderActions } = await setup()
    getMoi.mockResolvedValue(ELEVE)
    renderActions()

    await screen.findByRole('button', { name: 'Se déconnecter' })
    expect(screen.queryByRole('link', { name: 'Espace enseignant' })).not.toBeInTheDocument()
  })

  it('propose la console de modération à un admin_brio (#338)', async () => {
    const { getMoi, renderActions } = await setup()
    getMoi.mockResolvedValue(ADMIN)
    renderActions()

    expect(await screen.findByRole('link', { name: 'Modération' })).toHaveAttribute(
      'href',
      '/admin/communaute'
    )
    expect(screen.queryByRole('link', { name: 'Espace enseignant' })).not.toBeInTheDocument()
  })

  it.each([
    ['élève', ELEVE],
    ['enseignant', ENSEIGNANT],
  ])('ne propose pas la console de modération à un compte %s (#338)', async (_, compte) => {
    const { getMoi, renderActions } = await setup()
    getMoi.mockResolvedValue(compte)
    renderActions()

    await screen.findByRole('button', { name: 'Se déconnecter' })
    expect(screen.queryByRole('link', { name: 'Modération' })).not.toBeInTheDocument()
  })

  it("n'affiche rien pour un visiteur non connecté", async () => {
    const { getMoi, renderActions } = await setup()
    getMoi.mockResolvedValue(null)
    const { container } = renderActions()

    await waitFor(() => expect(getMoi).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it("n'affiche rien quand l'état de la session est inconnu", async () => {
    const { getMoi, renderActions } = await setup()
    getMoi.mockRejectedValue(new Error('réseau'))
    const { container } = renderActions()

    await waitFor(() => expect(getMoi).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
