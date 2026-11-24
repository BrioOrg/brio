import { describe, expect, it } from 'vitest'

import { analyserLignes } from '../langage'
import {
  BUDGET_POINTS,
  pointsRemarquables,
  pointsRemarquablesParCourbe,
  type CourbeExplicite,
  type PointRemarquable,
} from '../points-remarquables'

const FENETRE = { xMin: -10, xMax: 10, yMin: -8, yMax: 8 }

/** The curves of calculator lines, as the screen gets them from the engine. */
function courbes(...textes: string[]): CourbeExplicite[] {
  return analyserLignes(
    textes.map((texte, i) => ({ id: `l${i}`, texte })),
    { angle: 'radians' }
  ).flatMap((a) => (a.genre === 'explicite' ? [{ id: a.id, f: a.f }] : []))
}

const genres = (p: PointRemarquable) => p.natures.map((n) => n.genre)

describe('pointsRemarquables', () => {
  it('y = x² − 4: zeros (−2 ; 0) and (2 ; 0), y-intercept and minimum (0 ; −4), all exact', () => {
    const [c] = courbes('y = x^2 - 4')
    const { points, complet } = pointsRemarquables(c, [], FENETRE)
    expect(complet).toBe(true)
    expect(points.map((p) => [p.x, p.y])).toEqual([
      [-2, 0],
      [0, -4],
      [2, 0],
    ])
    expect(genres(points[0])).toEqual(['zero'])
    expect(genres(points[1]).sort()).toEqual(['minimum', 'ordonnee'])
    expect(points.every((p) => !p.xApproche && !p.yApproche)).toBe(true)
  })

  it('y = x and y = 1/x meet at (−1 ; −1) and (1 ; 1) only: no false intersection at the pole', () => {
    const [d, h] = courbes('y = x', 'y = 1/x')
    const inter = pointsRemarquables(d, [d, h], FENETRE).points.filter((p) =>
      p.natures.some((n) => n.genre === 'intersection')
    )
    expect(inter.map((p) => [p.x, p.y])).toEqual([
      [-1, -1],
      [1, 1],
    ])
    expect(inter[0].natures).toContainEqual({ genre: 'intersection', avec: 'l1' })
  })

  it('1/x has no zero, no y-intercept and no extremum; tan has no extremum at its poles', () => {
    const [h, t] = courbes('y = 1/x', 'y = tan(x)')
    expect(pointsRemarquables(h, [], FENETRE).points).toEqual([])
    const tan = pointsRemarquables(t, [], FENETRE).points
    expect(tan.some((p) => genres(p).includes('maximum') || genres(p).includes('minimum'))).toBe(
      false
    )
    // Its zeros are the multiples of π in the window, approximate but for 0.
    expect(tan.filter((p) => genres(p).includes('zero'))).toHaveLength(7)
    expect(tan.find((p) => p.x === 0)?.xApproche).toBe(false)
    expect(tan.find((p) => p.x > 3)?.xApproche).toBe(true)
  })

  it('an extremum proved by nothing keeps its ≈: x³ − 3x has its maximum near −1, minimum near 1', () => {
    const [c] = courbes('y = x^3 - 3x')
    const ext = pointsRemarquables(c, [], FENETRE).points.filter(
      (p) => genres(p).includes('maximum') || genres(p).includes('minimum')
    )
    expect(ext.map(genres)).toEqual([['maximum'], ['minimum']])
    expect(ext[0].x).toBeCloseTo(-1, 6)
    expect(ext[0].y).toBeCloseTo(2, 9)
    expect(ext[1].x).toBeCloseTo(1, 6)
    expect(ext.every((p) => p.xApproche && p.yApproche)).toBe(true)
  })

  it('√2 is a zero written approximately; points outside the y range are left out', () => {
    const [c] = courbes('y = x^2 - 2')
    const zeros = pointsRemarquables(c, [], FENETRE).points.filter((p) =>
      genres(p).includes('zero')
    )
    expect(zeros.map((p) => p.x)).toEqual([
      expect.closeTo(-Math.SQRT2, 8),
      expect.closeTo(Math.SQRT2, 8),
    ])
    expect(zeros.every((p) => p.xApproche && !p.yApproche)).toBe(true)
    const [haut] = courbes('y = x^2 + 20')
    expect(pointsRemarquables(haut, [], FENETRE).points).toEqual([])
  })

  it('y = 0 and two equal curves have no isolated zero or intersection', () => {
    const [zero, a, b] = courbes('y = 0', 'y = 2x', 'y = x + x')
    expect(pointsRemarquables(zero, [], FENETRE).points.map(genres)).toEqual([['ordonnee']])
    const ab = pointsRemarquables(a, [a, b], FENETRE).points
    expect(ab.some((p) => genres(p).includes('intersection'))).toBe(false)
  })

  it('never makes more evaluations than its budget, and says when it stopped short', () => {
    const cs = courbes('y = sin(50x)', 'y = cos(40x)', 'y = x/10', 'y = tan(3x)')
    const complet = pointsRemarquables(cs[0], cs, FENETRE)
    expect(complet.evaluations).toBeLessThanOrEqual(BUDGET_POINTS)
    for (const budget of [0, 100, 2_000, 20_000]) {
      const r = pointsRemarquables(cs[0], cs, FENETRE, { budget })
      expect(r.evaluations).toBeLessThanOrEqual(budget)
      expect(r.complet).toBe(false)
    }
    const parCourbe = pointsRemarquablesParCourbe(cs, FENETRE, { budget: 40_000 })
    const total = [...parCourbe.values()].reduce((s, r) => s + r.evaluations, 0)
    expect(total).toBeLessThanOrEqual(40_000)
  })

  it('an empty window gives nothing', () => {
    const [c] = courbes('y = x')
    expect(pointsRemarquables(c, [], { xMin: 1, xMax: 1, yMin: 0, yMax: 1 }).points).toEqual([])
  })
})
