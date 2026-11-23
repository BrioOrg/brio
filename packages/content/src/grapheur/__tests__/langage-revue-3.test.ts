// Gate 5, round 3 of PR #427 (V4 N1–N3, S1): each test fails on 262dc54, the commit reviewed.

import { describe, expect, it } from 'vitest'

import { parseExpression } from '../../expression'
import {
  analyserLignes,
  continueEn,
  limiteBilaterale,
  MESSAGES,
  type LigneAnalysee,
  type OptionsAnalyse,
} from '../langage'

const NBSP = ' '

function analyser(textes: string[], options?: OptionsAnalyse): LigneAnalysee[] {
  return analyserLignes(
    textes.map((texte, i) => ({ id: `l${i + 1}`, texte })),
    options
  )
}

function une(texte: string, options?: OptionsAnalyse): LigneAnalysee {
  return analyser([texte], options)[0]
}

function genre<G extends LigneAnalysee['genre']>(l: LigneAnalysee, g: G) {
  if (l.genre !== g) throw new Error(`${g} attendu : ${JSON.stringify(l)}`)
  return l as Extract<LigneAnalysee, { genre: G }>
}

const calcul = (l: LigneAnalysee) => genre(l, 'calcul')
const erreur = (l: LigneAnalysee) => genre(l, 'erreur')

describe('N1 · a derivative where f is not defined or not continuous', () => {
  it.each([
    ['1/x', '0', 'f′(0)'],
    ['1/x³', '0', 'f′(0)'],
    ['sin(x)/x', '0', 'f′(0)'],
    ['tan(x)', 'π/2', 'f′(π/2)'],
  ])('f(x) = %s has no derivative at %s', (f, a, appel) => {
    const r = analyser([`f(x) = ${f}`, `f'(${a})`])
    expect(erreur(r[1]).erreur).toEqual({
      message: `Je ne sais pas calculer ${appel} avec cette écriture.`,
      position: 0,
    })
  })

  it('should refuse f′′ where f′ is not defined, and inside a longer calculation', () => {
    const r = analyser(['f(x) = 1/x', "f''(0)", "1 + 2f'(0)"])
    expect(erreur(r[1]).erreur.message).toBe(MESSAGES.deriveeIncalculable('f′′(0)'))
    expect(erreur(r[2]).erreur).toEqual({
      message: MESSAGES.deriveeIncalculable('f′(0)'),
      position: 5,
    })
  })

  it('should keep f′(0) = 0 for x|x| and x²|x|, as limits', () => {
    const r = analyser(['f(x) = x|x|', "f'(0)", 'g(x) = x²|x|', "g'(0)"])
    expect(calcul(r[1])).toMatchObject({ valeur: 0, exact: null })
    expect(calcul(r[3])).toMatchObject({ valeur: 0, exact: null })
  })

  it('should keep the ordinary derivatives', () => {
    const r = analyser(['f(x) = tan(x)', "f'(0)", "f'(π/4)", 'g(x) = 1/x', "g'(2)", "g''(1)"])
    expect(calcul(r[1]).valeur).toBe(1)
    expect(calcul(r[2]).valeur).toBe(2)
    expect(calcul(r[4]).valeur).toBe(-0.25)
    expect(calcul(r[5]).valeur).toBe(2)
  })

  it.each<[string, (h: number) => number, number | null]>([
    ['−1/h², the same on both sides, never converging', (h) => -1 / (h * h), null],
    ['1/|h|', (h) => 1 / Math.abs(h), null],
    ['3h|h|', (h) => 3 * h * Math.abs(h), 0],
    ['2 + 7h', (h) => 2 + 7 * h, 2],
  ])('limiteBilaterale(%s)', (_label, g, attendu) => {
    expect(limiteBilaterale(g)).toBe(attendu)
  })

  it.each<[string, (x: number) => number, number, boolean]>([
    ['x² at 0', (x) => x * x, 0, true],
    ['1000x at 1', (x) => 1000 * x, 1, true],
    ['|x| at 0', Math.abs, 0, true],
    ['1/x at 0', (x) => 1 / x, 0, false],
    ['sin(x)/x at 0', (x) => Math.sin(x) / x, 0, false],
    ['tan at π/2', Math.tan, Math.PI / 2, false],
    ['a jump at 0', (x) => (x < 0 ? 0 : 1), 0, false],
    ['√x at 0', Math.sqrt, 0, false],
  ])('continueEn(%s)', (_label, F, a, attendu) => {
    expect(continueEn(F, a)).toBe(attendu)
  })
})

describe('N2 · a term beyond a double is too large, whatever the result', () => {
  it.each(['2^2048/2^2047', '2^2048 − 2^2048', '1/2^2048', 'exp(1000)/exp(999)'])('%s', (texte) => {
    expect(erreur(une(texte)).erreur.message).toBe(MESSAGES.tropGrand)
  })

  it('should still compute what the fractions hold exactly, and keep √(−1) without a value', () => {
    expect(calcul(une('10^400/10^399')).valeur).toBe(10)
    expect(erreur(une('√(−1) + 2')).erreur.message).toBe(MESSAGES.calculSansValeur)
  })
})

describe('N3 · the computer notation 1e-13 is refused in the calculator', () => {
  it.each([
    ['1e-13', '1 × 10^(−13)', 1],
    ['2e5', '2 × 10^5', 1],
    ['3E+2', '3 × 10^2', 1],
    ['1,5e−3', '1,5 × 10^(−3)', 3],
    ['y = 2,5E12x', '2,5 × 10^12', 7],
  ])('%s', (texte, ecriture, position) => {
    const ecrit = texte.startsWith('y = ') ? '2,5E12' : texte
    expect(erreur(une(texte)).erreur).toEqual({
      message: `L’écriture ${ecrit} n’est pas permise${NBSP}: écris ${ecriture}.`,
      position,
    })
  })

  it('should read 2e, 2e^x and 2ex as products', () => {
    expect(calcul(une('2e')).valeur).toBe(Number((2 * Math.E).toPrecision(12)))
    expect(genre(une('2e^x'), 'explicite').f(1)).toBeCloseTo(2 * Math.E, 12)
    expect(genre(une('2ex'), 'explicite').f(1)).toBeCloseTo(2 * Math.E, 12)
    expect(genre(une('y = 2e − x'), 'explicite').f(1)).toBeCloseTo(2 * Math.E - 1, 12)
  })

  it('should leave the ADR 0038 reader unchanged', () => {
    const r = parseExpression('2e5', { variables: ['x', 'e'] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).not.toContain('n’est pas permise')
  })
})

describe('S1 · an equality is true everywhere only to rounding', () => {
  it('should draw x² = x² + 0,0000000001 (it is never true)', () => {
    genre(une('x² = x² + 0,0000000001'), 'implicite')
    genre(une('y = y + 0,000000001'), 'implicite')
  })

  it('should say where an equality true everywhere is defined', () => {
    expect(erreur(une('ln(x) = ln(x)')).erreur.message).toBe(
      `Cette égalité est vraie partout où elle est définie${NBSP}: il n’y a rien à tracer.`
    )
    expect(erreur(une('√x = √x')).erreur.message).toBe(MESSAGES.vraieOuDefinie)
  })

  it('should keep an identity with large terms true everywhere', () => {
    expect(erreur(une('(x + 1000)² = x² + 2000x + 1000000')).erreur.message).toBe(
      MESSAGES.toujoursVraie
    )
  })
})
