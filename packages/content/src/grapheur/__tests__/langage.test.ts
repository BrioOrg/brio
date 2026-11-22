import { describe, expect, it } from 'vitest'

import { parseExpression } from '../../expression'
import {
  analyserLignes,
  formaterRationnel,
  latexRationnel,
  MESSAGES,
  type LigneAnalysee,
  type OptionsAnalyse,
} from '../langage'

const NBSP = ' '

function lignes(...textes: string[]) {
  return textes.map((texte, i) => ({ id: `l${i + 1}`, texte }))
}

function analyser(textes: string[], options?: OptionsAnalyse): LigneAnalysee[] {
  return analyserLignes(lignes(...textes), options)
}

function une(texte: string, options?: OptionsAnalyse): LigneAnalysee {
  return analyser([texte], options)[0]
}

function explicite(l: LigneAnalysee) {
  if (l.genre !== 'explicite') throw new Error(`explicite attendu, ${JSON.stringify(l)}`)
  return l
}
function implicite(l: LigneAnalysee) {
  if (l.genre !== 'implicite') throw new Error(`implicite attendu, ${JSON.stringify(l)}`)
  return l
}
function constante(l: LigneAnalysee) {
  if (l.genre !== 'constante') throw new Error(`constante attendue, ${JSON.stringify(l)}`)
  return l
}
function calcul(l: LigneAnalysee) {
  if (l.genre !== 'calcul') throw new Error(`calcul attendu, ${JSON.stringify(l)}`)
  return l
}
function erreur(l: LigneAnalysee) {
  if (l.genre !== 'erreur') throw new Error(`erreur attendue, ${JSON.stringify(l)}`)
  return l
}

describe('analyserLignes — the criteria of #418', () => {
  it("Given f(x) = x² and y = f'(x), when the second line is evaluated at 3, then 6", () => {
    const [f, d] = analyser(['f(x) = x²', "y = f'(x)"])
    expect(explicite(f).nom).toBe('f')
    expect(explicite(f).f(3)).toBe(9)
    expect(explicite(d).nom).toBeNull()
    expect(explicite(d).f(3)).toBe(6)
  })

  it("Given f(x) = sin(x) in degrees, f'(90) ≈ 0; in radians f'(0) = 1", () => {
    const deg = analyser(['f(x) = sin(x)', "f'(90)", "y = f'(x)"], { angle: 'degres' })
    expect(calcul(deg[1]).valeur).toBeCloseTo(0, 12)
    expect(explicite(deg[2]).f(0)).toBeCloseTo(Math.PI / 180, 14)
    const rad = analyser(['f(x) = sin(x)', "f'(0)"])
    expect(calcul(rad[1]).valeur).toBe(1)
  })

  it('Given 2/3 + 1/6, then the fraction 5/6, written 5/6, ≈ 0,83 in decimals', () => {
    const l = calcul(une('2/3 + 1/6'))
    expect(l.exact).toEqual({ num: 5n, den: 6n })
    expect(formaterRationnel(l.exact!)).toBe('5/6')
    expect(latexRationnel(l.exact!)).toBe('\\frac{5}{6}')
    expect(l.valeur).toBeCloseTo(0.83, 2)
    expect(l.latex).toBe('\\frac{2}{3}+\\frac{1}{6}')
  })

  it('Given y = ax + 1 without a = …, then the letter a is not defined, with a slider offered', () => {
    const l = erreur(une('y = ax + 1'))
    expect(l.erreur).toEqual({
      message: 'La lettre a n’est pas définie.',
      position: 4,
      curseurPropose: 'a',
    })
    expect(l.latex).toBe('y=ax+1')
  })

  it('Given a = 2 too, then the curve is evaluated with a = 2', () => {
    const [d, a] = analyser(['y = ax + 1', 'a = 2'])
    expect(explicite(d).f(3)).toBe(7)
    expect(constante(a)).toMatchObject({ nom: 'a', valeur: 2, curseur: true, latex: 'a=2' })
  })

  it('Given x² + y² = 4, then implicit, F(x, y) = x² + y² − 4', () => {
    const l = implicite(une('x² + y² = 4'))
    expect(l.latex).toBe('x^{2}+y^{2}=4')
    for (const [x, y] of [
      [0, 0],
      [2, 0],
      [1, 1],
      [-3, 0.5],
    ]) {
      expect(l.F(x, y)).toBeCloseTo(x * x + y * y - 4, 12)
    }
  })

  it('Given f(x) = g(x) and g(x) = f(x), then a circular definition on both lines', () => {
    const [f, g] = analyser(['f(x) = g(x)', 'g(x) = f(x)'])
    const message = `Ces lignes se renvoient l’une à l’autre${NBSP}: f et g. Change l’une des définitions pour casser la boucle.`
    expect(erreur(f).erreur).toEqual({ message, position: 7 })
    expect(erreur(g).erreur).toEqual({ message, position: 7 })
  })

  it('Given e^x and exp(x), then the same values; ln(e) = 1; log(1000) = 3', () => {
    const [a, b, c, d] = analyser(['e^x', 'exp(x)', 'ln(e)', 'log(1000)'])
    for (const x of [-2, 0, 1.5, 4]) expect(explicite(a).f(x)).toBeCloseTo(explicite(b).f(x), 12)
    expect(calcul(c).valeur).toBe(1)
    expect(calcul(c).exact).toBeNull()
    expect(calcul(d).valeur).toBeCloseTo(3, 14)
  })

  it('Given any expression of ADR 0038, then the same values', () => {
    const sources = [
      '2x + 1',
      'x² − 3',
      '1/2x',
      '−x²',
      '|x − 2|',
      '√(x + 7)',
      '2πx',
      '(x − 1)(x + 2)',
      '0,25x',
      '2^-1 x',
      '3(x + 1) − 2,5',
    ]
    for (const source of sources) {
      const ancien = parseExpression(source)
      if (!ancien.ok) throw new Error(source)
      const f = explicite(une(source)).f
      for (const x of [-3, -0.5, 0, 1, 2.5, 9]) {
        const attendu = ancien.expression.evaluate({ x })
        if (Number.isNaN(attendu)) expect(f(x)).toBeNaN()
        else expect(f(x)).toBeCloseTo(attendu, 12)
      }
    }
  })
})

