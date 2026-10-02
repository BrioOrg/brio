import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/progression', () => ({ getSerie: vi.fn(), getProgression: vi.fn() }))
vi.mock('@/lib/session', () => ({ getMoi: vi.fn() }))

import { getProgression, getSerie } from '@/lib/progression'
import { getMoi } from '@/lib/session'
import { ProgressionProvider } from '../progression-context'
import { StreakBadge } from '../streak-badge'

const mock = vi.mocked(getSerie)
const moi = vi.mocked(getMoi)

const compte = (role: string) => ({ id: '1', role, statut: 'actif', nom: null, email: null })

function renderBadge() {
  return render(
    <ProgressionProvider>
      <StreakBadge />
    </ProgressionProvider>
  )
}

const serie = (joursConsecutifs: number) => ({
  joursConsecutifs,
  dernierJourActif: '2026-09-21',
  gelsRestants: 2,
  actifAujourdhui: true,
})

beforeEach(() => {
  mock.mockReset()
  moi.mockReset()
  moi.mockResolvedValue(compte('eleve'))
  vi.mocked(getProgression).mockResolvedValue(null)
})

describe('StreakBadge', () => {
  it('never shows a streak on a teacher account', async () => {
    moi.mockResolvedValue(compte('enseignant'))
    mock.mockResolvedValue(serie(7))
    renderBadge()
    await waitFor(() => expect(moi).toHaveBeenCalled())
    expect(mock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('streak-badge')).toBeNull()
  })

  it('renders nothing when the student is not logged in (null)', async () => {
    mock.mockResolvedValue(null)
    renderBadge()
    await waitFor(() => expect(mock).toHaveBeenCalled())
    expect(screen.queryByTestId('streak-badge')).toBeNull()
  })

  it('never shows "0 jour" — a broken/absent streak stays hidden', async () => {
    mock.mockResolvedValue(serie(0))
    renderBadge()
    await waitFor(() => expect(mock).toHaveBeenCalled())
    expect(screen.queryByTestId('streak-badge')).toBeNull()
  })

  it('shows the flame with the real day count (plural)', async () => {
    mock.mockResolvedValue(serie(7))
    renderBadge()
    const badge = await screen.findByTestId('streak-badge')
    expect(badge).toHaveTextContent('7')
    expect(badge).toHaveAttribute('title', 'Série de 7 jours')
  })

  it('uses the singular for a one-day streak', async () => {
    mock.mockResolvedValue(serie(1))
    renderBadge()
    const badge = await screen.findByTestId('streak-badge')
    expect(badge).toHaveAttribute('title', 'Série de 1 jour')
  })
})
