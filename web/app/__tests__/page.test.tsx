import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the api-client module so tests never reach the network
vi.mock('@brio/api-client', () => ({
  createApiClient: vi.fn(),
}))

describe('HomePage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
  })

  it('affiche les données de ping quand le backend répond', async () => {
    const { createApiClient } = await import('@brio/api-client')
    vi.mocked(createApiClient).mockReturnValue({
      GET: vi.fn().mockResolvedValue({
        data: { status: 'ok', version: '0.0.1-SNAPSHOT', timestamp: '2026-08-16T18:00:00Z' },
        error: undefined,
      }),
    } as never)

    const { default: Page } = await import('../page')
    render(await Page())

    expect(screen.getByText('ok')).toBeInTheDocument()
    expect(screen.getByText('0.0.1-SNAPSHOT')).toBeInTheDocument()
  })

  it("affiche l'état d'erreur quand le backend est inaccessible", async () => {
    const { createApiClient } = await import('@brio/api-client')
    vi.mocked(createApiClient).mockReturnValue({
      GET: vi.fn().mockResolvedValue({
        data: undefined,
        error: { message: 'connect ECONNREFUSED' },
      }),
    } as never)

    const { default: Page } = await import('../page')
    render(await Page())

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Serveur inaccessible')).toBeInTheDocument()
  })
})
