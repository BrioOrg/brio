// Acceptance tests for #418 (calculator language, ADR 0049), written from the criteria only.
// Each test carries the criterion it covers: "critère N" follows the order of the Given/When/Then
// list of the issue (1 = f' of x², 2 = sin in degrees, 3 = 2/3 + 1/6, 4 = unknown letter / slider,
// 5 = implicit, 6 = circular, 7 = e^x / ln / log, 8 = ADR 0038 unchanged, 9 = LaTeX preview).
// "bord" marks an edge case derived from the rules of the issue.
import { describe, expect, it } from 'vitest'
import { analyserLignes, formaterRationnel, latexRationnel } from '../../index'
import type { LigneAnalysee } from '../../index'

type Options = { angle?: 'radians' | 'degres'; valeurs?: Record<string, number> }

const NBSP = ' '

function analyse(texts: readonly string[], options?: Options): LigneAnalysee[] {
  return analyserLignes(
    texts.map((texte, i) => ({ id: `l${i + 1}`, texte })),
    options
  )
}

function fn(r: LigneAnalysee): (x: number) => number {
  if (r.genre !== 'explicite') throw new Error(`expected explicite, got ${r.genre}`)
  return r.f
}
function implicite(r: LigneAnalysee): (x: number, y: number) => number {
  if (r.genre !== 'implicite') throw new Error(`expected implicite, got ${r.genre}`)
  return r.F
}
function calcul(r: LigneAnalysee) {
  if (r.genre !== 'calcul') throw new Error(`expected calcul, got ${r.genre}`)
  return r
}
function erreur(r: LigneAnalysee) {
  if (r.genre !== 'erreur') throw new Error(`expected erreur, got ${r.genre}`)
  return r.erreur
}
function constante(r: LigneAnalysee) {
  if (r.genre !== 'constante') throw new Error(`expected constante, got ${r.genre}`)
  return r
}
const DEG: Options = { angle: 'degres' }

describe('critère 1 : dérivée symbolique', () => {
  it("given f(x) = x² and y = f'(x) when evaluating line 2 at x = 3 then 6", () => {
    const r = analyse(['f(x) = x²', "y = f'(x)"])
    expect(r[0].genre).toBe('explicite')
    expect(fn(r[1])(3)).toBeCloseTo(6, 9)
  })

  it("bord: f''(x) of x³ at 2 is 12", () => {
    const r = analyse(['f(x) = x³', "y = f''(x)"])
    expect(fn(r[1])(2)).toBeCloseTo(12, 9)
  })

  it("bord: tangent y = f'(2)(x − 2) + f(2) of x² at x = 3 is 8 and at 2 is 4", () => {
    const r = analyse(['f(x) = x²', "y = f'(2)(x − 2) + f(2)"])
    expect(fn(r[1])(3)).toBeCloseTo(8, 9)
    expect(fn(r[1])(2)).toBeCloseTo(4, 9)
  })

  it('bord: the typographic apostrophe reads the same derivative', () => {
    const r = analyse(['f(x) = x²', 'y = f’(x)'])
    expect(fn(r[1])(3)).toBeCloseTo(6, 9)
  })

  it('bord: derivative of a line that is itself a derivative', () => {
    const r = analyse(['f(x) = x³', "g(x) = f'(x)", "y = g'(x)"])
    expect(fn(r[2])(2)).toBeCloseTo(12, 9)
  })

  it('bord: usual derivative rules against hand values', () => {
    const r = analyse([
      'f(x) = ln(x)',
      'g(x) = 1/x',
      'h(x) = √x',
      'k(x) = x/(x + 1)',
      'm(x) = x^x',
      'p(x) = 5',
      'q(x) = tan(x)',
      'r(x) = exp(2x)',
      "f'(2)", // 1/2
      "g'(2)", // −1/4
      "h'(4)", // 1/(2·2)
      "k'(1)", // 1/(1+1)²
      "m'(2)", // 4 (ln 2 + 1)
      "p'(3)", // 0
      "q'(0)", // 1
      "r'(0)", // 2
    ])
    expect(r.slice(0, 8).every((l) => l.genre === 'explicite')).toBe(true)
    const val = (i: number) => calcul(r[i]).valeur
    expect(val(8)).toBeCloseTo(0.5, 9)
    expect(val(9)).toBeCloseTo(-0.25, 9)
    expect(val(10)).toBeCloseTo(0.25, 9)
    expect(val(11)).toBeCloseTo(0.25, 9)
    expect(val(12)).toBeCloseTo(4 * (Math.LN2 + 1), 7)
    expect(val(13)).toBeCloseTo(0, 9)
    expect(val(14)).toBeCloseTo(1, 9)
    expect(val(15)).toBeCloseTo(2, 9)
  })

  it('bord: |x| has derivative −1 at −3, 1 at 3 and none at 0', () => {
    const r = analyse(['f(x) = abs(x)', "y = f'(x)"])
    expect(fn(r[1])(-3)).toBeCloseTo(-1, 9)
    expect(fn(r[1])(3)).toBeCloseTo(1, 9)
    expect(fn(r[1])(0)).toBeNaN()
  })
})

