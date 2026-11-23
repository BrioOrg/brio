// Gate 5, round 1 of PR #427 (V1, V4, V3 and the coordinator's rulings A1–A7): each test fails
// on ff47799, the commit reviewed.

import { describe, expect, it } from 'vitest'

import { parseExpression, type ExpressionNode } from '../../expression'
import { compilerX } from '../compilation'
import { DeriveeTropLongue, deriver } from '../derivee'
import {
  analyserLignes,
  formaterRationnel,
  latexRationnel,
  limiteBilaterale,
  MESSAGES,
  type LigneAnalysee,
  type OptionsAnalyse,
} from '../langage'
import { latexOf } from '../latex'
import { rationnel, valeurDe, type Rationnel } from '../rationnel'

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
const explicite = (l: LigneAnalysee) => genre(l, 'explicite')

function tree(source: string): ExpressionNode {
  const r = parseExpression(source, { calculator: { functions: ['f'] } })
  if (!r.ok) throw new Error(`${source}: ${r.error.message}`)
  return r.expression.tree
}

describe('1 · deep or long input never throws (V1-B1)', () => {
  it.each([
    ['sin( ×1 073', 'sin('.repeat(1073) + 'x' + ')'.repeat(1073)],
    ['(((x))) ×10 000', '('.repeat(10000) + 'x' + ')'.repeat(10000)],
    ['y = x + x + … ×5 300', 'y = ' + Array(5300).fill('x').join('+')],
    ['−−−…x ×10 000', '−'.repeat(10000) + 'x'],
    ['x^x^…', Array(10000).fill('x').join('^')],
  ])('%s is refused as too long', (_label, texte) => {
    expect(erreur(une(texte)).erreur).toEqual({ message: MESSAGES.tropLongue, position: 500 })
  })

  it("should refuse f'(x) of a 5 000-factor product, on both lines", () => {
    const r = analyser(['f(x)=' + Array(5000).fill('x').join('*'), "y=f'(x)"])
    expect(erreur(r[0]).erreur.message).toBe(MESSAGES.tropLongue)
    expect(erreur(r[1]).erreur.message).toBe(MESSAGES.definitionEnErreur('f', 1))
  })

  it('should read 150 nested levels and refuse 151, at the character that goes too deep', () => {
    const niveau = (n: number) => '('.repeat(n) + 'x' + ')'.repeat(n)
    // 150 brackets make 151 levels with the x inside them.
    expect(explicite(une(niveau(149))).f(2)).toBe(2)
    expect(erreur(une(niveau(150))).erreur).toEqual({ message: MESSAGES.tropLongue, position: 150 })
    expect(erreur(une('−'.repeat(151) + 'x')).erreur.message).toBe(MESSAGES.tropLongue)
  })

  it('should read a line of 500 characters and refuse 501', () => {
    const ligne = (n: number) => 'y = ' + 'x'.padEnd(n - 4, ' ')
    expect(explicite(une(ligne(500))).f(3)).toBe(3)
    expect(erreur(une(ligne(501))).erreur).toEqual({ message: MESSAGES.tropLongue, position: 500 })
  })

  it('should refuse a composition deeper than the closures may recurse', () => {
    // 140 nested roots: 141 levels, within the parser's bound; composed 8 times, 1 128.
    const profond = '√'.repeat(140) + 'x'
    const r = analyser([`f(x) = ${profond}`, 'g(x) = f(f(f(f(f(f(f(f(x))))))))', 'y = g(x)'])
    expect(explicite(r[0]).f(1)).toBe(1)
    expect(erreur(r[1]).erreur.message).toBe(MESSAGES.tropLongue)
  })

  it('should keep the ADR 0038 reader unbounded (figures are unchanged)', () => {
    expect(parseExpression('('.repeat(300) + 'x' + ')'.repeat(300)).ok).toBe(true)
    expect(parseExpression('x'.padEnd(600, ' ')).ok).toBe(true)
  })
})

