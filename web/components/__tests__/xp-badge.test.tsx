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
    mock.mockReturnValue({ info: null, gain: null, refresh: vi.fn() })
    render(<XpBadge />)
    expect(screen.queryByTestId('xp-badge')).toBeNull()
  })

  it('shows the real level and XP total', () => {
    mock.mockReturnValue({ info: { xpTotal: 1250, niveau: 3 }, gain: null, refresh: vi.fn() })
    render(<XpBadge />)
    expect(screen.getByLabelText('Niveau 3')).toBeTruthy()
    expect(screen.getByText('1250')).toBeTruthy()
  })

  it('flashes the real gain amount when XP is awarded', async () => {
    mock.mockReturnValue({
      info: { xpTotal: 110, niveau: 1 },
      gain: { amount: 10, id: 1 },
      refresh: vi.fn(),
    })
    render(<XpBadge />)
    expect(await screen.findByText(/\+10/)).toBeTruthy()
  })
})
