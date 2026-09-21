import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/progression', () => ({ getSerie: vi.fn() }))

import { getSerie } from '@/lib/progression'
import { StreakBadge } from '../streak-badge'

const mock = vi.mocked(getSerie)

const serie = (joursConsecutifs: number) => ({
  joursConsecutifs,
  dernierJourActif: '2026-09-21',
  gelsRestants: 2,
  actifAujourdhui: true,
})

beforeEach(() => {
  mock.mockReset()
})

describe('StreakBadge', () => {
  it('renders nothing when the student is not logged in (null)', async () => {
    mock.mockResolvedValue(null)
    render(<StreakBadge />)
    await waitFor(() => expect(mock).toHaveBeenCalled())
    expect(screen.queryByTestId('streak-badge')).toBeNull()
  })

  it('never shows "0 jour" — a broken/absent streak stays hidden', async () => {
    mock.mockResolvedValue(serie(0))
    render(<StreakBadge />)
    await waitFor(() => expect(mock).toHaveBeenCalled())
    expect(screen.queryByTestId('streak-badge')).toBeNull()
  })

  it('shows the flame with the real day count (plural)', async () => {
    mock.mockResolvedValue(serie(7))
    render(<StreakBadge />)
    const badge = await screen.findByTestId('streak-badge')
    expect(badge).toHaveTextContent('7')
    expect(badge).toHaveAttribute('title', 'Série de 7 jours')
  })

  it('uses the singular for a one-day streak', async () => {
    mock.mockResolvedValue(serie(1))
    render(<StreakBadge />)
    const badge = await screen.findByTestId('streak-badge')
    expect(badge).toHaveAttribute('title', 'Série de 1 jour')
  })
})
