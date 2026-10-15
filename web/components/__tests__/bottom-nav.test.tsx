import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

let pathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

async function setup(path = '/') {
  pathname = path
  const { BottomNav } = await import('../bottom-nav')
  render(<BottomNav />)
}

describe('BottomNav', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('renders the wired and disabled app-shell tabs', async () => {
    await setup()
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument()
    // Wired tabs are links.
    expect(screen.getByRole('link', { name: 'Parcours' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Devoirs' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Annales' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ma classe' })).toBeInTheDocument()
    // Disabled tabs are buttons, not links.
    expect(screen.getByRole('button', { name: /Profil/ })).toBeInTheDocument()
  })

  it('wires parcours to the home route and marks it current', async () => {
    await setup('/3e/mathematiques')
    const parcours = screen.getByRole('link', { name: 'Parcours' })
    expect(parcours).toHaveAttribute('href', '/')
    expect(parcours).toHaveAttribute('aria-current', 'page')
  })

  it('renders profil as disabled and non-interactive', async () => {
    await setup()
    const profil = screen.getByRole('button', { name: /Profil/ })
    expect(profil).toBeDisabled()
    expect(profil).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('link', { name: /Profil/ })).not.toBeInTheDocument()
    // "Ma classe" replaced the old disabled "Social" placeholder: it is a real link now.
    expect(screen.getByRole('link', { name: 'Ma classe' })).toHaveAttribute('href', '/ma-classe')
    expect(screen.queryByRole('button', { name: /Social/ })).not.toBeInTheDocument()
  })
})