describe('analyserLignes — kinds of line', () => {
  it('should keep the order and the ids, and read blank lines as empty', () => {
    const r = analyserLignes([
      { id: 'b', texte: '  ' },
      { id: 'a', texte: '2x' },
      { id: 'c', texte: '' },
    ])
    expect(r.map((l) => [l.id, l.genre])).toEqual([
      ['b', 'vide'],
      ['a', 'explicite'],
      ['c', 'vide'],
    ])
    expect(analyserLignes([])).toEqual([])
  })

  it('should read y = …, an expression in x and f(x) = … as explicit curves', () => {
    expect(explicite(une('y = 2x + 1'))).toMatchObject({ nom: null, latex: 'y=2x+1' })
    expect(explicite(une('2x + 1'))).toMatchObject({ nom: null, latex: '2x+1' })
    expect(explicite(une('f(x) = 1/2x'))).toMatchObject({ nom: 'f', latex: 'f(x)=\\frac{1}{2}x' })
    expect(explicite(une(' g ( x ) = x')).nom).toBe('g')
    expect(explicite(une('f1(x) = x')).latex).toBe('f_{1}(x)=x')
    expect(explicite(une('y = 3')).f(100)).toBe(3)
  })

  it('should read every other equality in x and y as an implicit curve', () => {
    const cases: Array<[string, number, number, number]> = [
      ['x = 3', 5, 0, 2],
      ['x = y²', 1, 2, -3],
      ['y² = x', 1, 2, 3],
      ['xy = 1', 2, 3, 5],
      ['2x + 1 = y', 1, 1, 2],
      ['y = y² + x', 1, 2, -3],
      ['x = 2a', 4, 0, 0],
    ]
    for (const [texte, x, y, F] of cases) {
      const r = analyser([texte, 'a = 2'])
      expect(implicite(r[0]).F(x, y)).toBeCloseTo(F, 12)
    }
    expect(implicite(une('x = 3')).latex).toBe('x=3')
  })

  it('should read a letter = a value as a constant, a slider when the value is typed as a number', () => {
    expect(constante(une('a = 2'))).toMatchObject({ nom: 'a', valeur: 2, curseur: true })
    expect(constante(une('b = −1,5'))).toMatchObject({
      valeur: -1.5,
      curseur: true,
      latex: 'b=-1{,}5',
    })
    expect(constante(une('b = -1.5')).curseur).toBe(true)
    expect(constante(une('c = +0,5')).curseur).toBe(true)
    expect(constante(une('c = ,5')).valeur).toBe(0.5)
    expect(constante(une('A = 3')).nom).toBe('A')
    const k = constante(une('k = 2π'))
    expect(k.curseur).toBe(false)
    expect(k.valeur).toBeCloseTo(2 * Math.PI, 14)
    expect(constante(une('k = 2²')).curseur).toBe(false)
    expect(constante(une('k = 1/2')).curseur).toBe(false)
    expect(constante(une('k = (2)')).curseur).toBe(false)
  })

  it('should let a constant depend on another, and on a function', () => {
    const r = analyser(['b = 2a + f(1)', 'a = 1,5', 'f(x) = 10x'])
    expect(constante(r[0])).toMatchObject({ valeur: 13, curseur: false })
  })

  it('should read a line without x or y as a calculation', () => {
    expect(calcul(une('√2')).valeur).toBeCloseTo(Math.SQRT2, 14)
    expect(calcul(une('√2')).exact).toBeNull()
    expect(calcul(une('sin(π/6)')).valeur).toBeCloseTo(0.5, 14)
    expect(calcul(une('3')).exact).toEqual({ num: 3n, den: 1n })
    const [, f3] = analyser(['f(x) = x²', 'f(3)'])
    expect(calcul(f3)).toMatchObject({ valeur: 9, exact: { num: 9n, den: 1n }, latex: 'f(3)' })
  })
})

