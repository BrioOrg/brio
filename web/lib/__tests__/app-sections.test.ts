import { describe, it, expect } from 'vitest'
import { activeSectionKey, APP_SECTIONS, PROF_SECTIONS, type AppSection } from '../app-sections'

describe('activeSectionKey', () => {
  it.each([
    ['/', 'accueil'],
    ['/explorer', 'explorer'],
    ['/annales', 'explorer'],
    ['/3e', 'explorer'],
    ['/3e/mathematiques', 'explorer'],
    ['/3e/mathematiques/theoreme-de-pythagore', 'explorer'],
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