describe('2 · a derivative the formula cannot compute at a point (V4-B1)', () => {
  it("should give f'(0) = 0 for f(x) = x|x|, as a limit, never exact", () => {
    const r = analyser(['f(x) = x|x|', "f'(0)", "2f'(0) + 1"])
    expect(calcul(r[1])).toMatchObject({ valeur: 0, exact: null })
    expect(calcul(r[2]).valeur).toBe(1)
  })

  it('should not claim a division by zero for f(x) = x√x at 0', () => {
    const r = analyser(['f(x) = x√x', "f'(0)", "f'(4)"])
    expect(erreur(r[1]).erreur).toEqual({
      message: 'Je ne sais pas calculer f′(0) avec cette écriture.',
      position: 0,
    })
    expect(calcul(r[2]).valeur).toBe(3)
  })

  it('should name the call as typed, primes written ′', () => {
    const r = analyser(['f(x) = x√x', "1 + f'' ( 0 )", 'g(x) = |x|', "g'(0)"])
    expect(erreur(r[1]).erreur).toEqual({
      message: MESSAGES.deriveeIncalculable('f′′(0)'),
      position: 4,
    })
    // |x| has a corner at 0: the two sides disagree (−1 and 1), there is no value to show.
    expect(erreur(r[3]).erreur.message).toBe(MESSAGES.deriveeIncalculable('g′(0)'))
  })

  // Round 3 (V4-N1): sin(x)/x is not defined at 0, so f'(0) does not exist; no limit is shown.
  it('should not give f′(0) for sin(x)/x, and keep the division message without a derivative', () => {
    const r = analyser(['f(x) = sin(x)/x', "f'(0)", 'f(0)'])
    expect(erreur(r[1]).erreur.message).toBe(MESSAGES.deriveeIncalculable('f′(0)'))
    expect(erreur(r[2]).erreur.message).toBe(MESSAGES.divisionParZero)
  })

  it.each<[string, (h: number) => number, number | null]>([
    ['2|h|', (h) => 2 * Math.abs(h), 0],
    ['3 + h', (h) => 3 + h, 3],
    ['cos(h)', Math.cos, 1],
    ['sign(h)', Math.sign, null],
    ['√h', Math.sqrt, null],
    ['1/h', (h) => 1 / h, null],
    ['5 + 2h²', (h) => 5 + 2 * h * h, 5],
  ])('limiteBilaterale(%s)', (_label, g, attendu) => {
    expect(limiteBilaterale(g)).toBe(attendu)
  })
})

describe('3 · long whole numbers are read from their digits (V4-B2)', () => {
  it('should keep every digit, in the fraction and in the preview', () => {
    const l = calcul(une('12345678901234567'))
    expect(l.exact).toEqual({ num: 12345678901234567n, den: 1n })
    expect(l.latex).toBe('12\\,345\\,678\\,901\\,234\\,567')
    expect(calcul(une('99999999999999999 + 1')).exact).toEqual({ num: 10n ** 17n, den: 1n })
    expect(calcul(une('0,12345678901234567 × 10')).exact).toEqual({
      num: 12345678901234567n,
      den: 10n ** 16n,
    })
    const [, d] = analyser(['f(x) = x + 1', 'f(12345678901234567)'])
    expect(calcul(d).exact).toEqual({ num: 12345678901234568n, den: 1n })
  })

  it('should write a typed decimal as typed', () => {
    expect(latexOf(tree('2,50'))).toBe('2{,}50')
    expect(latexOf(tree(',5'))).toBe('0{,}5')
  })
})

describe('4 · sin, cos, tan at their exact angles (V4-B3)', () => {
  it.each([
    ['sin(180)', 0],
    ['sin(−90)', -1],
    ['sin(450)', 1],
    ['cos(90)', 0],
    ['cos(270)', 0],
    ['cos(−180)', -1],
    ['tan(180)', 0],
    ['tan(45)', 1],
    ['cos(60)', 0.5],
    ['sin(30)', 0.5],
  ])('in degrees, %s = %d', (texte, attendu) => {
    expect(calcul(une(texte, { angle: 'degres' })).valeur).toBe(attendu)
  })

  it('should refuse tan at 90° modulo 180°, and at π/2 in radians', () => {
    for (const texte of ['tan(90)', 'tan(270)', 'tan(−90)']) {
      expect(erreur(une(texte, { angle: 'degres' })).erreur.message).toBe(MESSAGES.calculSansValeur)
    }
    expect(erreur(une('tan(π/2)')).erreur.message).toBe(MESSAGES.calculSansValeur)
    expect(calcul(une('tan(π/4)')).valeur).toBe(1)
    const f = explicite(une('y = tan(x)', { angle: 'degres' })).f
    expect(f(90)).toBeNaN()
    expect(f(0)).toBe(0)
    expect(explicite(une('y = tan(x)')).f(Math.PI / 2)).toBeNaN()
  })
})

