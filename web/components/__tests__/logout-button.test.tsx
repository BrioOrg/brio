import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

vi.mock('@/lib/session', () => ({
  logout: vi.fn(),
  getMoi: vi.fn(),
}))

const COMPTE = { id: 'abc', role: 'eleve', statut: 'actif', nom: null, email: null }

async function mocks() {
  const { logout, getMoi } = await import('@/lib/session')
  return { logout: vi.mocked(logout), getMoi: vi.mocked(getMoi) }
}

describe('LogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('déconnecte en un clic puis renvoie vers /connexion', async () => {
    const { logout } = await mocks()
    logout.mockResolvedValue(undefined)
    const { LogoutButton } = await import('../logout-button')
    render(<LogoutButton />)

    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/connexion'))
    expect(logout).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('dit que la session est toujours ouverte quand la déconnexion échoue', async () => {
    const { logout } = await mocks()
    logout.mockRejectedValue(new Error('403'))
    const { LogoutButton } = await import('../logout-button')
    render(<LogoutButton />)

    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/la session est toujours ouverte/i)
    expect(push).not.toHaveBeenCalled()
    // The button is usable again for a retry.
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeEnabled()
  })
})

describe('SessionLogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche le bouton quand une session existe', async () => {
    const { getMoi } = await mocks()
    getMoi.mockResolvedValue(COMPTE)
    const { SessionLogoutButton } = await import('../session-logout-button')
    render(<SessionLogoutButton />)

    expect(await screen.findByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  })

  it("n'affiche rien pour un visiteur non connecté", async () => {
    const { getMoi } = await mocks()
    getMoi.mockResolvedValue(null)
    const { SessionLogoutButton } = await import('../session-logout-button')
    render(<SessionLogoutButton />)

    await waitFor(() => expect(getMoi).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).not.toBeInTheDocument()
  })

  it("n'affiche rien quand l'état de la session est inconnu", async () => {
    const { getMoi } = await mocks()
    getMoi.mockRejectedValue(new Error('réseau'))
    const { SessionLogoutButton } = await import('../session-logout-button')
    render(<SessionLogoutButton />)

    await waitFor(() => expect(getMoi).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).not.toBeInTheDocument()
  })
})
