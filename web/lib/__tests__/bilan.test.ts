import { describe, expect, it } from 'vitest'
import type { Diapo } from '@brio/content'
import { bilan, type BilanEntree } from '@/lib/bilan'

const DECK: Diapo[] = [
  { id: 'debut', kind: 'debut', blockIds: [] },
  { id: 'intro', kind: 'lecon', sectionId: 'cours', blockIds: ['intro'] },
  { id: 'ex1', kind: 'exercice', sectionId: 'cours', blockIds: ['ex1'] },
  { id: 'ex2', kind: 'exercice', sectionId: 'entrainement', blockIds: ['ex2'] },
  { id: 'ex3', kind: 'exercice', sectionId: 'entrainement', blockIds: ['ex3'] },
  { id: 'fin', kind: 'fin', blockIds: [] },
]

function entree(over: Partial<BilanEntree> = {}): BilanEntree {
  return {
    deck: DECK,
    exercices: { ex1: 'a-faire', ex2: 'a-faire', ex3: 'a-faire' },
    vues: new Set(),
    sectionTitles: { cours: 'Le cours', entrainement: "S'entraîner" },
    xpSession: null,
    completion: { avant: null, actuelle: null },
    suivant: null,
    etatSuivant: null,
    ...over,
  }
}

const SUIVANT = { titre: 'Les fractions', href: '/5e/mathematiques/fractions' }

describe('bilan — the end slide draws only real values (#249)', () => {
  it('given nothing from the backend and nothing done, then no line at all', () => {
    const b = bilan(entree())
    expect(b).toEqual({ sansReponse: [], niveau: 'sobre' })
  })

  it('given no session (a visitor, a teacher), then no XP line, never a 0', () => {
    const b = bilan(entree({ exercices: { ex1: 'resolu' }, xpSession: null }))
    expect(b.xp).toBeUndefined()
    expect(b.reussis).toBe(1)
  })

  it('given exercises solved for no XP (daily cap), then the XP line is hidden', () => {
    const b = bilan(entree({ exercices: { ex1: 'resolu', ex2: 'a-faire' }, xpSession: 0 }))
    expect(b.xp).toBeUndefined()
  })

  it('given real XP earned, then the line shows that sum', () => {
    expect(bilan(entree({ xpSession: 30 })).xp).toBe(30)
  })

  it('given no completion from progression, then no completion line', () => {
    expect(bilan(entree()).completion).toBeUndefined()
  })

  it('given the completion before and after, then it moves from one to the other', () => {
    const b = bilan(entree({ completion: { avant: 40, actuelle: 72.6 } }))
    expect(b.completion).toEqual({ de: 40, a: 73 })
  })

  it('given only the value at the opening (the re-read failed), then it shows still', () => {
    expect(bilan(entree({ completion: { avant: 40, actuelle: null } })).completion).toEqual({
      de: 40,
      a: 40,
    })
  })

  it('counts solved exercises, and only them', () => {
    const b = bilan(entree({ exercices: { ex1: 'resolu', ex2: 'tente', ex3: 'resolu' } }))
    expect(b.reussis).toBe(2)
  })

  it('lists the exercises seen and left with no answer, not the tried or the unseen ones', () => {
    const b = bilan(
      entree({
        exercices: { ex1: 'a-faire', ex2: 'tente', ex3: 'a-faire' },
        vues: new Set(['ex1', 'ex2']),
      })
    )
    expect(b.sansReponse).toEqual([{ diapoId: 'ex1', libelle: 'Exercice 1 · Le cours' }])
  })

  it('numbers an exercise among the chapter’s exercises', () => {
    const b = bilan(entree({ vues: new Set(['ex3']) }))
    expect(b.sansReponse).toEqual([{ diapoId: 'ex3', libelle: "Exercice 3 · S'entraîner" }])
  })

  it('offers the next chapter, unless the path locks it', () => {
    expect(bilan(entree({ suivant: SUIVANT })).suivant).toEqual(SUIVANT)
    expect(bilan(entree({ suivant: SUIVANT, etatSuivant: 'en_cours' })).suivant).toEqual(SUIVANT)
    expect(bilan(entree({ suivant: SUIVANT, etatSuivant: 'verrouille' })).suivant).toBeUndefined()
  })

  it('celebrates in proportion: read, some solved, all solved', () => {
    expect(bilan(entree()).niveau).toBe('sobre')
    expect(bilan(entree({ exercices: { ex1: 'resolu', ex2: 'a-faire' } })).niveau).toBe('partiel')
    expect(bilan(entree({ exercices: { ex1: 'resolu', ex2: 'resolu' } })).niveau).toBe('complet')
  })

  it('given a chapter with no auto-graded exercise, then it stays sober', () => {
    expect(bilan(entree({ exercices: {} })).niveau).toBe('sobre')
  })
})