describe('5 · derivatives take linear work, within a budget (V1-I1)', () => {
  // Counted, not timed: every read of a node's `type` is one step of work.
  it('should read each node a bounded number of times, not once per level above it', () => {
    const lectures = (n: number) => {
      let compte = 0
      const espion = (node: ExpressionNode): ExpressionNode =>
        new Proxy(node, {
          get(cible, cle, recepteur) {
            if (cle === 'type') compte++
            const v: unknown = Reflect.get(cible, cle, recepteur)
            return typeof v === 'object' && v !== null && 'type' in v
              ? espion(v as ExpressionNode)
              : v
          },
        })
      // x·x·x·…: a left comb n levels deep.
      deriver(espion(tree(Array(n).fill('x').join('·'))))
      return compte
    }
    const a = lectures(40)
    const b = lectures(80)
    expect(b).toBeLessThan(2.5 * a)
  })

  it('should spend its budget once per node derived', () => {
    const budget = { reste: 1000 }
    deriver(tree(Array(50).fill('x²').join('+')), 'x', budget)
    expect(1000 - budget.reste).toBeLessThanOrEqual(10 * 50)
  })

  it('should throw DeriveeTropLongue past its budget', () => {
    expect(() => deriver(tree('x³ + x² + x'), 'x', { reste: 3 })).toThrow(DeriveeTropLongue)
    expect(deriver(tree('x³'), 'x', { reste: 10 })).toBeDefined()
  })

  it('should refuse a high derivative of a big function, as too long', () => {
    const f = 'f(x) = sin(x²)·exp(cos(x))/(x² + 1)·ln(x² + 3)·tan(x)'
    const r = analyser([f, `y = f${"'".repeat(10)}(x)`])
    expect(erreur(r[1]).erreur).toEqual({ message: MESSAGES.tropLongue, position: 0 })
  })
})

describe('6 · a number too large is not "without a real value" (V1-I2)', () => {
  it.each(['2^2048', 'exp(1000)', '10^400'])('%s is too large', (texte) => {
    expect(erreur(une(texte)).erreur.message).toBe('Ce nombre est trop grand pour la calculatrice.')
  })

  it('should compute 10^400/10^399 = 10 through its fraction', () => {
    expect(calcul(une('10^400/10^399'))).toMatchObject({ valeur: 10, exact: { num: 10n, den: 1n } })
  })

  it('should refuse a constant too large, with the same message', () => {
    expect(erreur(une('a = 10^309')).erreur).toEqual({ message: MESSAGES.tropGrand, position: 0 })
  })

  it('should keep "no real value" for ln(0), √(−1)', () => {
    expect(erreur(une('ln(0)')).erreur.message).toBe(MESSAGES.calculSansValeur)
    expect(erreur(une('log(0)')).erreur.message).toBe(MESSAGES.calculSansValeur)
    expect(erreur(une('√(−1)')).erreur.message).toBe(MESSAGES.calculSansValeur)
  })

  it('should give the value of a fraction whose terms are beyond a double', () => {
    const r = (num: bigint, den: bigint): Rationnel => rationnel(num, den)!
    expect(valeurDe(r(10n ** 401n + 10n ** 380n, 10n ** 400n))).toBeCloseTo(10, 12)
    expect(valeurDe(r(-(10n ** 401n), 3n * 10n ** 400n))).toBeCloseTo(-10 / 3, 12)
    expect(valeurDe(r(1n, 10n ** 400n))).toBe(0)
    expect(valeurDe(r(10n ** 400n, 1n))).toBe(Infinity)
    expect(valeurDe(r(10n ** 300n, 10n ** 299n + 1n))).toBeCloseTo(10, 12)
    // A denominator far smaller than the numerator is not truncated to a few bits.
    expect(valeurDe(r(10n ** 320n, 3n ** 40n)) / (1e300 * (1e20 / 3 ** 40))).toBeCloseTo(1, 12)
  })
})

describe('7 · rounding residues of decimal calculations (V4-I1)', () => {
  it.each([
    ['sin(π)', 0],
    ['cos(π/2)', 0],
    ['√2·√2', 2],
    ['√2^2', 2],
    ['√2·√2 − 2', 0],
    ['1/π', 0.318309886184],
    ['1/√2', 0.707106781187],
  ])('%s = %d', (texte, attendu) => {
    expect(calcul(une(texte)).valeur).toBe(attendu)
  })

  it('should keep a small value that is not a residue', () => {
    expect(calcul(une('π/10^20')).valeur).toBe(3.14159265359e-20)
  })

  it('should show a constant rounded, and give the lines that use it its full value', () => {
    const r = analyser(['k = 2π', 'y = k', 'a = 0,1'], { valeurs: { a: 0.1 + 0.2 } })
    expect(genre(r[0], 'constante').valeur).toBe(6.28318530718)
    expect(explicite(r[1]).f(0)).toBe(2 * Math.PI)
    expect(genre(r[2], 'constante').valeur).toBe(0.3)
  })

  it('known limit: 1/(√2·√2 − 2) divides by a residue (ADR 0049)', () => {
    expect(calcul(une('1/(√2·√2 − 2)')).valeur).toBe(2251799813690000)
  })
})

