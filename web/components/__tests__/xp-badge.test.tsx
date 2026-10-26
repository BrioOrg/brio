import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../progression-context', () => ({ useProgression: vi.fn() }))

import { useProgression } from '../progression-context'
import { XpBadge } from '../xp-badge'

const mock = vi.mocked(useProgression)

beforeEach(() => {
  mock.mockReset()
})

describe('XpBadge', () => {
  it('renders nothing when the student is not logged in (no fabricated zero)', () => {
    mock.mockReturnValue({ info: null, serie: null, gain: null, serieChange: null, refresh: vi.fn() })
    render(<XpBadge />)
    expect(screen.queryByTestId('xp-badge')).toBeNull()
  })

  it('shows the real level and XP total', () => {
    mock.mockReturnValue({
      info: { xpTotal: 1250, niveau: 3 },
      serie: null,
      gain: null,
      serieChange: null,
      refresh: vi.fn(),
    })
    render(<XpBadge />)
    expect(screen.getByLabelText('Niveau 3')).toBeTruthy()
    expect(screen.getByText('1250')).toBeTruthy()
  })

  it('flashes the real gain amount when XP is awarded', async () => {
    const base = { serie: null, serieChange: null, refresh: vi.fn() }
    mock.mockReturnValue({ ...base, info: { xpTotal: 100, niveau: 1 }, gain: null })
    const { rerender } = render(<XpBadge />)
    expect(screen.queryByText(/\+10/)).toBeNull()

    mock.mockReturnValue({
      ...base,
      info: { xpTotal: 110, niveau: 1 },
      gain: { amount: 10, id: 1 },
    })
    rerender(<XpBadge />)
    expect(await screen.findByText(/\+10/)).toBeTruthy()
  })

  // #280: the provider outlives the header, which every page remounts. A gain it reported before
  // the badge mounted is not new, so navigating between tabs must not replay « +10 XP ».
  it('does not replay a gain reported before it mounted (navigation remount)', async () => {
    const base = { serie: null, serieChange: null, refresh: vi.fn() }
    mock.mockReturnValue({
      ...base,
      info: { xpTotal: 110, niveau: 1 },
      gain: { amount: 10, id: 1 },
    })
    const { rerender } = render(<XpBadge />)
    expect(screen.getByText('110')).toBeTruthy()
    expect(screen.queryByText(/\+10/)).toBeNull()

    // A later real gain still flashes.
    mock.mockReturnValue({
      ...base,
      info: { xpTotal: 125, niveau: 1 },
      gain: { amount: 15, id: 2 },
    })
    rerender(<XpBadge />)
    expect(await screen.findByText(/\+15/)).toBeTruthy()
  })
})