describe("critère 2 : mode d'angle", () => {
  it("given f(x) = sin(x) in degrees when f'(90) then ≈ 0", () => {
    const r = analyse(['f(x) = sin(x)', "f'(90)"], DEG)
    expect(calcul(r[1]).valeur).toBeCloseTo(0, 9)
  })

  it("given f(x) = sin(x) in radians when f'(0) then 1", () => {
    const r = analyse(['f(x) = sin(x)', "f'(0)"])
    expect(calcul(r[1]).valeur).toBeCloseTo(1, 9)
  })

  it("bord: in degrees f'(0) = π/180", () => {
    const r = analyse(['f(x) = sin(x)', "f'(0)"], DEG)
    expect(calcul(r[1]).valeur).toBeCloseTo(Math.PI / 180, 9)
  })

  it('bord: radians is the default and sin(π/6) ≈ 0,5 with no exact value', () => {
    const c = calcul(analyse(['sin(π/6)'])[0])
    expect(c.valeur).toBeCloseTo(0.5, 9)
    expect(c.exact).toBeNull()
  })

  it('bord: in degrees sin(30) = 0,5 and cos(60) = 0,5', () => {
    const r = analyse(['sin(30)', 'cos(60)'], DEG)
    expect(calcul(r[0]).valeur).toBeCloseTo(0.5, 9)
    expect(calcul(r[1]).valeur).toBeCloseTo(0.5, 9)
  })

  it('bord: degrees apply through a chain of definitions', () => {
    const r = analyse(['f(x) = sin(x)', 'g(x) = f(x) + 1', "h(x) = g'(x)", 'y = g(x)'], DEG)
    expect(fn(r[3])(30)).toBeCloseTo(1.5, 9)
    expect(fn(r[2])(90)).toBeCloseTo(0, 9)
    expect(fn(r[2])(0)).toBeCloseTo(Math.PI / 180, 9)
  })

  it("bord: in degrees f''(90) of sin = −(π/180)²", () => {
    const r = analyse(['f(x) = sin(x)', "f''(90)"], DEG)
    expect(calcul(r[1]).valeur).toBeCloseTo(-((Math.PI / 180) ** 2), 9)
  })

  it('bord: sin(x) at π/2 in radians and at 90 in degrees both give 1', () => {
    const rad = fn(analyse(['y = sin(x)'])[0])
    const deg = fn(analyse(['y = sin(x)'], DEG)[0])
    expect(rad(Math.PI / 2)).toBeCloseTo(1, 9)
    expect(deg(90)).toBeCloseTo(1, 9)
  })
})

