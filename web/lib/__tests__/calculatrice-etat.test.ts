import { describe, expect, it } from 'vitest'

import {
  E_MAX,
  LIGNES_MAX,
  TEXTE_MAX,
  adresseAvecEtat,
  decoderEtat,
  encoderEtat,
  etatVide,
  type EtatCalculatrice,
} from '@/lib/calculatrice-etat'

function base64url(texte: string): string {
  const octets = new TextEncoder().encode(texte)
  let b = ''
  for (const o of octets) b += String.fromCharCode(o)
  return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const COMPLET: EtatCalculatrice = {
  v: 1,
  lignes: [
    { texte: 'y = x²', couleur: 1 },
    { texte: 'x² + y² = 9', couleur: 3, style: 'pointille', masquee: true },
    { texte: 'a = −1,5', curseur: { min: -5, max: 5, pas: 0.5 } },
    { texte: '2/3 + 1/6' },
  ],
  fenetre: { xMin: -4, xMax: 6, yMin: -3, yMax: 3 },
  angle: 'degres',
  orthonorme: false,
}

describe('encoderEtat / decoderEtat', () => {
  it('fait l’aller-retour sans rien perdre', () => {
    expect(decoderEtat(encoderEtat(COMPLET))).toEqual(COMPLET)
  })

  it('écrit une adresse en base64url, sans + / ni =', () => {
    expect(encoderEtat(COMPLET)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('n’écrit pas les valeurs par défaut', () => {
    const e = encoderEtat({
      v: 1,
      lignes: [{ texte: 'y = x', style: 'plein', masquee: false }],
      angle: 'radians',
      orthonorme: true,
    })
    expect(JSON.parse(atob(e.replace(/-/g, '+').replace(/_/g, '/')))).toEqual({
      v: 1,
      lignes: [{ texte: 'y = x' }],
    })
  })

  it('tient dans la limite lue, même au pire', () => {
    const pire: EtatCalculatrice = {
      v: 1,
      lignes: Array.from({ length: LIGNES_MAX }, (_, i) => ({
        texte: '√'.repeat(TEXTE_MAX),
        couleur: ((i % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6,
        style: 'pointille',
        masquee: true,
        curseur: { min: -123456.789, max: 123456.789, pas: 0.0001 },
      })),
      fenetre: { xMin: -123456.789, xMax: 123456.789, yMin: -123456.789, yMax: 123456.789 },
      angle: 'degres',
      orthonorme: false,
    }
    const e = encoderEtat(pire)
    expect(e.length).toBeLessThanOrEqual(E_MAX)
    expect(decoderEtat(e)).toEqual(pire)
  })

  it('donne une ligne vide pour une liste vide', () => {
    expect(decoderEtat(encoderEtat({ v: 1, lignes: [] }))).toEqual(etatVide())
  })
})

describe('decoderEtat sur une adresse hostile', () => {
  const json = (v: unknown) => base64url(JSON.stringify(v))

  it.each([
    ['absente', undefined],
    ['vide', ''],
    ['un tableau de paramètres', ['a', 'b']],
    ['hors alphabet', 'abc+/=='],
    ['pas du base64', 'a'],
    ['pas de l’UTF-8', btoa('\xff\xfe').replace(/=+$/, '')],
    ['pas du JSON', base64url('{ v: 1')],
    ['une autre version', json({ v: 2, lignes: [] })],
    ['sans lignes', json({ v: 1 })],
    ['trop de lignes', json({ v: 1, lignes: Array.from({ length: 13 }, () => ({ texte: 'x' })) })],
    ['une ligne trop longue', json({ v: 1, lignes: [{ texte: 'x'.repeat(201) }] })],
    ['une couleur 7', json({ v: 1, lignes: [{ texte: 'x', couleur: 7 }] })],
    ['une couleur décimale', json({ v: 1, lignes: [{ texte: 'x', couleur: 1.5 }] })],
    ['un style inconnu', json({ v: 1, lignes: [{ texte: 'x', style: 'gras' }] })],
    ['un texte qui n’en est pas un', json({ v: 1, lignes: [{ texte: { toString: 1 } }] })],
    [
      'un nombre infini',
      base64url('{"v":1,"lignes":[{"texte":"a = 1","curseur":{"min":-1e999,"max":1,"pas":1}}]}'),
    ],
    [
      'un curseur inversé',
      json({ v: 1, lignes: [{ texte: 'a = 1', curseur: { min: 2, max: 1, pas: 1 } }] }),
    ],
    [
      'un pas nul',
      json({ v: 1, lignes: [{ texte: 'a = 1', curseur: { min: 0, max: 1, pas: 0 } }] }),
    ],
    [
      'une fenêtre inversée',
      json({ v: 1, lignes: [], fenetre: { xMin: 1, xMax: -1, yMin: 0, yMax: 1 } }),
    ],
    [
      'une fenêtre trop petite',
      json({ v: 1, lignes: [], fenetre: { xMin: 0, xMax: 1e-9, yMin: 0, yMax: 1 } }),
    ],
    [
      'une fenêtre trop loin',
      json({ v: 1, lignes: [], fenetre: { xMin: 1e9, xMax: 1e9 + 1, yMin: 0, yMax: 1 } }),
    ],
    ['un angle inconnu', json({ v: 1, lignes: [], angle: 'grades' })],
    ['trop longue', 'A'.repeat(E_MAX + 1)],
    ['du JSON nul', json(null)],
  ])('ouvre une calculatrice vide pour une adresse %s', (_cas, e) => {
    expect(decoderEtat(e)).toEqual(etatVide())
  })

  it('ignore les champs inconnus au lieu de les garder', () => {
    const etat = decoderEtat(json({ v: 1, lignes: [{ texte: 'y = x', script: 'alert(1)' }], x: 1 }))
    expect(etat).toEqual({ v: 1, lignes: [{ texte: 'y = x' }] })
  })
})

describe('adresseAvecEtat', () => {
  it('garde le chemin et remplace e', () => {
    const adresse = adresseAvecEtat(
      'http://localhost/explorer/calculatrice?e=ancien#haut',
      encoderEtat(COMPLET)
    )
    expect(adresse).toBe(`/explorer/calculatrice?e=${encoderEtat(COMPLET)}#haut`)
  })
})
