import { describe, expect, it } from 'vitest'

import type { Catalogue } from '@/lib/api'
import { cheminsChapitres, lienDevoir } from '@/lib/lien-devoir'

// Where a homework opens (#370): its course, or its chapter when the catalogue places it. A
// destination that cannot be computed is `null`, never a guessed URL — the caller falls back.

const CATALOGUE: Catalogue = [
  {
    niveauCode: '5e',
    niveauLibelle: 'Cinquième',
    matieres: [
      {
        matiereCode: 'mathematiques',
        matiereLibelle: 'Mathématiques',
        chapitres: [
          { slug: 'fractions', titre: 'Les fractions', dureeEstimeeMinutes: 20, ordre: 0 },
          { slug: 'relatifs', titre: 'Les relatifs', dureeEstimeeMinutes: 20, ordre: 1 },
        ],
      },
      {
        matiereCode: 'francais',
        matiereLibelle: 'Français',
        chapitres: [{ slug: 'le-recit', titre: 'Le récit', dureeEstimeeMinutes: 15, ordre: 0 }],
      },
    ],
  },
  {
    niveauCode: '3e',
    niveauLibelle: 'Troisième',
    matieres: [
      {
        matiereCode: 'mathematiques',
        matiereLibelle: 'Mathématiques',
        chapitres: [
          {
            slug: 'theoreme-de-pythagore',
            titre: 'Le théorème de Pythagore',
            dureeEstimeeMinutes: 30,
            ordre: 0,
          },
        ],
      },
    ],
  },
]

const COURS_ID = '0b6f2c1e-8d4a-4c3b-9f1e-2a7d5c9e1b40'
const DEVOIR_ID = '7d3e9a10-4b2c-4e8f-a1d6-5c0b8f2e3a91'

describe('cheminsChapitres', () => {
  it('gives every chapter of the catalogue its URL, by slug', () => {
    expect(cheminsChapitres(CATALOGUE)).toEqual({
      fractions: '/5e/mathematiques/fractions',
      relatifs: '/5e/mathematiques/relatifs',
      'le-recit': '/5e/francais/le-recit',
      'theoreme-de-pythagore': '/3e/mathematiques/theoreme-de-pythagore',
    })
  })

  it('is empty for an empty catalogue (the fallback when it fails to load)', () => {
    expect(cheminsChapitres([])).toEqual({})
  })
})

describe('lienDevoir', () => {
  const chemins = cheminsChapitres(CATALOGUE)

  // critère 2
  it('opens a course homework on its course, carrying the homework id', () => {
    expect(lienDevoir({ id: DEVOIR_ID, sourceType: 'cours', sourceRef: COURS_ID }, chemins)).toBe(
      `/cours/${COURS_ID}?devoir=${DEVOIR_ID}`
    )
  })

  it('needs no catalogue for a course homework', () => {
    expect(lienDevoir({ id: DEVOIR_ID, sourceType: 'cours', sourceRef: COURS_ID }, {})).toBe(
      `/cours/${COURS_ID}?devoir=${DEVOIR_ID}`
    )
  })

  it('encodes the course id and the homework id', () => {
    expect(lienDevoir({ id: 'a&b=c', sourceType: 'cours', sourceRef: 'x/y z?' }, chemins)).toBe(
      '/cours/x%2Fy%20z%3F?devoir=a%26b%3Dc'
    )
  })

  // critère 1
  it('opens a chapter homework on its chapter, found by slug in the catalogue', () => {
    expect(
      lienDevoir(
        { id: DEVOIR_ID, sourceType: 'chapitre', sourceRef: 'theoreme-de-pythagore' },
        chemins
      )
    ).toBe(`/3e/mathematiques/theoreme-de-pythagore?devoir=${DEVOIR_ID}`)
  })

  // critère 3: each homework its own destination
  it('tells chapters of different subjects apart', () => {
    expect(lienDevoir({ id: 'd1', sourceType: 'chapitre', sourceRef: 'le-recit' }, chemins)).toBe(
      '/5e/francais/le-recit?devoir=d1'
    )
    expect(lienDevoir({ id: 'd2', sourceType: 'chapitre', sourceRef: 'relatifs' }, chemins)).toBe(
      '/5e/mathematiques/relatifs?devoir=d2'
    )
  })

  // critère 4
  it('has no destination for a chapter the catalogue does not have', () => {
    expect(
      lienDevoir({ id: DEVOIR_ID, sourceType: 'chapitre', sourceRef: 'inconnu' }, chemins)
    ).toBeNull()
  })

  it('has no destination for a chapter when the catalogue is unavailable', () => {
    expect(
      lienDevoir({ id: DEVOIR_ID, sourceType: 'chapitre', sourceRef: 'fractions' }, {})
    ).toBeNull()
  })

  // critère 4: a slug that happens to name an object property is still absent from the catalogue
  it.each(['constructor', 'toString', '__proto__'])(
    'has no destination for a chapter slug “%s” the catalogue does not have',
    (slug) => {
      expect(lienDevoir({ id: DEVOIR_ID, sourceType: 'chapitre', sourceRef: slug }, chemins)).toBe(
        null
      )
    }
  )

  // critère 4
  it.each(['controle', 'Cours', 'CHAPITRE', ''])(
    'has no destination for an unknown source type “%s”',
    (sourceType) => {
      expect(lienDevoir({ id: DEVOIR_ID, sourceType, sourceRef: COURS_ID }, chemins)).toBeNull()
      expect(lienDevoir({ id: DEVOIR_ID, sourceType, sourceRef: 'fractions' }, chemins)).toBeNull()
    }
  )
})