describe('analyserLignes — functions and derivatives', () => {
  it('should resolve definitions in any order', () => {
    const r = analyser(['y = h(x) + 1', 'h(x) = 2g(x)', 'g(x) = x + a', 'a = 1'])
    expect(explicite(r[0]).f(3)).toBe(9)
    expect(explicite(r[1]).f(3)).toBe(8)
    expect(explicite(r[2]).f(3)).toBe(4)
  })

  it('should compose and shift', () => {
    const r = analyser(['f(x) = x²', 'g(x) = f(x − 1)', 'y = f(g(x))', 'y = f(f(f(x)))'])
    expect(explicite(r[1]).f(3)).toBe(4)
    expect(explicite(r[2]).f(3)).toBe(16)
    expect(explicite(r[3]).f(2)).toBe(256)
  })

  it("should derive a function that calls another: g(x) = f(2x), g'(x) = 2f'(2x)", () => {
    const r = analyser(['f(x) = sin(x)', 'g(x) = f(2x) + x³', "g'(x)", "g''(x)", "f'(g(x))"])
    for (const x of [-1, 0.3, 2]) {
      expect(explicite(r[2]).f(x)).toBeCloseTo(2 * Math.cos(2 * x) + 3 * x * x, 12)
      expect(explicite(r[3]).f(x)).toBeCloseTo(-4 * Math.sin(2 * x) + 6 * x, 12)
      expect(explicite(r[4]).f(x)).toBeCloseTo(Math.cos(Math.sin(2 * x) + x ** 3), 12)
    }
  })

  it("should draw the tangent y = f'(2)(x − 2) + f(2)", () => {
    const r = analyser(['f(x) = x²', "y = f'(2)(x − 2) + f(2)"])
    const t = explicite(r[1])
    expect(t.f(2)).toBe(4)
    expect(t.f(3)).toBe(8)
    expect(t.latex).toBe("y=f'(2)\\left(x-2\\right)+f(2)")
  })

  it('should give the exact value of a derivative when it is a fraction', () => {
    const r = analyser(['f(x) = x³/3', "f'(1/2)"])
    expect(calcul(r[1]).exact).toEqual({ num: 1n, den: 4n })
  })

  it('should use the slider values it is given', () => {
    const textes = ['f(x) = ax + b', 'a = 2', 'b = 1', 'c = 2a', 'f(1)']
    const r = analyser(textes, { valeurs: { a: -3, c: 100, z: 4 } })
    expect(explicite(r[0]).f(2)).toBe(-5)
    expect(constante(r[1]).valeur).toBe(-3)
    // c is not a slider (2a is not a number as typed): its value follows a.
    expect(constante(r[3]).valeur).toBe(-6)
    expect(calcul(r[4]).exact).toEqual({ num: -2n, den: 1n })
    expect(constante(analyser(['a = 2'], { valeurs: { a: NaN } })[0]).valeur).toBe(2)
  })

  it('should read a slider value as the fraction it shows (0,1 + 0,2 = 3/10)', () => {
    const r = analyser(['a = 0,1', 'a + 0,2'], { valeurs: { a: 0.1 } })
    expect(calcul(r[1]).exact).toEqual({ num: 3n, den: 10n })
    expect(calcul(r[1]).valeur).toBe(0.3)
  })

  it('should keep a derivative of degrees in degrees', () => {
    const r = analyser(['f(x) = cos(x)', "y = f''(x)"], { angle: 'degres' })
    const k = (Math.PI / 180) ** 2
    expect(explicite(r[1]).f(0)).toBeCloseTo(-k, 14)
    expect(explicite(r[0]).f(180)).toBeCloseTo(-1, 14)
  })

  it('should give the derivative of |x| no value at 0, and of a constant 0', () => {
    const r = analyser(['f(x) = |x|', "f'(x)", 'g(x) = 5', "g'(x)"])
    expect(explicite(r[1]).f(0)).toBeNaN()
    expect(explicite(r[1]).f(-2)).toBe(-1)
    expect(explicite(r[3]).f(7)).toBe(0)
  })
})