describe('critère 3 : calculs exacts', () => {
  it('given 2/3 + 1/6 then the rational 5/6, shown 5/6 and ≈ 0,83 as a decimal', () => {
    const c = calcul(analyse(['2/3 + 1/6'])[0])
    expect(c.exact).toEqual({ num: 5n, den: 6n })
    expect(formaterRationnel(c.exact!)).toBe('5/6')
    expect(c.valeur).toBeCloseTo(0.8333333333, 9)
    expect(c.valeur.toFixed(2)).toBe('0.83')
  })

  it('bord: (1/2)^3 = 1/8', () => {
    const c = calcul(analyse(['(1/2)^3'])[0])
    expect(c.exact).toEqual({ num: 1n, den: 8n })
    expect(c.valeur).toBeCloseTo(0.125, 12)
  })

  it('bord: √(4/9) = 2/3', () => {
    const c = calcul(analyse(['√(4/9)'])[0])
    expect(c.exact).toEqual({ num: 2n, den: 3n })
  })

  it('bord: 2,5 + 1/2 = 3 shown "3"', () => {
    const c = calcul(analyse(['2,5 + 1/2'])[0])
    expect(c.exact).toEqual({ num: 3n, den: 1n })
    expect(formaterRationnel(c.exact!)).toBe('3')
    expect(c.valeur).toBe(3)
  })

  it('bord: 0,1 + 0,2 = 3/10', () => {
    const c = calcul(analyse(['0,1 + 0,2'])[0])
    expect(c.exact).toEqual({ num: 3n, den: 10n })
  })

  it('bord: a negative result is written with U+2212', () => {
    const c = calcul(analyse(['1/6 − 1'])[0])
    expect(c.exact).toEqual({ num: -5n, den: 6n })
    expect(formaterRationnel(c.exact!)).toBe('−5/6')
  })

  it('bord: the fraction is reduced', () => {
    expect(calcul(analyse(['2/4'])[0]).exact).toEqual({ num: 1n, den: 2n })
  })

  it('bord: √2 is decimal only, not exact', () => {
    const c = calcul(analyse(['√2'])[0])
    expect(c.exact).toBeNull()
    expect(c.valeur).toBeCloseTo(1.4142135623, 9)
  })

  it('bord: π makes the result decimal only', () => {
    const c = calcul(analyse(['2π'])[0])
    expect(c.exact).toBeNull()
    expect(c.valeur).toBeCloseTo(2 * Math.PI, 9)
  })

  it('bord: f(3) with f(x) = x² is a calculation worth 9', () => {
    const r = analyse(['f(x) = x²', 'f(3)'])
    expect(calcul(r[1]).valeur).toBeCloseTo(9, 12)
  })

  it('bord: a calculation may use a constant line', () => {
    const r = analyse(['a = 2', 'a + 1'])
    expect(calcul(r[1]).valeur).toBeCloseTo(3, 12)
  })

  it('bord: latexRationnel writes \\frac{5}{6}', () => {
    expect(latexRationnel({ num: 5n, den: 6n })).toBe('\\frac{5}{6}')
  })

  it('bord: a calculation line has a LaTeX preview', () => {
    expect(calcul(analyse(['1/2 + 1/3'])[0]).latex).toBe('\\frac{1}{2}+\\frac{1}{3}')
  })

  it('bord: division by zero in a calculation is refused', () => {
    const e = erreur(analyse(['1/0'])[0])
    expect(e.message).toBe(`Division par zéro${NBSP}: ce calcul n’a pas de résultat.`)
  })
})

describe('critère 4 : lettre inconnue et curseur', () => {
  it('given y = ax + 1 with no a line then an error proposing a slider', () => {
    const r = analyse(['y = ax + 1'])
    const e = erreur(r[0])
    expect(e.message).toBe('La lettre a n’est pas définie.')
    expect(e.curseurPropose).toBe('a')
    expect(Number.isInteger(e.position)).toBe(true)
  })

  it('bord: the error position is the index of the faulty letter', () => {
    expect(erreur(analyse(['y = ax + 1'])[0]).position).toBe(4)
  })

  it('given a = 2 as well then the curve is evaluated with a = 2', () => {
    const r = analyse(['y = ax + 1', 'a = 2'])
    expect(fn(r[0])(3)).toBeCloseTo(7, 12)
    const a = constante(r[1])
    expect(a.nom).toBe('a')
    expect(a.valeur).toBe(2)
    expect(a.curseur).toBe(true)
  })

  it('bord: options.valeurs overrides the slider value', () => {
    const r = analyse(['a = 2', 'y = ax + 1'], { valeurs: { a: 5 } })
    expect(fn(r[1])(3)).toBeCloseTo(16, 12)
  })

  it('bord: options.valeurs also feeds calculations', () => {
    const r = analyse(['a = 2', 'a + 1'], { valeurs: { a: 5 } })
    expect(calcul(r[1]).valeur).toBeCloseTo(6, 12)
  })

  it('bord: a missing letter among defined ones is the one proposed', () => {
    const r = analyse(['a = 2', 'y = ax + b'])
    expect(erreur(r[1]).curseurPropose).toBe('b')
  })

  it('bord: a negative decimal constant b = −1,5', () => {
    const b = constante(analyse(['b = −1,5'])[0])
    expect(b.valeur).toBeCloseTo(-1.5, 12)
    expect(b.curseur).toBe(true)
  })

  it('bord: k = 2π has the value 2π', () => {
    const k = constante(analyse(['k = 2π'])[0])
    expect(k.valeur).toBeCloseTo(2 * Math.PI, 12)
  })

  it('bord: a constant may use another constant', () => {
    const r = analyse(['a = 2', 'b = a + 1'])
    expect(constante(r[1]).valeur).toBeCloseTo(3, 12)
  })

  it('bord: a constant cannot use x', () => {
    expect(analyse(['a = x + 1'])[0].genre).toBe('erreur')
  })

  it('bord: ax is a × x, letters are single', () => {
    const r = analyse(['a = 3', 'y = ax'])
    expect(fn(r[1])(2)).toBeCloseTo(6, 12)
  })
})

