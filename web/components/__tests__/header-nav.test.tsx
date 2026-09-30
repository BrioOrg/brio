import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

let pathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

async function setup(path = '/') {
  pathname = path
  const { HeaderNav } = await import('../header-nav')
  render(<HeaderNav />)
}

describe('HeaderNav', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('links to every student section', async () => {
    await setup()
    expect(screen.getByRole('link', { name: 'Parcours' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Devoirs' })).toHaveAttribute('href', '/devoirs')
    expect(screen.getByRole('link', { name: 'Annales' })).toHaveAttribute('href', '/annales')
  })

  it('marks only the current section', async () => {
    await setup('/annales')
    expect(screen.getByRole('link', { name: 'Annales' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Devoirs' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Parcours' })).not.toHaveAttribute('aria-current')
  })

  it('treats catalogue routes as parcours', async () => {
    await setup('/3e/mathematiques')
    expect(screen.getByRole('link', { name: 'Parcours' })).toHaveAttribute('aria-current', 'page')
  })
})
