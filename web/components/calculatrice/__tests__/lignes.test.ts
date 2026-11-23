import { describe, expect, it } from 'vitest'

import {
  curseurPour,
  lignesDepuisEtat,
  lireNombre,
  prochaineCouleur,
  surLaGrille,
} from '@/components/calculatrice/lignes'

describe('prochaineCouleur', () => {
  it('prend la première couleur libre, puis reprend le cycle', () => {
    expect(prochaineCouleur([])).toBe(1)
    expect(prochaineCouleur([1, 2])).toBe(3)
    expect(prochaineCouleur([2, 3])).toBe(1)
    expect(prochaineCouleur([1, 2, 3, 4, 5, 6])).toBe(1)
    expect(prochaineCouleur([1, 2, 3, 4, 5, 6, 1])).toBe(2)
  })
})

describe('lignesDepuisEtat', () => {
  it('garde les couleurs données et complète les autres', () => {
    const lignes = lignesDepuisEtat({
      v: 1,
      lignes: [{ texte: 'y = x', couleur: 2 }, { texte: 'y = 2x' }, { texte: 'a = 1' }],
    })
    expect(lignes.map((l) => [l.id, l.couleur, l.style, l.masquee])).toEqual([
      ['l0', 2, 'plein', false],
      ['l1', 1, 'plein', false],
      ['l2', 3, 'plein', false],
    ])
  })
})

describe('curseurs', () => {
  it('élargit les bornes pour une valeur tapée hors du curseur', () => {
    expect(curseurPour(undefined, 2)).toEqual({ min: -10, max: 10, pas: 0.1 })
    expect(curseurPour(undefined, 25.5)).toEqual({ min: -10, max: 26, pas: 0.1 })
    expect(curseurPour({ min: 0, max: 1, pas: 0.5 }, -3)).toEqual({ min: -3, max: 1, pas: 0.5 })
  })

  it('pose une valeur sur la grille du curseur, sans traîne flottante', () => {
    const c = { min: -10, max: 10, pas: 0.1 }
    expect(surLaGrille(0.30000000000000004, c)).toBe(0.3)
    expect(surLaGrille(12, c)).toBe(10)
    expect(surLaGrille(1.04, c)).toBe(1)
  })

  it('lit un nombre tapé en français ou en anglais', () => {
    expect(lireNombre('−1,5')).toBe(-1.5)
    expect(lireNombre('-1.5')).toBe(-1.5)
    expect(lireNombre(' 2 ')).toBe(2)
    expect(lireNombre('2a')).toBeNull()
    expect(lireNombre('')).toBeNull()
    expect(lireNombre('1e999')).toBeNull()
  })
})