describe('critère 5 : courbes implicites', () => {
  it('given x² + y² = 4 then implicit with F(x, y) = x² + y² − 4', () => {
    const F = implicite(analyse(['x² + y² = 4'])[0])
    expect(F(2, 0)).toBeCloseTo(0, 12)
    expect(F(0, 0)).toBeCloseTo(-4, 12)
    expect(F(1, 1)).toBeCloseTo(-2, 12)
    expect(F(0, 3)).toBeCloseTo(5, 12)
  })

  it('bord: x = 3 is implicit with F = x − 3', () => {
    const F = implicite(analyse(['x = 3'])[0])
    expect(F(3, 7)).toBeCloseTo(0, 12)
    expect(F(5, 0)).toBeCloseTo(2, 12)
  })

  it('bord: xy = 1 gives F = xy − 1', () => {
    const F = implicite(analyse(['xy = 1'])[0])
    expect(F(2, 0.5)).toBeCloseTo(0, 12)
    expect(F(2, 2)).toBeCloseTo(3, 12)
  })

  it('bord: x = y² and y² = x have opposite signs (left − right)', () => {
    const [a, b] = analyse(['x = y²', 'y² = x'])
    expect(implicite(a)(4, 2)).toBeCloseTo(0, 12)
    expect(implicite(a)(1, 0)).toBeCloseTo(1, 12)
    expect(implicite(b)(4, 2)).toBeCloseTo(0, 12)
    expect(implicite(b)(1, 0)).toBeCloseTo(-1, 12)
  })

  it('bord: y = 2x + 1 stays explicit, with no name', () => {
    const r = analyse(['y = 2x + 1'])[0]
    expect(r.genre).toBe('explicite')
    if (r.genre === 'explicite') expect(r.nom).toBeNull()
    expect(fn(r)(3)).toBeCloseTo(7, 12)
  })

  it('bord: an equality with neither x nor y is refused', () => {
    expect(analyse(['2 = 3'])[0].genre).toBe('erreur')
  })
})

describe('critère 6 : définitions circulaires', () => {
  it('given f(x) = g(x) and g(x) = f(x) then an error on both lines', () => {
    const r = analyse(['f(x) = g(x)', 'g(x) = f(x)'])
    for (const l of r) {
      const e = erreur(l)
      expect(e.message).toContain('Ces lignes se renvoient l’une à l’autre')
      expect(e.message).toContain('Change l’une des définitions pour casser la boucle.')
    }
  })

  it('bord: a cycle of 3 is an error on each of its lines, an outside line is fine', () => {
    const r = analyse(['f(x) = g(x)', 'g(x) = h(x)', 'h(x) = f(x)', 'y = 2x'])
    expect(r.slice(0, 3).map((l) => l.genre)).toEqual(['erreur', 'erreur', 'erreur'])
    expect(r[3].genre).toBe('explicite')
  })

  it('bord: a function defined with itself is a cycle', () => {
    expect(analyse(['f(x) = f(x) + 1'])[0].genre).toBe('erreur')
  })

  it('bord: a constant defined with itself is a cycle', () => {
    expect(analyse(['a = a + 1'])[0].genre).toBe('erreur')
  })

  it('bord: a line using a definition in error is in error too', () => {
    const r = analyse(['f(x) = g(x)', 'g(x) = f(x)', 'y = f(x) + 1'])
    expect(r[2].genre).toBe('erreur')
  })

  it('bord: results keep the order and the ids of the lines', () => {
    const r = analyse(['f(x) = g(x)', 'g(x) = f(x)', '', 'y = x'])
    expect(r.map((l) => l.id)).toEqual(['l1', 'l2', 'l3', 'l4'])
  })
})

