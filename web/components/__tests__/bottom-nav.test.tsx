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
    // Disabled tabs are buttons, not links.
    expect(screen.getByRole('button', { name: /Social/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Profil/ })).toBeInTheDocument()
  })

  it('wires parcours to the home route and marks it current', async () => {
    await setup('/3e/mathematiques')
    const parcours = screen.getByRole('link', { name: 'Parcours' })
    expect(parcours).toHaveAttribute('href', '/')
    expect(parcours).toHaveAttribute('aria-current', 'page')
  })

  it('renders social and profil as disabled and non-interactive', async () => {
    await setup()
    for (const label of [/Social/, /Profil/]) {
      const tab = screen.getByRole('button', { name: label })
      expect(tab).toBeDisabled()
      expect(tab).toHaveAttribute('aria-disabled', 'true')
    }
    // None of the disabled sections are links.
    expect(screen.queryByRole('link', { name: /Social/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Profil/ })).not.toBeInTheDocument()
  })
})
