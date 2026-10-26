import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AppSection } from '@/lib/app-sections'

let pathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

async function setup(path = '/', sections?: AppSection[], label?: string) {
  pathname = path
  const { SectionSidebar } = await import('../section-sidebar')
  const { APP_SECTIONS } = await import('@/lib/app-sections')
  render(<SectionSidebar sections={sections ?? APP_SECTIONS} label={label} />)
}

describe('SectionSidebar', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('links to every student section, named by its label', async () => {
    await setup()
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Parcours' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Devoirs' })).toHaveAttribute('href', '/devoirs')
    expect(screen.getByRole('link', { name: 'Annales' })).toHaveAttribute('href', '/annales')
    expect(screen.getByRole('link', { name: 'Ma classe' })).toHaveAttribute('href', '/ma-classe')
  })

  it('marks only the current section', async () => {
    await setup('/annales')
    expect(screen.getByRole('link', { name: 'Annales' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Devoirs' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Parcours' })).not.toHaveAttribute('aria-current')
  })

  it('marks no section on the Paramètres page', async () => {
    await setup('/parametres')
    for (const name of ['Parcours', 'Devoirs', 'Annales', 'Ma classe']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })

  it('treats catalogue routes as parcours', async () => {
    await setup('/3e/mathematiques')
    expect(screen.getByRole('link', { name: 'Parcours' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the label as an infobulle when a link takes keyboard focus', async () => {
    await setup()
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Parcours' })).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Parcours')
  })

  it('lists the sections it is given, in order, under the given name', async () => {
    await setup(
      '/prof',
      [
        { key: 'a', label: 'Classes', icon: 'users', href: '/prof', routes: ['/prof'] },
        {
          key: 'b',
          label: 'Cours',
          icon: 'book-open',
          href: '/prof/cours',
          routes: ['/prof/cours'],
        },
      ],
      'Espace enseignant'
    )
    const nav = screen.getByRole('navigation', { name: 'Espace enseignant' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual(['Classes', 'Cours'])
    expect(links[0]).toHaveAttribute('aria-current', 'page')
    expect(links[1]).not.toHaveAttribute('aria-current')
  })
})
