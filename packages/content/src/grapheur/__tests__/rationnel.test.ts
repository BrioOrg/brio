import { describe, expect, it } from 'vitest'

import {
  ajouter,
  BITS_MAX,
  diviser,
  estNul,
  formaterRationnel,
  latexRationnel,
  multiplier,
  opposer,
  puissance,
  racine,
  rationnel,
  rationnelDepuisDecimal,
  rationnelDepuisNombre,
  soustraire,
  valeurAbsolue,
  valeurDe,
  type Rationnel,
} from '../rationnel'

function q(num: number, den = 1): Rationnel {
  const r = rationnel(BigInt(num), BigInt(den))
  if (!r) throw new Error('not a fraction')
  return r
}

describe('rationnel', () => {
  it('should reduce and put the sign on the numerator', () => {
    expect(rationnel(10n, 4n)).toEqual({ num: 5n, den: 2n })
    expect(rationnel(3n, -6n)).toEqual({ num: -1n, den: 2n })
    expect(rationnel(-3n, -6n)).toEqual({ num: 1n, den: 2n })
    expect(rationnel(0n, -7n)).toEqual({ num: 0n, den: 1n })
    expect(rationnel(7n)).toEqual({ num: 7n, den: 1n })
  })

  it('should refuse a zero denominator and a fraction too large', () => {
    expect(rationnel(1n, 0n)).toBeNull()
    expect(rationnel(1n << BigInt(BITS_MAX), 1n)).toBeNull()
    expect(rationnel(1n, 1n << BigInt(BITS_MAX))).toBeNull()
    expect(rationnel((1n << BigInt(BITS_MAX)) - 1n, 1n)).not.toBeNull()
  })

  it('should add, subtract, multiply and divide exactly', () => {
    expect(ajouter(q(2, 3), q(1, 6))).toEqual(q(5, 6))
    expect(soustraire(q(1, 2), q(1, 3))).toEqual(q(1, 6))
    expect(multiplier(q(2, 3), q(9, 4))).toEqual(q(3, 2))
    expect(diviser(q(2, 3), q(4, 9))).toEqual(q(3, 2))
    expect(diviser(q(2, 3), q(0))).toBeNull()
    expect(opposer(q(2, 3))).toEqual(q(-2, 3))
    expect(valeurAbsolue(q(-2, 3))).toEqual(q(2, 3))
    expect(valeurAbsolue(q(2, 3))).toEqual(q(2, 3))
    expect(estNul(q(0))).toBe(true)
    expect(estNul(q(1, 9))).toBe(false)
  })

  it('should raise to a whole power, within bounds', () => {
    expect(puissance(q(1, 2), q(3))).toEqual(q(1, 8))
    expect(puissance(q(-2, 3), q(2))).toEqual(q(4, 9))
    expect(puissance(q(2, 3), q(-2))).toEqual(q(9, 4))
    expect(puissance(q(-2), q(-3))).toEqual(q(-1, 8))
    expect(puissance(q(5), q(0))).toEqual(q(1))
    expect(puissance(q(2), q(64))).toEqual({ num: 2n ** 64n, den: 1n })
    expect(puissance(q(2), q(65))).toBeNull()
    expect(puissance(q(2), q(-65))).toBeNull()
    expect(puissance(q(2), q(1, 2))).toBeNull()
    expect(puissance(q(0), q(-1))).toBeNull()
    // 2^2000 has 2001 bits: within BITS_MAX, but its exponent is above 64.
    expect(puissance({ num: 1n << 100n, den: 1n }, q(30))).toBeNull()
    expect(puissance({ num: 1n << 30n, den: 1n }, q(64))).toEqual({ num: 1n << 1920n, den: 1n })
  })

  it('should take the root of a perfect square only', () => {
    expect(racine(q(4, 9))).toEqual(q(2, 3))
    expect(racine(q(0))).toEqual(q(0))
    expect(racine(q(1))).toEqual(q(1))
    expect(racine(q(144))).toEqual(q(12))
    expect(racine({ num: 10n ** 40n, den: 1n })).toEqual({ num: 10n ** 20n, den: 1n })
    expect(racine(q(2))).toBeNull()
    expect(racine(q(4, 3))).toBeNull()
    expect(racine(q(3, 4))).toBeNull()
    expect(racine(q(-4))).toBeNull()
    expect(racine(q(15))).toBeNull()
    expect(racine(q(17))).toBeNull()
  })
})

describe('rationnelDepuisDecimal', () => {
  it.each([
    ['1,5', 3, 2],
    ['1.5', 3, 2],
    ['-0,25', -1, 4],
    ['−0,25', -1, 4],
    ['– 2', -2, 1],
    ['+3', 3, 1],
    [',5', 1, 2],
    ['2,', 2, 1],
    ['  7  ', 7, 1],
    ['2e-3', 1, 500],
    ['1.5E+2', 150, 1],
    ['0', 0, 1],
  ])('should read %j', (texte, num, den) => {
    expect(rationnelDepuisDecimal(texte)).toEqual(q(num, den))
  })

  it.each(['', ' ', '-', ',', 'abc', '1,2,3', '2x', '1e999'])('should not read %j', (texte) => {
    expect(rationnelDepuisDecimal(texte)).toBeNull()
  })
})

describe('rationnelDepuisNombre', () => {
  it('should read a double from its first 15 digits', () => {
    expect(rationnelDepuisNombre(0.1)).toEqual(q(1, 10))
    expect(rationnelDepuisNombre(0.1 + 0.2)).toEqual(q(3, 10))
    expect(rationnelDepuisNombre(-1.5)).toEqual(q(-3, 2))
    expect(rationnelDepuisNombre(42)).toEqual(q(42))
    expect(rationnelDepuisNombre(1e21)).toEqual({ num: 10n ** 21n, den: 1n })
    expect(rationnelDepuisNombre(1e-7)).toEqual({ num: 1n, den: 10n ** 7n })
    expect(rationnelDepuisNombre(Infinity)).toBeNull()
    expect(rationnelDepuisNombre(NaN)).toBeNull()
  })
})

describe('valeurDe', () => {
  it('should give the decimal value, even of huge terms', () => {
    expect(valeurDe(q(5, 6))).toBe(5 / 6)
    expect(valeurDe(q(-3))).toBe(-3)
    const huge = { num: 3n * 10n ** 400n, den: 2n * 10n ** 400n }
    expect(valeurDe(huge)).toBeCloseTo(1.5, 12)
  })
})

describe('formaterRationnel and latexRationnel', () => {
  it.each([
    [q(5, 6), '5/6', '\\frac{5}{6}'],
    [q(-5, 6), '−5/6', '-\\frac{5}{6}'],
    [q(3), '3', '3'],
    [q(-3), '−3', '-3'],
    [q(0), '0', '0'],
  ])('should write %o', (r, texte, latex) => {
    expect(formaterRationnel(r)).toBe(texte)
    expect(latexRationnel(r)).toBe(latex)
  })
})
