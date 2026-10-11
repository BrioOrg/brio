import { describe, expect, it } from 'vitest'
import type { Diapo } from '@brio/content'
import { indexDiapo, libelleDiapo, modeInitial, sectionTerminee, urlAvecDiapo } from '@/lib/diapos'

const DECK: Diapo[] = [
  { id: 'debut', kind: 'debut', blockIds: ['objectifs'] },
  { id: 'intro', kind: 'lecon', sectionId: 'lecon', blockIds: ['intro', 'definition', 'figure'] },
  { id: 'ex1', kind: 'exercice', sectionId: 'lecon', blockIds: ['ex1'] },
  { id: 'ex2', kind: 'exercice', sectionId: 'exercices', blockIds: ['ex2'] },
  { id: 'fin', kind: 'fin', blockIds: [] },
]

describe('modeInitial', () => {
  it('should open the interactive mode when ?diapo is present, whatever the cookie says', () => {
    expect(modeInitial('ex1', 'lecture')).toBe('interactif')
  })

  it('should follow the cookie without ?diapo', () => {
    expect(modeInitial(undefined, 'lecture')).toBe('lecture')
    expect(modeInitial(undefined, 'interactif')).toBe('interactif')
  })

  it('should open the interactive mode on a first visit or an unknown cookie value', () => {
    expect(modeInitial(undefined, undefined)).toBe('interactif')
    expect(modeInitial(undefined, 'n-importe-quoi')).toBe('interactif')
  })
})

describe('indexDiapo', () => {
  it('should find a slide by its id', () => {
    expect(indexDiapo(DECK, 'ex2')).toBe(3)
    expect(indexDiapo(DECK, 'fin')).toBe(4)
  })

  it('should open the slide holding a block that no longer opens a slide', () => {
    expect(indexDiapo(DECK, 'figure')).toBe(1)
    expect(indexDiapo(DECK, 'objectifs')).toBe(0)
  })

  it('should open the first slide of a section given its id', () => {
    expect(indexDiapo(DECK, 'exercices')).toBe(3)
  })

  it('should fall back to debut for an unknown or missing id', () => {
    expect(indexDiapo(DECK, 'disparu')).toBe(0)
    expect(indexDiapo(DECK, null)).toBe(0)
    expect(indexDiapo(DECK, '')).toBe(0)
  })
})

describe('sectionTerminee', () => {
  it('should name the section whose last slide this is', () => {
    expect(sectionTerminee(DECK, 2)).toBe('lecon')
    expect(sectionTerminee(DECK, 3)).toBe('exercices')
  })

  it('should give nothing inside a section or outside any section', () => {
    expect(sectionTerminee(DECK, 1)).toBeNull()
    expect(sectionTerminee(DECK, 0)).toBeNull()
    expect(sectionTerminee(DECK, 4)).toBeNull()
  })
})

describe('libelleDiapo', () => {
  const titles = { lecon: 'Le théorème', exercices: 'Exercices' }

  it('should name position, kind and section', () => {
    expect(libelleDiapo(DECK[2], 2, 5, titles)).toBe('Diapo 3 sur 5 · Exercice · Le théorème')
  })

  it('should leave out the section for the opening and the end', () => {
    expect(libelleDiapo(DECK[0], 0, 5, titles)).toBe('Diapo 1 sur 5 · Ouverture')
    expect(libelleDiapo(DECK[4], 4, 5, titles)).toBe('Diapo 5 sur 5 · Fin du chapitre')
  })
})

describe('urlAvecDiapo', () => {
  it('should set, replace or remove ?diapo and keep the other parameters', () => {
    expect(urlAvecDiapo('http://x/3e/m/s', 'ex1')).toBe('/3e/m/s?diapo=ex1')
    expect(urlAvecDiapo('http://x/3e/m/s?diapo=ex1&a=1', 'ex2')).toBe('/3e/m/s?diapo=ex2&a=1')
    expect(urlAvecDiapo('http://x/3e/m/s?a=1&diapo=ex1', null)).toBe('/3e/m/s?a=1')
  })
})
