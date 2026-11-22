import { describe, it, expect } from 'vitest'
import {
  activeSectionKey,
  APP_SECTIONS,
  navigationEleve,
  PROF_SECTIONS,
  type AppSection,
} from '../app-sections'

describe('activeSectionKey', () => {
  it.each([
    ['/', 'accueil'],
    ['/explorer', 'explorer'],
    // critère 5 (#395) : les annales ont leur section, toute sous-route comprise.
    ['/annales', 'annales'],
    ['/annales/x', 'annales'],
    ['/3e', 'explorer'],
    ['/3e/mathematiques', 'explorer'],
    ['/3e/mathematiques/theoreme-de-pythagore', 'explorer'],
    // critère 6 (#395) : un sujet ouvert depuis les annales reste une page du catalogue.
    ['/3e/mathematiques/brevet-2025-demo', 'explorer'],
    ['/ma-classe', 'ma-classe'],
    ['/devoirs', 'ma-classe'],
    ['/devoirs/12', 'ma-classe'],
    ['/cours/42', 'ma-classe'],
    ['/profil', 'profil'],
  ])('puts %s in the %s section', (pathname, key) => {
    expect(activeSectionKey(APP_SECTIONS, pathname)).toBe(key)
  })

  it('puts Paramètres in no section', () => {
    expect(activeSectionKey(APP_SECTIONS, '/parametres')).toBeUndefined()
  })

  it('matches whole path segments only', () => {
    expect(activeSectionKey(APP_SECTIONS, '/devoirsx')).toBe('explorer')
    // critère 5 (#395) : /annalesx n'est pas sous /annales.
    expect(activeSectionKey(APP_SECTIONS, '/annalesx')).toBe('explorer')
  })

  it('lets an exact route beat a longer or catch-all prefix, on that route only', () => {
    const sections: AppSection[] = [
      { key: 'a', label: 'A', icon: 'user', href: '/', routes: [], exactRoutes: ['/x'] },
      { key: 'b', label: 'B', icon: 'user', href: '/x', routes: ['/x'] },
    ]
    expect(activeSectionKey(sections, '/x')).toBe('a')
    expect(activeSectionKey(sections, '/x/y')).toBe('b')
  })

  it('gives a route to the most specific section', () => {
    const sections: AppSection[] = [
      { key: 'classes', label: 'Classes', icon: 'users', href: '/prof', routes: ['/prof'] },
      {
        key: 'cours',
        label: 'Cours',
        icon: 'book-open',
        href: '/prof/cours',
        routes: ['/prof/cours'],
      },
    ]
    expect(activeSectionKey(sections, '/prof/cours/7')).toBe('cours')
    expect(activeSectionKey(sections, '/prof/classes/3')).toBe('classes')
    expect(activeSectionKey(sections, '/ailleurs')).toBeUndefined()
  })
})

describe('navigationEleve', () => {
  it('keeps the Communauté a disabled tab while its setting is off', () => {
    const { sections, upcoming } = navigationEleve(false)
    expect(sections.map((s) => s.key)).not.toContain('communaute')
    expect(upcoming.map((t) => t.key)).toEqual(['communaute'])
  })

  it('makes it a section before Profil once the setting is on', () => {
    const { sections, upcoming } = navigationEleve(true)
    expect(sections.map((s) => s.key)).toEqual([
      'accueil',
      'ma-classe',
      'explorer',
      'annales',
      'communaute',
      'profil',
    ])
    expect(upcoming).toEqual([])
  })

  // critères 2 et 4 (#395) : Annales juste après Explorer, aucune section existante déplacée.
  it('puts Annales right after Explorer while the setting is off', () => {
    const { sections, upcoming } = navigationEleve(false)
    expect(sections.map((s) => s.key)).toEqual([
      'accueil',
      'ma-classe',
      'explorer',
      'annales',
      'profil',
    ])
    expect(upcoming.map((t) => t.key)).toEqual(['communaute'])
  })

  // critère 1 et 2 (#395) : l'entrée mène à /annales, sans compteur ni pastille (critère 8).
  it.each([true, false])('links Annales to /annales (setting on: %s)', (active) => {
    const annales = navigationEleve(active).sections.find((s) => s.key === 'annales')
    expect(annales).toMatchObject({ label: 'Annales', href: '/annales' })
    expect(activeSectionKey(navigationEleve(active).sections, '/annales')).toBe('annales')
  })

  // critère 6 (#395) : le sujet ouvert reste dans Explorer, que la Communauté soit active ou non.
  it.each([true, false])(
    'keeps an opened annale subject in Explorer (setting on: %s)',
    (active) => {
      expect(
        activeSectionKey(navigationEleve(active).sections, '/3e/mathematiques/brevet-2025-demo')
      ).toBe('explorer')
    }
  )

  // Plafond de la barre du bas élève (ADR 0047) : 6 emplacements au plus, liens et onglets
  // désactivés confondus. Une section de plus demande un nouvel ADR.
  it.each([true, false])('never goes beyond six bottom-bar spaces (setting on: %s)', (active) => {
    const { sections, upcoming } = navigationEleve(active)
    expect(sections.length + upcoming.length).toBeLessThanOrEqual(6)
  })

  it.each(['/communaute', '/communaute/nouvelle', '/communaute/42'])(
    'activates Communauté on %s',
    (pathname) => {
      expect(activeSectionKey(navigationEleve(true).sections, pathname)).toBe('communaute')
    }
  )

  it('does not change the shared list', () => {
    navigationEleve(true)
    expect(APP_SECTIONS.map((s) => s.key)).not.toContain('communaute')
  })
})

describe('PROF_SECTIONS', () => {
  it.each([
    ['/prof', 'cours'],
    ['/prof/cours/42', 'cours'],
    ['/prof/classes', 'classes'],
    ['/prof/classes/c-1', 'classes'],
    ['/prof/devoirs', 'devoirs'],
    ['/prof/devoirs/nouveau', 'devoirs'],
    ['/prof/devoirs/d-1', 'devoirs'],
    ['/prof/signalements', 'signalements'],
    ['/prof/signalements-salon', 'signalements-salon'],
  ])('puts %s in the %s section', (pathname, key) => {
    expect(activeSectionKey(PROF_SECTIONS, pathname)).toBe(key)
  })

  it('links every section to a page under /prof', () => {
    for (const section of PROF_SECTIONS) {
      expect(section.href === '/prof' || section.href.startsWith('/prof/')).toBe(true)
      expect(activeSectionKey(PROF_SECTIONS, section.href)).toBe(section.key)
    }
  })
})
