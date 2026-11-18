import { render, screen, within } from '@testing-library/react'
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
  })

  // critère 4 (#395) : six emplacements, Annales après Explorer, chacun un lien direct (ou
  // l'onglet désactivé Communauté), aucun déplacé dans un menu.
  it('keeps the six spaces in order, with Annales after Explorer and Communauté before Profil', async () => {
    await setup()
    const noms = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(noms).toEqual([
      'Accueil',
      'Ma classe',
      'Explorer',
      'Annales',
      'Communauté — bientôt disponible',
      'Profil',
    ])
  })

  // critère 2 (#395) : l'entrée Annales est un lien, jamais un bouton désactivé, même quand la
  // Communauté est inactive ; son nom accessible est son libellé (critère 8 : rien d'autre).
  it('wires Annales as a link to its route while the Communauté is off', async () => {
    await setup()
    const annales = screen.getByRole('link', { name: 'Annales' })
    expect(annales).toHaveAttribute('href', '/annales')
    expect(annales).toHaveTextContent(/^Annales$/)
    expect(screen.queryByRole('button', { name: /Annales/ })).not.toBeInTheDocument()
  })

  // critère 5 (#395) : sur /annales, Annales est le seul lien courant de la barre.
  it('marks Annales, and only Annales, current on /annales', async () => {
    await setup('/annales')
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    const annales = within(nav).getByRole('link', { name: 'Annales' })
    expect(annales).toHaveAttribute('href', '/annales')
    expect(annales).toHaveAttribute('aria-current', 'page')
    const courants = nav.querySelectorAll('[aria-current="page"]')
    expect(courants).toHaveLength(1)
    expect(courants[0]).toBe(annales)
    expect(within(nav).getByRole('link', { name: 'Explorer' })).not.toHaveAttribute('aria-current')
  })

  // critère 6 (#395) : un sujet ouvert depuis les annales a exactement un lien courant, Explorer.
  it('marks Explorer, and only Explorer, current on an opened annale subject', async () => {
    await setup('/3e/mathematiques/brevet-2025-demo')
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    const courants = nav.querySelectorAll('[aria-current="page"]')
    expect(courants).toHaveLength(1)
    expect(courants[0]).toBe(within(nav).getByRole('link', { name: 'Explorer' }))
  })

  // critères 2 et 4 (#395) : Communauté active, six liens, Annales compris.
  it('lists six links, Annales among them, once the Communauté is on', async () => {
    pathname = '/'
    const { BottomNav } = await import('../bottom-nav')
    const { navigationEleve } = await import('@/lib/app-sections')
    render(<BottomNav {...navigationEleve(true)} />)
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent)
    ).toEqual(['Accueil', 'Ma classe', 'Explorer', 'Annales', 'Communauté', 'Profil'])
    expect(within(nav).queryByRole('button')).not.toBeInTheDocument()
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

  it('links Communauté and marks it current once its setting is on', async () => {
    pathname = '/communaute/42'
    const { BottomNav } = await import('../bottom-nav')
    const { navigationEleve } = await import('@/lib/app-sections')
    render(<BottomNav {...navigationEleve(true)} />)
    const communaute = screen.getByRole('link', { name: 'Communauté' })
    expect(communaute).toHaveAttribute('href', '/communaute')
    expect(communaute).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: /Communauté/ })).not.toBeInTheDocument()
  })

  it('wires Profil to its route and marks it current there', async () => {
    await setup('/profil')
    const profil = screen.getByRole('link', { name: 'Profil' })
    expect(profil).toHaveAttribute('href', '/profil')
    expect(profil).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: /Profil/ })).not.toBeInTheDocument()
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
