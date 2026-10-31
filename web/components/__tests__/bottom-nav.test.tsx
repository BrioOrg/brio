import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

let pathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

async function setup(path = '/') {
  pathname = path
  const { BottomNav } = await import('../bottom-nav')
  const { APP_SECTIONS, APP_UPCOMING_TABS } = await import('@/lib/app-sections')
  render(<BottomNav sections={APP_SECTIONS} upcoming={APP_UPCOMING_TABS} />)
}

describe('BottomNav', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('renders the wired and disabled app-shell tabs', async () => {
    await setup()
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument()
    // Wired tabs are links.
    expect(screen.getByRole('link', { name: 'Accueil' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ma classe' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explorer' })).toBeInTheDocument()
    // Disabled tabs are buttons, not links.
    expect(screen.getByRole('button', { name: /Communauté/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Profil/ })).toBeInTheDocument()
  })

  it('wires Explorer to its route and marks it current on a catalogue URL', async () => {
    await setup('/3e/mathematiques')
    const explorer = screen.getByRole('link', { name: 'Explorer' })
    expect(explorer).toHaveAttribute('href', '/explorer')
    expect(explorer).toHaveAttribute('aria-current', 'page')
  })

  it('renders communauté as disabled and non-interactive', async () => {
    await setup()
    const communaute = screen.getByRole('button', { name: /Communauté/ })
    expect(communaute).toBeDisabled()
    expect(screen.queryByRole('link', { name: /Communauté/ })).not.toBeInTheDocument()
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

  it('lists the teacher sections, without a disabled placeholder', async () => {
    pathname = '/prof/devoirs/nouveau'
    const { BottomNav } = await import('../bottom-nav')
    const { PROF_SECTIONS } = await import('@/lib/app-sections')
    render(<BottomNav sections={PROF_SECTIONS} label="Navigation de l'espace enseignant" />)

    const nav = screen.getByRole('navigation', { name: "Navigation de l'espace enseignant" })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mes cours' })).toHaveAttribute('href', '/prof')
    expect(screen.getByRole('link', { name: 'Mes classes' })).toHaveAttribute(
      'href',
      '/prof/classes'
    )
    expect(screen.getByRole('link', { name: 'Devoirs' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Mes cours' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
