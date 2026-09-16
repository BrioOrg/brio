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

  it('renders the four app-shell tabs', async () => {
    await setup()
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Parcours' })).toBeInTheDocument()
    // Disabled tabs are buttons, not links.
    expect(screen.getByRole('button', { name: /Social/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exercices/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Profil/ })).toBeInTheDocument()
  })

  it('wires parcours to the home route and marks it current', async () => {
    await setup('/3e/mathematiques')
    const parcours = screen.getByRole('link', { name: 'Parcours' })
    expect(parcours).toHaveAttribute('href', '/')
    expect(parcours).toHaveAttribute('aria-current', 'page')
  })

  it('renders social, exercices and profil as disabled and non-interactive', async () => {
    await setup()
    for (const label of [/Social/, /Exercices/, /Profil/]) {
      const tab = screen.getByRole('button', { name: label })
      expect(tab).toBeDisabled()
      expect(tab).toHaveAttribute('aria-disabled', 'true')
    }
    // None of the disabled sections are links.
    expect(screen.queryByRole('link', { name: /Social/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Exercices/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Profil/ })).not.toBeInTheDocument()
  })
})
