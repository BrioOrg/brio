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
}))

async function mocks() {
  const { logout } = await import('@/lib/session')
  return { logout: vi.mocked(logout) }
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