describe('analyserLignes — exact calculations', () => {
  it.each([
    ['2/3 + 1/6', 5n, 6n],
    ['(1/2)^3', 1n, 8n],
    ['√(4/9)', 2n, 3n],
    ['1,5 × 4', 6n, 1n],
    ['0,1 + 0,2', 3n, 10n],
    ['2^-2', 1n, 4n],
    ['−3/4 − 1/4', -1n, 1n],
    ['|−1/3|', 1n, 3n],
    ['(2/3)^(−2)', 9n, 4n],
    ['10/4', 5n, 2n],
    ['2^64', 2n ** 64n, 1n],
  ])('%s = %d/%d', (texte, num, den) => {
    const l = calcul(une(texte))
    expect(l.exact).toEqual({ num, den })
    expect(l.valeur).toBeCloseTo(Number(num) / Number(den), 12)
  })

  it.each(['2^65', '2^(1/2)', '√2', 'π/2', 'e', 'sin(0)', '2^0,5', '√(−4)'.replace('−4', '2/3')])(
    '%s is not exact',
    (texte) => {
      expect(calcul(une(texte)).exact).toBeNull()
    }
  )

  it('should refuse a division by zero, only on a calculation', () => {
    const message = `Division par zéro${NBSP}: ce calcul n’a pas de résultat.`
    expect(erreur(une('1/0')).erreur).toEqual({ message, position: 1 })
    expect(erreur(une('2 + 3/(1 − 1)')).erreur).toEqual({ message, position: 5 })
    expect(erreur(une('sin(1)/0')).erreur.message).toBe(message)
    expect(erreur(une('0^(−1)')).erreur).toEqual({ message, position: 1 })
    expect(erreur(une('a = 1/0')).erreur.message).toBe(message)
    const [, f0] = analyser(['f(x) = 1/x', 'f(0)'])
    expect(erreur(f0).erreur).toEqual({ message, position: 0 })
    // A curve with a pole is drawn without an error.
    expect(explicite(une('y = 1/x')).f(0)).toBeNaN()
    expect(explicite(une('1/(x − x)')).f(1)).toBeNaN()
  })

  it('should refuse a calculation without a real value', () => {
    expect(erreur(une('√(−1)')).erreur).toEqual({ message: MESSAGES.calculSansValeur, position: 0 })
    expect(erreur(une('ln(0)')).erreur.message).toBe(MESSAGES.calculSansValeur)
    expect(erreur(une('a = √(−1)')).erreur).toEqual({
      message: 'La valeur de a n’est pas définie.',
      position: 0,
    })
  })
})

