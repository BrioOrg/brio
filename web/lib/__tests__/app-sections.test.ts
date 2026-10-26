import { describe, it, expect } from 'vitest'
import { activeSectionKey, APP_SECTIONS, type AppSection } from '../app-sections'

describe('activeSectionKey', () => {
  it.each([
    ['/', 'parcours'],
    ['/3e/mathematiques/theoreme-de-pythagore', 'parcours'],
    ['/cours/42', 'parcours'],
    ['/devoirs', 'devoirs'],
    ['/devoirs/12', 'devoirs'],
    ['/annales', 'annales'],
    ['/ma-classe', 'ma-classe'],
  ])('puts %s in the %s section', (pathname, key) => {
    expect(activeSectionKey(APP_SECTIONS, pathname)).toBe(key)
  })

  it('puts Paramètres in no section', () => {
    expect(activeSectionKey(APP_SECTIONS, '/parametres')).toBeUndefined()
  })

  it('matches whole path segments only', () => {
    expect(activeSectionKey(APP_SECTIONS, '/devoirsx')).toBe('parcours')
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