describe('critère 7 : e, exp, ln, log', () => {
  it('given e^x and exp(x) then the same values', () => {
    const [a, b] = analyse(['e^x', 'exp(x)'])
    for (const x of [-2, 0, 1, 2.5]) {
      expect(fn(a)(x)).toBeCloseTo(fn(b)(x), 12)
      expect(fn(a)(x)).toBeCloseTo(Math.exp(x), 9)
    }
    expect(fn(a)(1)).toBeCloseTo(2.718281828459045, 12)
  })

  it('ln(e) = 1', () => {
    expect(calcul(analyse(['ln(e)'])[0]).valeur).toBeCloseTo(1, 12)
  })

  it('log(1000) = 3', () => {
    expect(calcul(analyse(['log(1000)'])[0]).valeur).toBeCloseTo(3, 12)
  })

  it('bord: log is decimal, ln is natural', () => {
    const r = analyse(['log(100)', 'ln(1)'])
    expect(calcul(r[0]).valeur).toBeCloseTo(2, 12)
    expect(calcul(r[1]).valeur).toBeCloseTo(0, 12)
  })

  it("bord: e is Euler's constant, and ex is e × x", () => {
    const r = analyse(['y = ex'])
    expect(fn(r[0])(2)).toBeCloseTo(2 * Math.E, 12)
  })

  it('bord: π and pi are the same constant', () => {
    const r = analyse(['π', 'pi'])
    expect(calcul(r[0]).valeur).toBeCloseTo(Math.PI, 12)
    expect(calcul(r[1]).valeur).toBeCloseTo(Math.PI, 12)
  })

  it('bord: racine, sqrt and √ agree, and |x| = abs(x)', () => {
    const r = analyse(['racine(x)', 'sqrt(x)', '√(x)', '|x|', 'abs(x)'])
    expect(fn(r[0])(9)).toBeCloseTo(3, 12)
    expect(fn(r[1])(9)).toBeCloseTo(3, 12)
    expect(fn(r[2])(9)).toBeCloseTo(3, 12)
    expect(fn(r[3])(-4)).toBeCloseTo(4, 12)
    expect(fn(r[4])(-4)).toBeCloseTo(4, 12)
  })
})

describe('hors domaine : NaN, jamais une exception ni Infinity', () => {
  it('ln, √ and 1/x outside their domain are NaN', () => {
    const r = analyse(['y = ln(x)', 'y = √x', 'y = 1/x', 'y = log(x)'])
    expect(fn(r[0])(-1)).toBeNaN()
    expect(fn(r[0])(0)).toBeNaN()
    expect(fn(r[1])(-4)).toBeNaN()
    expect(fn(r[2])(0)).toBeNaN()
    expect(fn(r[3])(-1)).toBeNaN()
    expect(fn(r[0])(Math.E)).toBeCloseTo(1, 12)
  })

  it('a curve with a pole is not an error', () => {
    expect(analyse(['y = 1/(x − 1)'])[0].genre).toBe('explicite')
  })
})

describe('ordre libre, redéfinitions et appels', () => {
  it('lines come in any order', () => {
    const r = analyse(['y = f(x)', 'f(x) = x + 1'])
    expect(fn(r[0])(2)).toBeCloseTo(3, 12)
    const f = r[1]
    if (f.genre !== 'explicite') throw new Error(f.genre)
    expect(f.nom).toBe('f')
  })

  it('a constant defined after its use is found', () => {
    const r = analyse(['y = ax', 'a = 4'])
    expect(fn(r[0])(2)).toBeCloseTo(8, 12)
  })

  it('g(x) = f(x) + 1 and y = f(x − 2) call f', () => {
    const r = analyse(['f(x) = x²', 'g(x) = f(x) + 1', 'y = f(x − 2)'])
    expect(fn(r[1])(3)).toBeCloseTo(10, 12)
    expect(fn(r[2])(5)).toBeCloseTo(9, 12)
  })

  it('a second definition of the same letter is refused on the second line only', () => {
    const r = analyse(['f(x) = x', 'f(x) = 2x'])
    expect(r[0].genre).toBe('explicite')
    const e = erreur(r[1])
    expect(e.message).toContain('La lettre f est déjà définie à la ligne 1.')
    expect(fn(r[0])(3)).toBeCloseTo(3, 12)
  })

  it('a letter cannot be both a constant and a function definition', () => {
    const r = analyse(['a = 2', 'a(x) = x'])
    expect(r[0].genre).toBe('constante')
    expect(r[1].genre).toBe('erreur')
  })

  it('the function name e is not allowed', () => {
    expect(analyse(['e(x) = x'])[0].genre).toBe('erreur')
  })

  it('unknown function', () => {
    const e = erreur(analyse(['y = g(x)'])[0])
    expect(e.message).toBe(
      'Je ne connais pas la fonction g. Définis-la d’abord, par exemple g(x) = x².'
    )
  })

  it('derivative of an unknown function', () => {
    const e = erreur(analyse(["y = g'(x)"])[0])
    expect(e.message).toBe(
      'Je ne connais pas la fonction g, donc je ne peux pas calculer g’(x). Définis d’abord g.'
    )
  })

  it('a function used without brackets', () => {
    const e = erreur(analyse(['f(x) = x²', 'y = f + 1'])[1])
    expect(e.message).toBe(`f est une fonction${NBSP}: écris f(x), avec la parenthèse.`)
  })

  it('unsupported functions are errors, not letters', () => {
    expect(analyse(['y = arcsin(x)'])[0].genre).toBe('erreur')
  })
})