describe('analyserLignes — errors', () => {
  it('should refuse inequalities', () => {
    for (const [texte, position] of [
      ['y < 2x', 2],
      ['y ≥ 1', 2],
      ['x>0', 1],
      ['x ≤ y', 2],
      ['x ≠ 1', 2],
    ] as const) {
      expect(erreur(une(texte)).erreur).toEqual({
        message:
          'Les inéquations ne sont pas prises en charge ici. Écris une égalité, avec un seul signe =.',
        position,
      })
    }
  })

  it('should refuse two equal signs', () => {
    expect(erreur(une('y = 2 = x')).erreur).toEqual({
      message: 'Une ligne ne peut contenir qu’un seul signe =.',
      position: 6,
    })
  })

  it('should ask for both sides of =', () => {
    expect(erreur(une(' = 2x')).erreur).toEqual({ message: MESSAGES.manqueAvant, position: 1 })
    expect(erreur(une('y =  ')).erreur).toEqual({ message: MESSAGES.manqueApres, position: 2 })
  })

  it('should keep the position of the faulty character in the whole line', () => {
    expect(erreur(une('y = 2x +')).erreur.position).toBe(8)
    expect(erreur(une('f(x) = 2x $')).erreur).toMatchObject({ position: 10 })
    expect(erreur(une('2x + 1 = (x')).erreur).toMatchObject({ position: 9 })
    expect(erreur(une('(x = 1')).erreur).toMatchObject({ position: 0 })
  })

  it('should refuse a second definition of a letter, on the second line only', () => {
    const r = analyser(['f(x) = x', 'g(x) = 1', ' f(x) = 2x', 'f(3)'])
    expect(explicite(r[0]).f(3)).toBe(3)
    expect(erreur(r[2]).erreur).toEqual({
      message:
        'La lettre f est déjà définie à la ligne 1. Choisis une autre lettre ou supprime l’une des deux lignes.',
      position: 1,
    })
    expect(erreur(r[2]).latex).toBe('f(x)=2x')
    expect(calcul(r[3]).valeur).toBe(3)

    const c = analyser(['a = 1', 'a = 2', 'a'])
    expect(constante(c[0]).valeur).toBe(1)
    expect(erreur(c[1]).erreur.message).toMatch(/^La lettre a est déjà définie à la ligne 1\./)
    expect(calcul(c[2]).valeur).toBe(1)
  })

  it('should refuse a function and a constant of the same letter, the first one winning', () => {
    const r = analyser(['a = 2', 'a(x) = x', 'y = a(x + 1)'])
    expect(constante(r[0]).valeur).toBe(2)
    expect(erreur(r[1]).erreur.message).toMatch(/déjà définie à la ligne 1/)
    expect(explicite(r[2]).f(1)).toBe(4)

    const s = analyser(['a(x) = x', 'a = 2', 'y = a(x + 1)'])
    expect(explicite(s[0]).nom).toBe('a')
    expect(erreur(s[1]).erreur.message).toMatch(/déjà définie à la ligne 1/)
    expect(explicite(s[2]).f(1)).toBe(2)
  })

  it('should refuse a cycle on each of its lines, and nothing loops', () => {
    const self = erreur(une('f(x) = f(x) + 1'))
    expect(self.erreur.message).toBe(MESSAGES.circulaire('f'))
    expect(self.erreur.position).toBe(7)
    const a = erreur(une('a = a + 1'))
    expect(a.erreur.message).toBe(MESSAGES.circulaire('a'))
    const three = analyser(['f(x) = g(x)', 'g(x) = h(x)', 'h(x) = f(x) + a', 'a = 1', 'y = f(x)'])
    for (const l of three.slice(0, 3)) {
      expect(erreur(l).erreur.message).toBe(MESSAGES.circulaire('f, g et h'))
    }
    expect(constante(three[3]).valeur).toBe(1)
    expect(erreur(three[4]).erreur).toEqual({
      message: `f n’est pas utilisable${NBSP}: sa définition, ligne 1, contient une erreur.`,
      position: 4,
    })
  })

  it('should refuse a line that uses a definition in error', () => {
    const r = analyser(['f(x) = 2x +', 'y = f(x) + 1', 'b = c', 'y = bx'])
    expect(erreur(r[1]).erreur).toEqual({
      message: MESSAGES.definitionEnErreur('f', 1),
      position: 4,
    })
    expect(erreur(r[2]).erreur.curseurPropose).toBe('c')
    expect(erreur(r[3]).erreur.message).toBe(MESSAGES.definitionEnErreur('b', 3))
  })

  it('should report the first letter nobody defines, with its position', () => {
    expect(erreur(une('y = ax + b')).erreur).toMatchObject({ curseurPropose: 'a', position: 4 })
    expect(erreur(une('f(x) = kx')).erreur).toMatchObject({ curseurPropose: 'k', position: 7 })
    expect(erreur(une('b = 2c')).erreur).toMatchObject({ curseurPropose: 'c', position: 5 })
    expect(erreur(une('x² + y² = r²')).erreur).toMatchObject({ curseurPropose: 'r', position: 10 })
    expect(erreur(une('t + 1')).erreur).toMatchObject({ curseurPropose: 't', position: 0 })
    const r = analyser(['y = ax + b', 'a = 1'])
    expect(erreur(r[0]).erreur).toMatchObject({ curseurPropose: 'b', position: 9 })
  })

  it('should refuse a function used without brackets, and an unknown derivative', () => {
    const r = analyser(['f(x) = x', 'y = 2f'])
    expect(erreur(r[1]).erreur).toEqual({
      message: `f est une fonction${NBSP}: écris f(x), avec la parenthèse.`,
      position: 5,
    })
    expect(erreur(une("y = g'(x)")).erreur).toEqual({
      message:
        'Je ne connais pas la fonction g, donc je ne peux pas calculer g’(x). Définis d’abord g.',
      position: 4,
    })
    expect(erreur(une('y = arcsin(x)')).erreur.message).toBe(
      'Je ne connais pas la fonction arcsin. Définis-la d’abord, par exemple f(x) = x².'
    )
  })

  it('should refuse the reserved names x, y and e', () => {
    expect(erreur(une('y(x) = 2')).erreur).toEqual({ message: MESSAGES.nomVariable, position: 0 })
    expect(erreur(une('x(x) = 2')).erreur.message).toBe(MESSAGES.nomVariable)
    expect(erreur(une('e(x) = 2')).erreur.message).toBe(MESSAGES.nomEuler('f'))
    expect(erreur(une(' e = 2')).erreur).toEqual({ message: MESSAGES.nomEuler('a'), position: 1 })
    expect(erreur(une('π = 3')).erreur).toEqual({
      message: MESSAGES.nombreDejaConnu('π'),
      position: 0,
    })
    // e stays Euler's number for the other lines.
    expect(calcul(analyser(['e = 2', 'ln(e)'])[1]).valeur).toBe(1)
  })

  it('should ask for x as the variable of a function', () => {
    expect(erreur(une('f(t) = 2t')).erreur).toEqual({
      message: MESSAGES.variableDeFonction('f'),
      position: 2,
    })
  })

  it('should refuse y in a function, x or y in a constant, y outside an equation', () => {
    expect(erreur(une('f(x) = x + y')).erreur).toEqual({
      message: MESSAGES.fonctionAvecY('f'),
      position: 11,
    })
    expect(erreur(une('a = x + 1')).erreur).toEqual({
      message: MESSAGES.constanteAvecXY('a'),
      position: 4,
    })
    expect(erreur(une('a = 2 + y')).erreur.position).toBe(8)
    expect(erreur(une('x² + y²')).erreur).toEqual({ message: MESSAGES.yHorsEquation, position: 5 })
    expect(erreur(une('x² + y²')).latex).toBe('x^{2}+y^{2}')
  })

  it('should refuse an equality with neither x nor y', () => {
    expect(erreur(une('2 + 2 = 4')).erreur).toEqual({ message: MESSAGES.rienATracer, position: 6 })
  })

  it('should refuse a line that grows too long once inlined', () => {
    // Each function doubles the one before: g has 2 calls of f0, h 4, … the 17th 2^17.
    const noms = [
      'g',
      'h',
      'k',
      'm',
      'n',
      'p',
      'q',
      'r',
      's',
      't',
      'u',
      'v',
      'w',
      'z',
      'b',
      'c',
      'd',
    ]
    const r = analyser(['f0(x) = x + 1', ...chain('f0', ...noms), 'y = d(x)'])
    expect(explicite(r[1]).f(1)).toBe(4)
    const premiere = r.findIndex((l) => l.genre === 'erreur')
    expect(premiere).toBeGreaterThan(10)
    expect(erreur(r[premiere]).erreur).toEqual({ message: MESSAGES.tropLongue, position: 0 })
    expect(erreur(r[r.length - 1]).erreur.message).toBe(MESSAGES.definitionEnErreur('d', 18))
  })
})

