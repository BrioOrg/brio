import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// #407: the banner lives in the (app) layout, which does not remount on navigation. An exam
// started from /annales must show up without a reload.
vi.mock('@brio/api-client', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return { ...actual, examenActif: vi.fn(), rendreExamen: vi.fn() }
})

import * as client from '@brio/api-client'

import { ExamenBanner, signalerExamenDemarre } from '../examen-banner'

const examenActif = vi.mocked(client.examenActif)

const AUCUN = { enExamen: false, sessionId: null, annaleId: null, titre: null, endsAt: null }
const EN_COURS = {
  enExamen: true,
  sessionId: 's-1',
  annaleId: 'brevet-2025-demo',
  titre: 'Brevet 2025',
  endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
}

beforeEach(() => vi.clearAllMocks())

describe('ExamenBanner', () => {
  it('shows an exam started after it mounted, once told so', async () => {
    examenActif.mockResolvedValueOnce(AUCUN).mockResolvedValueOnce(EN_COURS)
    render(<ExamenBanner />)
    await act(async () => {})
    expect(screen.queryByRole('status')).toBeNull()

    await act(async () => signalerExamenDemarre())

    expect(await screen.findByRole('status')).toHaveTextContent('Examen en cours · Brevet 2025')
    expect(screen.getByRole('button', { name: 'Rendre' })).toBeInTheDocument()
    expect(examenActif).toHaveBeenCalledTimes(2)
  })

  it('stops listening once unmounted', async () => {
    examenActif.mockResolvedValue(AUCUN)
    const { unmount } = render(<ExamenBanner />)
    await act(async () => {})
    unmount()

    signalerExamenDemarre()
    expect(examenActif).toHaveBeenCalledTimes(1)
  })
})
