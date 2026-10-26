import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// The account and progression parts of the bar fetch on mount; they are not under test here.
vi.mock('@/components/session-actions', () => ({ SessionActions: () => null }))
vi.mock('@/components/xp-badge', () => ({ XpBadge: () => null }))
vi.mock('@/components/streak-badge', () => ({ StreakBadge: () => null }))

import { SiteHeader } from '../site-header'

describe('SiteHeader', () => {
  it('has no theme control: the theme choice lives on the Paramètres page (#284)', () => {
    render(<SiteHeader crumbs={[{ label: 'Paramètres' }]} />)
    expect(screen.queryByRole('button', { name: /Thème/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Thème/)).not.toBeInTheDocument()
  })

  it('keeps the burger menu, the way to Paramètres', () => {
    render(<SiteHeader />)
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument()
  })
})
