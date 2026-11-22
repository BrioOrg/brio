import { describe, expect, it } from 'vitest'

import type { FigureSpec } from '../figure'
import { checkFunctionPlot } from '../function-rules'

const axes: FigureSpec['axes'] = {
  x: { from: -4, to: 4, step: 1 },
  y: { from: -4, to: 4, step: 1 },
}

function issues(spec: FigureSpec) {
  return checkFunctionPlot(spec).map((i) => `${i.path}: ${i.message}`)
}

describe('checkFunctionPlot', () => {
  it('should accept a figure without functions', () => {
    expect(issues({ axes })).toEqual([])
  })

  it('should accept a well-formed plot', () => {
    expect(
      issues({
        axes,
        functions: [{ name: 'f', expr: 'ax² − 1', domain: [-3, 3], label: true }],
        parameters: [{ name: 'a', min: -2, max: 2, step: 0.5, value: 1 }],
        readings: [
          { function: 'f', x: 1 },
          { function: 'f', y: 3 },
        ],
      })
    ).toEqual([])
  })

  it('should require axes', () => {
    expect(issues({ functions: [{ name: 'f', expr: 'x' }] })).toEqual([
      'functions: Une fonction se trace dans un repère : coche « Tracer un repère ».',
    ])
  })

  it('should report an unreadable expression with the parser’s message', () => {
    expect(issues({ axes, functions: [{ name: 'f', expr: '2t' }] })).toEqual([
      'functions[0].expr: La lettre « t » n’est pas connue : la seule lettre permise est x.',
    ])
  })

  it('should check the names', () => {
    expect(
      issues({
        axes,
        functions: [
          { name: 'f', expr: 'x' },
          { name: 'f', expr: '2x' },
          { name: 'fg', expr: '3x' },
        ],
      })
    ).toEqual([
      'functions[1].name: Deux fonctions s’appellent f.',
      'functions[2].name: Une fonction se nomme par une lettre (f, g, h…).',
    ])
  })

  it('should keep the domain inside the x axis', () => {
    expect(issues({ axes, functions: [{ name: 'f', expr: 'x', domain: [0, 6] }] })).toEqual([
      'functions[0].domain: Le domaine [0 ; 6] doit tenir dans l’axe des abscisses, de −4 à 4.',
    ])
    expect(issues({ axes, functions: [{ name: 'f', expr: 'x', domain: [2, 1] }] })).toEqual([
      'functions[0].domain: Le début du domaine doit être inférieur à sa fin.',
    ])
  })

  it('should reject a curve that never enters the window', () => {
    expect(issues({ axes, functions: [{ name: 'f', expr: 'x + 10' }] })).toEqual([
      'functions[0].expr: La courbe de f ne passe pas dans le repère : élargis l’axe des ordonnées ou change le domaine.',
    ])
  })

  it('should reject a reading that cannot be drawn', () => {
    expect(
      issues({
        axes,
        functions: [
          { name: 'f', expr: 'x²', domain: [-2, 2] },
          { name: 'g', expr: '1/x' },
        ],
        readings: [
          { function: 'h', x: 1 },
          { function: 'f', x: 3 },
          { function: 'g', x: 0 },
          { function: 'f', y: -1 },
          { function: 'f', y: 6 },
        ],
      })
    ).toEqual([
      'readings[0].function: Aucune fonction ne s’appelle h.',
      'readings[1].x: 3 est hors du tracé de f (de −2 à 2).',
      'readings[2].x: g(0) n’existe pas : on ne peut pas lire cette image.',
      'readings[3].y: −1 n’a pas d’antécédent par f visible dans le repère.',
      'readings[4].y: 6 est hors de l’axe des ordonnées (de −4 à 4).',
    ])
  })

  it('should reject an image outside the window', () => {
    expect(
      issues({ axes, functions: [{ name: 'f', expr: 'x²' }], readings: [{ function: 'f', x: 3 }] })
    ).toEqual(['readings[0].x: f(3) = 9 sort du repère : élargis l’axe des ordonnées.'])
  })

  it('should check the sliders', () => {
    expect(
      issues({
        axes,
        functions: [{ name: 'f', expr: 'ax + b' }],
        parameters: [
          { name: 'a', min: 0, max: 2, step: 0.3, value: 1 },
          { name: 'b', min: 1, max: 0, step: 1, value: 0 },
          { name: 'c', min: 0, max: 1, step: 0.5, value: 0.5 },
          { name: 'x', min: 0, max: 1, step: 0.5, value: 0.5 },
        ],
      })
    ).toEqual([
      'parameters: Au plus 3 curseurs dans une figure.',
      'parameters[0].step: De 0 à 2, le curseur de a doit avancer d’un nombre entier de pas de 0,3.',
      'parameters[0].value: a = 1 n’est pas un cran du curseur (de 0 à 2, pas de 0,3).',
      'parameters[1].max: Le maximum de b doit dépasser son minimum.',
      'parameters[3].name: x est la variable : choisis une autre lettre pour le paramètre.',
      'parameters[2].name: Le paramètre c n’apparaît dans aucune expression : son curseur ne changerait rien.',
    ])
  })
})
