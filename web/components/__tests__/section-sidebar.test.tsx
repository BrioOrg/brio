import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
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
    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Ma classe' })).toHaveAttribute('href', '/ma-classe')
    expect(screen.getByRole('link', { name: 'Explorer' })).toHaveAttribute('href', '/explorer')
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/profil')
  })

  it('marks only the current section', async () => {
    await setup('/devoirs')
    expect(screen.getByRole('link', { name: 'Ma classe' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Explorer' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Accueil' })).not.toHaveAttribute('aria-current')
  })

  it('marks no section on the Paramètres page', async () => {
    await setup('/parametres')
    for (const name of ['Accueil', 'Ma classe', 'Explorer']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })

  it('treats catalogue routes as Explorer', async () => {
    await setup('/3e/mathematiques')
    expect(screen.getByRole('link', { name: 'Explorer' })).toHaveAttribute('aria-current', 'page')
  })

  it('has no infobulle: the panel shows the labels', async () => {
    await setup()
    await userEvent.tab()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('widens when keyboard focus enters, and closes on Escape or when focus leaves', async () => {
    await setup()
    const panel = screen.getByTestId('section-sidebar-panel')
    expect(panel).toHaveClass('w-16')

    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveFocus()
    expect(panel).toHaveClass('w-60')

    await userEvent.keyboard('{Escape}')
    expect(panel).toHaveClass('w-16')

    // Focus moving on to the next link opens it again, until it leaves the navigation.
    await userEvent.tab()
    expect(panel).toHaveClass('w-60')
    act(() => (document.activeElement as HTMLElement).blur())
    expect(panel).toHaveClass('w-16')
  })

  describe('with a pointer', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      // jsdom has no PointerEvent: without it fireEvent would drop `pointerType`.
      vi.stubGlobal(
        'PointerEvent',
        class extends MouseEvent {
          pointerType: string
          constructor(type: string, init: PointerEventInit = {}) {
            super(type, init)
            this.pointerType = init.pointerType ?? ''
          }
        }
      )
    })
    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    })

    function pointer(type: 'pointerEnter' | 'pointerLeave', pointerType: string) {
      fireEvent[type](screen.getByRole('navigation'), { pointerType })
    }

    it('widens after a short delay on mouse hover and closes as soon as the mouse leaves', async () => {
      await setup()
      const panel = screen.getByTestId('section-sidebar-panel')

      pointer('pointerEnter', 'mouse')
      expect(panel).toHaveClass('w-16')
      act(() => vi.advanceTimersByTime(120))
      expect(panel).toHaveClass('w-60')

      pointer('pointerLeave', 'mouse')
      expect(panel).toHaveClass('w-16')
    })

    it('stays closed when the mouse only crosses the column', async () => {
      await setup()
      const panel = screen.getByTestId('section-sidebar-panel')

      pointer('pointerEnter', 'mouse')
      act(() => vi.advanceTimersByTime(60))
      pointer('pointerLeave', 'mouse')
      act(() => vi.advanceTimersByTime(200))
      expect(panel).toHaveClass('w-16')
    })

    it('does not widen on touch', async () => {
      await setup()
      const panel = screen.getByTestId('section-sidebar-panel')

      pointer('pointerEnter', 'touch')
      act(() => vi.advanceTimersByTime(200))
      expect(panel).toHaveClass('w-16')
    })
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
