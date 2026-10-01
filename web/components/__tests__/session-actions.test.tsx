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

  it("ne propose pas l'espace enseignant à un élève", async () => {
    const { getMoi, renderActions } = await setup()
    getMoi.mockResolvedValue(ELEVE)
    renderActions()

    await screen.findByRole('button', { name: 'Se déconnecter' })
    expect(screen.queryByRole('link', { name: 'Espace enseignant' })).not.toBeInTheDocument()
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
