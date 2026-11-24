import { describe, expect, it } from 'vitest'

import {
  CALCULATRICE_CONSIGNE_MAX,
  CALCULATRICE_MAX_EXPRESSIONS,
  MESSAGES_BLOC_CALCULATRICE as M,
  checkCalculatrice,
} from '../calculatrice-rules'
import { MESSAGES } from '../grapheur/langage'

describe('checkCalculatrice', () => {
  it('should accept the block of the issue: a line, its slider and a window', () => {
    expect(
      checkCalculatrice({
        consigne: 'Déplace le curseur $a$. Que se passe-t-il quand $a$ est négatif ?',
        expressions: ['f(x) = ax + 1', 'a = 1'],
        fenetre: { x: [-5, 5], y: [-5, 5] },
      })
    ).toEqual([])
  })

  it('should accept a block without instruction nor window', () => {
    expect(checkCalculatrice({ expressions: ['y = x²'] })).toEqual([])
  })

  it('should give the engine’s French message at the path of the faulty expression', () => {
    const issues = checkCalculatrice({ expressions: ['y = x', 'y = 2 +', 'y = 3 < x'] })
    expect(issues.map((i) => i.path)).toEqual(['expressions[1]', 'expressions[2]'])
    expect(issues[1].message).toBe(MESSAGES.inequation)
    expect(issues[0].message.length).toBeGreaterThan(0)
  })

  it('should read the lines together, as the calculator does: a letter no line defines is an error', () => {
    expect(checkCalculatrice({ expressions: ['y = ax'] })).toEqual([
      { path: 'expressions[0]', message: MESSAGES.lettreInconnue('a') },
    ])
    expect(checkCalculatrice({ expressions: ['y = ax', 'a = 2'] })).toEqual([])
  })

  it('should refuse a blank expression and a block without expression', () => {
    expect(checkCalculatrice({ expressions: ['y = x', '  '] })).toEqual([
      { path: 'expressions[1]', message: M.expressionVide },
    ])
    expect(checkCalculatrice({ expressions: [] })).toEqual([
      { path: 'expressions', message: M.aucuneExpression },
    ])
  })

  it(`should refuse more than ${CALCULATRICE_MAX_EXPRESSIONS} expressions`, () => {
    const huit = Array.from({ length: CALCULATRICE_MAX_EXPRESSIONS }, (_, i) => `y = x + ${i}`)
    expect(checkCalculatrice({ expressions: huit })).toEqual([])
    expect(checkCalculatrice({ expressions: [...huit, 'y = 2x'] })).toEqual([
      { path: 'expressions', message: '8 expressions au maximum dans un bloc.' },
    ])
  })

  it('should refuse an empty or inverted window, axis by axis', () => {
    const message =
      'La fenêtre est vide ou inversée : le minimum doit être plus petit que le maximum.'
    expect(
      checkCalculatrice({ expressions: ['y = x'], fenetre: { x: [5, -5], y: [0, 10] } })
    ).toEqual([{ path: 'fenetre.x', message }])
    expect(
      checkCalculatrice({ expressions: ['y = x'], fenetre: { x: [0, 1], y: [2, 2] } })
    ).toEqual([{ path: 'fenetre.y', message }])
    expect(
      checkCalculatrice({ expressions: ['y = x'], fenetre: { x: [0, Infinity], y: [0, 1] } })
    ).toEqual([{ path: 'fenetre.x', message }])
  })

  it(`should refuse an instruction over ${CALCULATRICE_CONSIGNE_MAX} characters, counted as read`, () => {
    const juste = 'é'.repeat(CALCULATRICE_CONSIGNE_MAX)
    expect(checkCalculatrice({ consigne: juste, expressions: ['y = x'] })).toEqual([])
    // 280 characters, one of which is two UTF-16 units: still 280.
    expect(checkCalculatrice({ consigne: `𝑥${'a'.repeat(279)}`, expressions: ['y = x'] })).toEqual(
      []
    )
    expect(checkCalculatrice({ consigne: `${juste}.`, expressions: ['y = x'] })).toEqual([
      { path: 'consigne', message: 'La consigne dépasse 280 caractères.' },
    ])
  })
})