/** g(x) = f0(x) + f0(x), h(x) = g(x) + g(x), … */
function chain(...noms: string[]): string[] {
  return noms.slice(1).map((nom, i) => `${nom}(x) = ${noms[i]}(x) + ${noms[i]}(x)`)
}

describe('analyserLignes — details', () => {
  it('should compute the decimal value when the result is not exact', () => {
    expect(calcul(une('π + 1')).valeur).toBeCloseTo(Math.PI + 1, 14)
    expect(calcul(une('π − 1')).valeur).toBeCloseTo(Math.PI - 1, 14)
    expect(calcul(une('2π')).valeur).toBeCloseTo(2 * Math.PI, 14)
    expect(calcul(une('π/2')).valeur).toBeCloseTo(Math.PI / 2, 14)
    expect(calcul(une('π^2')).valeur).toBeCloseTo(Math.PI ** 2, 14)
    expect(calcul(une('−π')).valeur).toBeCloseTo(-Math.PI, 14)
    expect(calcul(une('|−π|')).valeur).toBeCloseTo(Math.PI, 14)
    expect(calcul(une('sin(90)', { angle: 'degres' })).valeur).toBeCloseTo(1, 14)
    const r = analyser(['k = 2π', 'k/2', 'a = 2', 'πa'])
    expect(calcul(r[1]).valeur).toBeCloseTo(Math.PI, 14)
    expect(calcul(r[3]).valeur).toBeCloseTo(2 * Math.PI, 14)
  })

  it('should give 0^0 = 1 and refuse 0 to a negative power, exact or not', () => {
    expect(calcul(une('0^0')).exact).toEqual({ num: 1n, den: 1n })
    expect(erreur(une('sin(0)^(−1)')).erreur).toEqual({
      message: MESSAGES.divisionParZero,
      position: 6,
    })
    expect(erreur(une('1/sin(0)')).erreur.position).toBe(1)
    expect(calcul(une('π^(−1)')).valeur).toBeCloseTo(1 / Math.PI, 14)
  })

  it('should give an inlined error the position of the call', () => {
    const r = analyser(['f(x) = 1/x', '1 + f(0)'])
    expect(erreur(r[1]).erreur).toEqual({ message: MESSAGES.divisionParZero, position: 4 })
  })

  it('should point at the first y of an expression', () => {
    expect(erreur(une('x + y + y')).erreur.position).toBe(4)
    expect(erreur(une('f(x) = y + y')).erreur.position).toBe(7)
  })

  it('should refuse a line that starts with =', () => {
    expect(erreur(une('= 2')).erreur).toEqual({ message: MESSAGES.manqueAvant, position: 0 })
  })

  it('should report parse errors of a line without =, and of the value of a constant', () => {
    expect(erreur(une('2x +')).erreur.position).toBe(4)
    expect(erreur(une('a = 2 +')).erreur.position).toBe(7)
    expect(erreur(une('2 + 2 = 4 $')).erreur.position).toBe(10)
  })

  it('should keep the name of a function with a wrong variable, for the lines that use it', () => {
    const r = analyser(['f(t) = 2t', 'y = f(x)'])
    expect(erreur(r[1]).erreur.message).toBe(MESSAGES.definitionEnErreur('f', 1))
  })

  it('should refuse a derivative that grows too long', () => {
    const r = analyser(['f(x) = x^x^x', `y = f${"'".repeat(12)}(x)`])
    expect(explicite(r[0]).f(1.5)).toBeCloseTo(1.5 ** (1.5 ** 1.5), 12)
    expect(erreur(r[1]).erreur).toEqual({ message: MESSAGES.tropLongue, position: 0 })
  })
})
