import { describe, expect, it } from 'vitest'
import type { FigureSpec } from '@brio/content'

import { analyserLignes } from '@brio/content'

import { decoderEtat } from '@/lib/calculatrice-etat'
import { ecrireNombre, figureVersCalculatrice, hrefCalculatrice } from '../figure-vers-calculatrice'

// The two real figures of chapter 5e (ADR 0038), as written in content/.
const proportionnalite: FigureSpec = {
  axes: { x: { from: 0, to: 5, step: 1 }, y: { from: 0, to: 10, step: 1 }, grid: true },
  functions: [{ name: 'f', expr: 'ax' }],
  parameters: [{ name: 'a', min: 0.5, max: 4, step: 0.5, value: 1.5 }],
  readings: [{ function: 'f', x: 2 }],
}
const dependance: FigureSpec = {
  axes: { x: { from: 0, to: 6, step: 1 }, y: { from: 0, to: 30, step: 5 } },
  functions: [{ name: 'f', expr: '4x' }],
  readings: [{ function: 'f', x: 3 }],
}

describe('figureVersCalculatrice', () => {
  it('writes the function, the slider at its current value with its bounds, and the window', () => {
    const etat = figureVersCalculatrice(proportionnalite, { a: 2.5 })
    expect(etat?.lignes).toEqual([
      { texte: 'f(x) = ax', couleur: 1 },
      { texte: 'a = 2,5', curseur: { min: 0.5, max: 4, pas: 0.5 } },
    ])
    expect(etat?.fenetre).toEqual({ xMin: 0, xMax: 5, yMin: 0, yMax: 10 })
  })

  it("starts at the parameter's own value without a slider value", () => {
    const etat = figureVersCalculatrice(proportionnalite)
    expect(etat?.lignes[1].texte).toBe('a = 1,5')
  })

  it('opens a figure without parameters with its function only, readings left out', () => {
    const etat = figureVersCalculatrice(dependance)
    expect(etat?.lignes).toEqual([{ texte: 'f(x) = 4x', couleur: 1 }])
    expect(etat?.fenetre).toEqual({ xMin: 0, xMax: 6, yMin: 0, yMax: 30 })
  })

  it('gives a function of tone n the colour n, the others the next free colour, and keeps dashes', () => {
    const etat = figureVersCalculatrice({
      axes: dependance.axes,
      functions: [
        { name: 'f', expr: 'x', tone: 1 },
        { name: 'g', expr: '2x' },
        { name: 'h', expr: 'x²', tone: 2, style: 'dashed', domain: [0, 3] },
      ],
    })
    expect(etat?.lignes).toEqual([
      { texte: 'f(x) = x', couleur: 1 },
      { texte: 'g(x) = 2x', couleur: 3 },
      { texte: 'h(x) = x²', couleur: 2, style: 'pointille' },
    ])
  })

  it('gives nothing for a figure without functions', () => {
    expect(figureVersCalculatrice({ axes: dependance.axes })).toBeNull()
    expect(hrefCalculatrice({ axes: dependance.axes })).toBeNull()
  })
})

describe('hrefCalculatrice', () => {
  it('is the calculator address, whose ?e= decodes to the state', () => {
    const href = hrefCalculatrice(proportionnalite, { a: 2 })!
    expect(href.startsWith('/explorer/calculatrice?e=')).toBe(true)
    const e = new URL(href, 'http://x').searchParams.get('e')
    expect(decoderEtat(e)).toEqual(figureVersCalculatrice(proportionnalite, { a: 2 }))
  })
})

describe('a figure the calculator would read otherwise', () => {
  const axes = dependance.axes
  const parametre = (name: string): FigureSpec => ({
    axes,
    functions: [{ name: 'f', expr: `${name}x` }],
    parameters: [{ name, min: 0, max: 4, step: 1, value: 2 }],
  })

  it.each(['e', 'y'])('gives no link for a parameter named %s', (name) => {
    expect(figureVersCalculatrice(parametre(name))).toBeNull()
    expect(hrefCalculatrice(parametre(name))).toBeNull()
  })

  it.each(['y', 'e', 'F'])('gives no link for a function named %s', (name) => {
    const spec: FigureSpec = { axes, functions: [{ name, expr: '2x' }] }
    expect(figureVersCalculatrice(spec)).toBeNull()
  })

  it('keeps a link for the ordinary letters', () => {
    expect(figureVersCalculatrice(parametre('a'))).not.toBeNull()
    expect(figureVersCalculatrice(parametre('b'))).not.toBeNull()
  })

  it('gives no link past the 12 lines the calculator holds, and one at 12', () => {
    const noms = 'fghkmnpqrstuv'
    const fonctions = (n: number): FigureSpec => ({
      axes,
      functions: Array.from({ length: n }, (_, i) => ({ name: noms[i], expr: 'x' })),
    })
    expect(figureVersCalculatrice(fonctions(12))).not.toBeNull()
    expect(figureVersCalculatrice(fonctions(13))).toBeNull()
  })
})

describe('ecrireNombre', () => {
  it.each([
    [1.5, '1,5'],
    [2, '2'],
    [0, '0'],
    [-0, '0'],
    [-2.5, '\u22122,5'],
    [100, '100'],
    [1e-7, '0,0000001'],
    [-1e-7, '\u22120,0000001'],
    [1e21, '1000000000000000000000'],
  ])('writes %s as %s, without an exponent', (n, texte) => {
    expect(ecrireNombre(n)).toBe(texte)
  })

  it.each([1e-7, -1e-7, 1e21, -3.25, 1e15])('is read back as the same constant: %s', (n) => {
    const [ligne] = analyserLignes([{ id: 'l', texte: `a = ${ecrireNombre(n)}` }])
    expect(ligne.genre).toBe('constante')
    expect(ligne.genre === 'constante' && ligne.valeur).toBe(n)
  })

  it('writes a slider value of 1e-7 in the address text', () => {
    const spec: FigureSpec = {
      axes: dependance.axes,
      functions: [{ name: 'f', expr: 'ax' }],
      parameters: [{ name: 'a', min: 0, max: 1, step: 1e-7, value: 1e-7 }],
    }
    expect(figureVersCalculatrice(spec)?.lignes[1].texte).toBe('a = 0,0000001')
  })
})
