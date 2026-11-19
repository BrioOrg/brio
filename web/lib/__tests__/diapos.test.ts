import { describe, expect, it } from 'vitest'
import type { Diapo } from '@brio/content'
import {
  etatAuMontage,
  etatDiapo,
  indexDiapo,
  libelleDiapo,
  modeDuCookie,
  modeInitial,
  sectionTerminee,
  urlAvecDiapo,
} from '@/lib/diapos'

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

describe('modeDuCookie', () => {
  it('should read the mode cookie among the others', () => {
    expect(modeDuCookie('a=1; brio_mode_chapitre=lecture; b=2')).toBe('lecture')
    expect(modeDuCookie('brio_mode_chapitre=interactif')).toBe('interactif')
  })

  it('should give nothing when the cookie is absent', () => {
    expect(modeDuCookie('')).toBeUndefined()
    expect(modeDuCookie('a=1; autre_brio_mode_chapitre=lecture')).toBeUndefined()
  })

  it('should read it as the server does: the last one wins, decoded, an empty one kept', () => {
    expect(modeDuCookie('brio_mode_chapitre=interactif; brio_mode_chapitre=lecture')).toBe(
      'lecture'
    )
    expect(modeDuCookie('brio_mode_chapitre=lect%75re')).toBe('lecture')
    expect(modeDuCookie('brio_mode_chapitre=lecture; brio_mode_chapitre=%E0')).toBe('lecture')
    expect(modeDuCookie('brio_mode_chapitre=')).toBe('')
  })
})

describe('etatAuMontage (ADR 0046 §4)', () => {
  const props = { mode: 'interactif', index: 0 } as const

  it('should follow ?diapo when it names another slide than the props', () => {
    expect(etatAuMontage(DECK, props, '?diapo=ex2', undefined)).toEqual({
      mode: 'interactif',
      index: 3,
    })
  })

  it('should open the interactive mode from ?diapo, whatever the props and the cookie say', () => {
    expect(etatAuMontage(DECK, { mode: 'lecture', index: 0 }, '?diapo=ex1', 'lecture')).toEqual({
      mode: 'interactif',
      index: 2,
    })
  })

  it('should resolve a block or a section named by ?diapo', () => {
    expect(etatAuMontage(DECK, props, '?diapo=figure', undefined)).toEqual({
      mode: 'interactif',
      index: 1,
    })
    expect(etatAuMontage(DECK, props, '?a=1&diapo=exercices', undefined)).toEqual({
      mode: 'interactif',
      index: 3,
    })
  })

  it('should follow the cookie without ?diapo, keeping the index of the props', () => {
    expect(etatAuMontage(DECK, { mode: 'interactif', index: 2 }, '', 'lecture')).toEqual({
      mode: 'lecture',
      index: 2,
    })
    expect(etatAuMontage(DECK, { mode: 'lecture', index: 0 }, '?a=1', 'interactif')).toEqual({
      mode: 'interactif',
      index: 0,
    })
  })

  it('should take a repeated ?diapo for no ?diapo, as the server does', () => {
    const lecture = { mode: 'lecture', index: 0 } as const
    expect(etatAuMontage(DECK, lecture, '?diapo=a&diapo=b', 'lecture')).toBe(lecture)
    expect(etatAuMontage(DECK, props, '?diapo=ex1&diapo=ex2', undefined)).toBe(props)
  })

  it('should keep the props when the address and the cookie are silent', () => {
    const lecture = { mode: 'lecture', index: 0 } as const
    expect(etatAuMontage(DECK, lecture, '', undefined)).toBe(lecture)
    expect(etatAuMontage(DECK, props, '', undefined)).toBe(props)
  })

  it('should give the props back unchanged when the address says the same', () => {
    const exercice = { mode: 'interactif', index: 2 } as const
    expect(etatAuMontage(DECK, exercice, '?diapo=ex1', 'interactif')).toBe(exercice)
    expect(etatAuMontage(DECK, { ...exercice }, '?diapo=ex1', undefined)).toEqual(exercice)
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

  it('should say when an exercise is solved or was left without an answer', () => {
    expect(libelleDiapo(DECK[2], 2, 5, titles, 'resolu')).toBe(
      'Diapo 3 sur 5 · Exercice · Le théorème · Réussi'
    )
    expect(libelleDiapo(DECK[2], 2, 5, titles, 'sans-reponse')).toBe(
      'Diapo 3 sur 5 · Exercice · Le théorème · Sans réponse'
    )
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

describe('etatDiapo', () => {
  const vues = new Set(['ex1'])

  it('should say nothing about a slide without an auto-graded exercise', () => {
    expect(etatDiapo(DECK[1], false, { ex1: 'a-faire' }, new Set(['intro']))).toBeNull()
  })

  it('should mark an exercise seen and left without an answer', () => {
    expect(etatDiapo(DECK[2], false, { ex1: 'a-faire' }, vues)).toBe('sans-reponse')
  })

  it('should not mark it while it is the current slide, or before it is seen', () => {
    expect(etatDiapo(DECK[2], true, { ex1: 'a-faire' }, vues)).toBeNull()
    expect(etatDiapo(DECK[2], false, { ex1: 'a-faire' }, new Set())).toBeNull()
  })

  it('should not mark an exercise the student tried', () => {
    expect(etatDiapo(DECK[2], false, { ex1: 'tente' }, vues)).toBeNull()
  })

  it('should mark a solved exercise, current or not', () => {
    expect(etatDiapo(DECK[2], true, { ex1: 'resolu' }, vues)).toBe('resolu')
    expect(etatDiapo(DECK[2], false, { ex1: 'resolu' }, vues)).toBe('resolu')
  })
})