describe('8 · thousands grouped in fractions (V4-I2)', () => {
  it.each<[bigint, bigint, string, string]>([
    [12345n, 1n, '12 345', '12\\,345'],
    [1234n, 1n, '1234', '1234'],
    [-1234567n, 10001n, '−1 234 567/10 001', '-\\frac{1\\,234\\,567}{10\\,001}'],
  ])('%d/%d', (num, den, texte, latex) => {
    const r = rationnel(num, den)!
    expect(formaterRationnel(r)).toBe(texte)
    expect(latexRationnel(r)).toBe(latex)
  })
})

describe('10 · French spacing in the inherited messages, calculator only (V4-I4)', () => {
  it('should put a no-break space before : and inside « »', () => {
    expect(erreur(une('2x +')).erreur.message).toBe(
      `L’expression s’arrête après «${NBSP}+${NBSP}»${NBSP}: il manque un nombre ou x.`
    )
    expect(erreur(une('x2')).erreur.message).not.toMatch(/ :|« | »/)
    const r = parseExpression('2x +')
    expect(!r.ok && r.error.message).toBe(
      'L’expression s’arrête après « + » : il manque un nombre ou x.'
    )
  })
})

describe('A1 · f, g, h followed by a bracket are functions', () => {
  it.each(['g', 'h', 'f'])('%s(2) without a definition is an unknown function', (nom) => {
    expect(erreur(une(`y = 1 + ${nom}(2)`)).erreur).toEqual({
      message: `Je ne connais pas la fonction ${nom}. Définis-la d’abord, par exemple ${nom}(x) = x².`,
      position: 8,
    })
  })

  it('should keep the product for the other letters', () => {
    const r = analyser(['y = k(x − 1)', 'k = 2'])
    expect(explicite(r[0]).f(3)).toBe(4)
    expect(erreur(une('y = a(x + 1)')).erreur.curseurPropose).toBe('a')
  })
})

describe('A4 · names of functions', () => {
  it.each(['x1(x) = x', 'y2(x) = x'])('%s is refused (a variable)', (texte) => {
    expect(erreur(une(texte)).erreur.message).toBe(MESSAGES.nomVariable)
  })

  it('should refuse e1(x) (Euler) and an uppercase name', () => {
    expect(erreur(une('e1(x) = x')).erreur.message).toBe(MESSAGES.nomEuler('f'))
    expect(erreur(une(' F(x) = 2x')).erreur).toEqual({
      message: `Écris le nom de la fonction en minuscule${NBSP}: f(x) = …`,
      position: 1,
    })
    expect(erreur(une('G1(x) = 2x')).erreur.message).toBe(MESSAGES.nomMinuscule('g'))
  })
})

describe('A5 · an equality true everywhere draws nothing', () => {
  it.each(['y = y', 'x = x', '2 = 2', '(x + 1)² = x² + 2x + 1', 'x + y = y + x'])('%s', (texte) => {
    expect(erreur(une(texte)).erreur.message).toBe(
      `Cette égalité est vraie pour tous les points${NBSP}: il n’y a rien à tracer.`
    )
  })

  it('should still refuse 2 = 3 and draw x = 3', () => {
    expect(erreur(une('2 = 3')).erreur.message).toBe(MESSAGES.rienATracer)
    expect(genre(une('x = 3'), 'implicite').F(3, 0)).toBe(0)
    expect(genre(une('√x = √x + y'), 'implicite').F(4, 0)).toBe(0)
  })
})

describe('A7 and V3', () => {
  it('should end the messages with … and no full stop after it', () => {
    expect(MESSAGES.variableDeFonction('f')).toBe(
      `La variable d’une fonction s’écrit x${NBSP}: écris f(x) = …`
    )
    expect(MESSAGES.constanteAvecXY('a').endsWith('écris y = …')).toBe(true)
  })

  it('should point at π after leading spaces', () => {
    expect(erreur(une('  π = 2')).erreur).toEqual({
      message: MESSAGES.nombreDejaConnu('π'),
      position: 2,
    })
  })

  it('should bound the denominator as the numerator', () => {
    expect(rationnel(1n, 1n << 2047n)).not.toBeNull()
    expect(rationnel(1n, 1n << 2048n)).toBeNull()
  })

  it('should compile what deriver returns as the derivative it is', () => {
    const d = compilerX(deriver(tree('x³ − 2x')))
    expect(d(2)).toBe(10)
  })
})
