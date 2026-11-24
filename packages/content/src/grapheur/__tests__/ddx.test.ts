import { describe, expect, it } from 'vitest'

import { parseExpression } from '../../expression'
import { analyserLignes } from '../langage'

// d/dx(…) (#417): the symbolic derivative of any expression, with respect to x.

function lignes(...textes: string[]) {
  return analyserLignes(textes.map((texte, i) => ({ id: `l${i}`, texte })))
}

function courbe(...textes: string[]): (x: number) => number {
  const a = lignes(...textes).at(-1)
  if (a?.genre !== 'explicite') throw new Error(JSON.stringify(a))
  return a.f
}

function centrale(f: (x: number) => number, x: number): number {
  const h = 1e-5
  return (f(x + h) - f(x - h)) / (2 * h)
}

describe('d/dx(…)', () => {
  it.each([
    ['x^2 sin(x)', (x: number) => x * x * Math.sin(x)],
    ['exp(x)/(1 + x^2)', (x: number) => Math.exp(x) / (1 + x * x)],
    ['sqrt(x^2 + 1)', (x: number) => Math.sqrt(x * x + 1)],
    ['ln(x^2 + 1) - 3x', (x: number) => Math.log(x * x + 1) - 3 * x],
  ])('dérive %s comme la différence centrale', (texte, g) => {
    const f = courbe(`y = d/dx(${texte})`)
    for (const x of [-2, -0.5, 0.3, 1, 2.5]) {
      expect(f(x)).toBeCloseTo(centrale(g, x), 5)
    }
  })

  it('y = d/dx(x^3) vaut 12 en x = 2', () => {
    expect(courbe('y = d/dx(x^3)')(2)).toBeCloseTo(12, 10)
  })

  it('se compose : d/dx(d/dx(x^3)) vaut 6x', () => {
    const f = courbe('y = d/dx(d/dx(x^3))')
    expect(f(2)).toBeCloseTo(12, 10)
    expect(f(-1)).toBeCloseTo(-6, 10)
  })

  it('compose avec une constante et avec f', () => {
    const f = courbe('a = 3', 'f(x) = x^2 + 1', 'y = d/dx(a f(x))')
    expect(f(2)).toBeCloseTo(12, 10)
    expect(courbe('f(x) = sin(x)', 'y = d/dx(f(2x))')(1)).toBeCloseTo(2 * Math.cos(2), 10)
    expect(courbe('f(x) = x^3', "y = d/dx(f(x)) - f'(x)")(1.7)).toBeCloseTo(0, 10)
  })

  it('un calcul : d/dx(x^2) en un point par une fonction', () => {
    const r = lignes('g(x) = d/dx(x^2)', 'g(3)')[1]
    expect(r.genre).toBe('calcul')
    if (r.genre === 'calcul') expect(r.valeur).toBe(6)
  })

  it('propose un curseur pour une lettre inconnue qui reste après dérivation', () => {
    const r = lignes('y = d/dx(k x^2)')[0]
    expect(r.genre).toBe('erreur')
    if (r.genre === 'erreur') expect(r.erreur.curseurPropose).toBe('k')
  })

  it('d reste une lettre ordinaire ailleurs', () => {
    expect(courbe('d = 2', 'y = dx')(3)).toBe(6)
    const r = lignes('d = 2', 'd/2')[1]
    expect(r.genre === 'calcul' && r.valeur).toBe(1)
  })

  it('s’écrit \\frac{d}{dx}\\left(…\\right) dans l’aperçu', () => {
    const r = lignes('y = d/dx(x^2)')[0]
    expect(r.genre === 'explicite' && r.latex).toBe('y=\\frac{d}{dx}\\left(x^{2}\\right)')
    const n = lignes('y = 2d/dx(d/dx(x^3))')[0]
    expect(n.genre === 'explicite' && n.latex).toBe(
      'y=2\\times \\frac{d}{dx}\\left(\\frac{d}{dx}\\left(x^{3}\\right)\\right)'
    )
  })

  it('n’existe pas hors du mode calculatrice', () => {
    expect(parseExpression('d/dx(x)', { variables: ['x', 'd'] }).ok).toBe(true)
    const r = parseExpression('d/dx(x^2)', { calculator: {} })
    expect(r.ok && r.expression.evaluate({ x: 5 })).toBe(10)
  })

  it('refuse une racine n-ième avec un message', () => {
    const r = lignes('∛(8)')[0]
    expect(r.genre).toBe('erreur')
    if (r.genre === 'erreur') expect(r.erreur.message).toMatch(/racine carrée/)
  })
})