describe('relations et lignes vides', () => {
  it('inequalities are refused with a clear sentence', () => {
    for (const t of ['y < x', 'y > 2x', 'y ≤ x', 'y ≥ 1', 'y ≠ 1']) {
      const e = erreur(analyse([t])[0])
      expect(e.message).toBe(
        'Les inéquations ne sont pas prises en charge ici. Écris une égalité, avec un seul signe =.'
      )
    }
  })

  it('two = signs are refused', () => {
    const e = erreur(analyse(['y = x = 2'])[0])
    expect(e.message).toBe('Une ligne ne peut contenir qu’un seul signe =.')
  })

  it('blank lines are vide and keep their id', () => {
    const r = analyse(['', '   ', 'y = x'])
    expect(r[0]).toEqual({ id: 'l1', genre: 'vide' })
    expect(r[1]).toEqual({ id: 'l2', genre: 'vide' })
    expect(r[2].id).toBe('l3')
  })

  it('an empty list gives an empty result', () => {
    expect(analyserLignes([])).toEqual([])
  })

  it('every erreur carries a French message and a numeric position', () => {
    const r = analyse(['y = (x', 'y = 2 +', 'y = x $'])
    for (const l of r) {
      const e = erreur(l)
      expect(e.message.length).toBeGreaterThan(5)
      expect(Number.isInteger(e.position)).toBe(true)
      expect(e.position).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('critère 8 : ce que lisait ADR 0038 est lu de même', () => {
  it('bare polynomial, decimal comma and implicit product', () => {
    const r = analyse(['2x + 1', 'y = 1,5x²', 'y = 3(x − 1)'])
    expect(fn(r[0])(3)).toBeCloseTo(7, 12)
    expect(fn(r[1])(2)).toBeCloseTo(6, 12)
    expect(fn(r[2])(3)).toBeCloseTo(6, 12)
  })

  it('x^2 and x² are the same curve, − and ASCII - too', () => {
    const r = analyse(['x^2', 'x²', 'x - 1', 'x − 1'])
    expect(fn(r[0])(3)).toBeCloseTo(9, 12)
    expect(fn(r[1])(3)).toBeCloseTo(9, 12)
    expect(fn(r[2])(3)).toBeCloseTo(2, 12)
    expect(fn(r[3])(3)).toBeCloseTo(2, 12)
  })
})

describe('critère 9 : aperçu LaTeX de la ligne', () => {
  it('1/2x gives \\frac{1}{2}x', () => {
    expect(analyse(['1/2x'])[0]).toMatchObject({ latex: '\\frac{1}{2}x' })
  })

  it('(x+1)/(x−1) gives \\frac{x+1}{x-1}', () => {
    expect(analyse(['(x+1)/(x−1)'])[0]).toMatchObject({ latex: '\\frac{x+1}{x-1}' })
  })

  it('√(x+1) gives \\sqrt{x+1}', () => {
    expect(analyse(['√(x+1)'])[0]).toMatchObject({ latex: '\\sqrt{x+1}' })
  })

  it('2^(x+1) gives 2^{x+1}', () => {
    expect(analyse(['2^(x+1)'])[0]).toMatchObject({ latex: '2^{x+1}' })
  })

  it('bord: x^2 gives x^{2}', () => {
    expect(analyse(['x^2'])[0]).toMatchObject({ latex: 'x^{2}' })
  })

  it('bord: a definition line reads f(x)=…', () => {
    const l = analyse(['f(x) = x + 1'])[0]
    if (l.genre !== 'explicite') throw new Error(l.genre)
    expect(l.latex).toMatch(/^f\(x\)=/)
  })
})
