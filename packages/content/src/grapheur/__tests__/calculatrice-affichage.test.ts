import { describe, expect, it } from 'vitest'

import { parseExpression } from '../../expression'
import { analyserLignes, MESSAGES } from '../langage'

// Gate 5 round 1 of #421 (V4-I4, V4-S3): what the calculator page needs from the language.

const une = (texte: string) => analyserLignes([{ id: 'l', texte }])[0]

describe('chiffres groupés par trois (mode calculatrice)', () => {
  it.each([
    ['1 000', 1000n, 1n],
    ['1 000', 1000n, 1n],
    ['1 000', 1000n, 1n],
    ['1 000', 1000n, 1n],
    ['12 345 678 + 1', 12345679n, 1n],
    ['1 000,5', 2001n, 2n],
  ])('lit %j comme un seul nombre', (texte, num, den) => {
    const a = une(texte)
    expect(a.genre).toBe('calcul')
    if (a.genre !== 'calcul') return
    expect(a.exact).toEqual({ num, den })
  })

  it('lit aussi un nombre groupé dans une courbe', () => {
    const a = une('y = 1 000x')
    expect(a.genre).toBe('explicite')
    if (a.genre === 'explicite') expect(a.f(2)).toBe(2000)
  })

  it('ne groupe que des paquets de trois chiffres', () => {
    expect(une('1 23').genre).toBe('erreur')
    expect(une('1 2345').genre).toBe('erreur')
    expect(une('1234 567').genre).toBe('erreur')
  })

  it('laisse le langage des figures (ADR 0038) inchangé', () => {
    const r = parseExpression('1 000')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toMatch(/^Le nombre 000 suit « 1 »/)
  })
})

describe('puissance d’un nombre négatif', () => {
  it('refuse un exposant non entier, avec une phrase qui le dit', () => {
    const a = une('(-8)^(1/3)')
    expect(a.genre).toBe('erreur')
    if (a.genre !== 'erreur') return
    expect(a.erreur.message).toBe(MESSAGES.puissanceNegative)
    expect(a.erreur.message).toBe(
      'La puissance d’un nombre négatif n’est définie ici que pour un exposant entier.'
    )
  })

  it('accepte un exposant entier, même écrit en fraction', () => {
    const a = une('(-8)^(2/2)')
    expect(a.genre === 'calcul' && a.valeur).toBe(-8)
    expect(une('(-2)^3').genre).toBe('calcul')
    expect(une('(-0,5)^(-2)').genre).toBe('calcul')
  })

  it('ne touche pas aux courbes : y = (−8)^x reste une courbe', () => {
    expect(une('y = (-8)^x').genre).toBe('explicite')
  })
})
