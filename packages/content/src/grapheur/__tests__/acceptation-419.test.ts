// Acceptance tests for implicit curves, issue #419 (parent epic #417).
// Written from the criteria and the public API only. Expected values are
// computed here, analytically, never copied from the implementation output.
import { describe, expect, it } from 'vitest'
import { traceImplicite } from '../../index'
import type { Fenetre, PointSvg } from '../../index'

const LARGEUR = 800
const HAUTEUR = 600
const EPS = 1e-6

type Vue = {
  fenetre: Fenetre
  versSvg: (x: number, y: number) => PointSvg
  versMath: (p: PointSvg) => { x: number; y: number }
}

// Affine view of an 800x600 px canvas, y pointing down.
function vue(fenetre: Fenetre): Vue {
  const sx = LARGEUR / (fenetre.xMax - fenetre.xMin)
  const sy = HAUTEUR / (fenetre.yMax - fenetre.yMin)
  return {
    fenetre,
    versSvg: (x, y) => ({
      x: (x - fenetre.xMin) * sx,
      y: (fenetre.yMax - y) * sy,
    }),
    versMath: (p) => ({
      x: fenetre.xMin + p.x / sx,
      y: fenetre.yMax - p.y / sy,
    }),
  }
}

const carre5 = vue({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 })

type Polyligne = PointSvg[]
type Trace = { chemins: Polyligne[]; points: PointSvg[] }

function distSegment(p: PointSvg, a: PointSvg, b: PointSvg): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function distPolylignes(p: PointSvg, polylignes: Polyligne[]): number {
  let best = Infinity
  for (const pl of polylignes) {
    if (pl.length === 1) {
      best = Math.min(best, Math.hypot(p.x - pl[0].x, p.y - pl[0].y))
    }
    for (let i = 0; i + 1 < pl.length; i++) {
      best = Math.min(best, distSegment(p, pl[i], pl[i + 1]))
    }
  }
  return best
}

function dansCadre(p: PointSvg, marge = EPS): boolean {
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= -marge &&
    p.x <= LARGEUR + marge &&
    p.y >= -marge &&
    p.y <= HAUTEUR + marge
  )
}

// True curve sampled analytically: parametric function t in [0,1] -> math point.
function verite(v: Vue, param: (t: number) => [number, number], n = 20000): Polyligne {
  const out: Polyligne = []
  for (let i = 0; i <= n; i++) {
    const [x, y] = param(i / n)
    out.push(v.versSvg(x, y))
  }
  return out
}

// Points every ~1 px along the truth that are inside the frame.
function echantillons(truth: Polyligne[]): PointSvg[] {
  const out: PointSvg[] = []
  for (const pl of truth) {
    for (let i = 0; i + 1 < pl.length; i++) {
      const a = pl[i]
      const b = pl[i + 1]
      const k = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)))
      for (let j = 0; j < k; j++) {
        const p = {
          x: a.x + ((b.x - a.x) * j) / k,
          y: a.y + ((b.y - a.y) * j) / k,
        }
        if (dansCadre(p, 0)) out.push(p)
      }
    }
  }
  return out
}

function tousPoints(r: Trace): PointSvg[] {
  return [...r.chemins.flat(), ...r.points]
}

function verifieProche(r: Trace, truth: Polyligne[], tol = 1) {
  for (const pl of r.chemins) {
    for (let i = 0; i < pl.length; i++) {
      expect(distPolylignes(pl[i], truth)).toBeLessThan(tol)
      if (i + 1 < pl.length) {
        const mid = {
          x: (pl[i].x + pl[i + 1].x) / 2,
          y: (pl[i].y + pl[i + 1].y) / 2,
        }
        expect(distPolylignes(mid, truth)).toBeLessThan(tol + 0.5)
      }
    }
  }
  for (const p of r.points) expect(distPolylignes(p, truth)).toBeLessThan(tol)
}

function verifieCouverture(r: Trace, truth: Polyligne[], tol = 2) {
  const trace = [...r.chemins, ...r.points.map((p) => [p])]
  const manques = echantillons(truth).filter((s) => distPolylignes(s, trace) >= tol)
  expect(manques.slice(0, 5)).toEqual([])
}

function verifieCadre(r: Trace) {
  for (const p of tousPoints(r)) expect(dansCadre(p)).toBe(true)
  for (const pl of r.chemins) expect(pl.length).toBeGreaterThanOrEqual(2)
}

describe('traceImplicite - acceptation #419', () => {
  // critère 1 : cercle x² + y² - 4
  describe('cercle x² + y² = 4 sur [-5 ; 5]²', () => {
    const F = (x: number, y: number) => x * x + y * y - 4
    const r = traceImplicite(F, carre5.fenetre, carre5.versSvg)
    const truth = [
      verite(carre5, (t) => [2 * Math.cos(2 * Math.PI * t), 2 * Math.sin(2 * Math.PI * t)]),
    ]

    it('should return a single closed polyline', () => {
      // critère 1
      expect(r.chemins).toHaveLength(1)
      const c = r.chemins[0]
      expect(c.length).toBeGreaterThan(8)
      const d = Math.hypot(c[0].x - c[c.length - 1].x, c[0].y - c[c.length - 1].y)
      expect(d).toBeLessThanOrEqual(1)
    })

    it('should keep every point within 1 px of the circle of radius 2', () => {
      // critère 1
      verifieProche(r, truth, 1)
    })

    it('should leave no gap larger than 2 px and stay in the frame', () => {
      // critère 1
      verifieCouverture(r, truth, 2)
      verifieCadre(r)
    })
  })

  // besoin : ellipse x²/9 + y²/4 = 1
  describe('ellipse x²/9 + y²/4 = 1', () => {
    const F = (x: number, y: number) => (x * x) / 9 + (y * y) / 4 - 1
    const r = traceImplicite(F, carre5.fenetre, carre5.versSvg)
    const truth = [
      verite(carre5, (t) => [3 * Math.cos(2 * Math.PI * t), 2 * Math.sin(2 * Math.PI * t)]),
    ]

    it('should trace one closed curve within 1 px of the true ellipse without gap', () => {
      // besoin (ellipse), critère 1 (même propriété)
      expect(r.chemins).toHaveLength(1)
      verifieProche(r, truth, 1)
      verifieCouverture(r, truth, 2)
      verifieCadre(r)
    })
  })

  // besoin : parabole x = y²
  describe('parabole x = y²', () => {
    const F = (x: number, y: number) => x - y * y
    const r = traceImplicite(F, carre5.fenetre, carre5.versSvg)
    const m = Math.sqrt(5) // x <= 5 means |y| <= sqrt(5)
    const truth = [verite(carre5, (t) => [(-m + 2 * m * t) ** 2, -m + 2 * m * t])]

    it('should trace one branch within 1 px of the parabola without gap', () => {
      // besoin (x = y²)
      expect(r.chemins).toHaveLength(1)
      verifieProche(r, truth, 1)
      verifieCouverture(r, truth, 2)
      verifieCadre(r)
    })
  })

  // critère 2 : x - 3
  describe('droite x = 3', () => {
    const r = traceImplicite((x) => x - 3, carre5.fenetre, carre5.versSvg)
    const xSvg = carre5.versSvg(3, 0).x

    it('should draw a vertical segment at x = 3 from top to bottom of the frame', () => {
      // critère 2
      const pts = r.chemins.flat()
      expect(pts.length).toBeGreaterThanOrEqual(2)
      for (const p of pts) expect(Math.abs(p.x - xSvg)).toBeLessThan(1)
      expect(Math.min(...pts.map((p) => p.y))).toBeLessThanOrEqual(1)
      expect(Math.max(...pts.map((p) => p.y))).toBeGreaterThanOrEqual(HAUTEUR - 1)
      verifieCouverture(r, [[carre5.versSvg(3, -5), carre5.versSvg(3, 5)]], 2)
      verifieCadre(r)
    })
  })

  // critère 3 : hyperbole xy - 1
  describe('hyperbole xy = 1', () => {
    const r = traceImplicite((x, y) => x * y - 1, carre5.fenetre, carre5.versSvg)
    const xs = (t: number) => 0.2 * Math.pow(25, t) // log-spaced 0.2 to 5
    const truth = [
      verite(carre5, (t) => [xs(t), 1 / xs(t)]),
      verite(carre5, (t) => [-xs(t), -1 / xs(t)]),
    ]

    it('should trace two branches', () => {
      // critère 3
      expect(r.chemins).toHaveLength(2)
    })

    it('should have no point near the axes and no path crossing them', () => {
      // critère 3
      for (const p of tousPoints(r)) {
        const m = carre5.versMath(p)
        expect(Math.abs(m.x)).toBeGreaterThan(0.15)
        expect(Math.abs(m.y)).toBeGreaterThan(0.15)
      }
      for (const pl of r.chemins) {
        const signes = new Set(pl.map((p) => Math.sign(carre5.versMath(p).x)))
        expect(signes.size).toBe(1)
        for (let i = 0; i + 1 < pl.length; i++) {
          const a = carre5.versMath(pl[i])
          const b = carre5.versMath(pl[i + 1])
          expect(Math.sign(a.x)).toBe(Math.sign(b.x))
          expect(Math.sign(a.y)).toBe(Math.sign(b.y))
        }
      }
    })

    it('should stay within 1 px of the true hyperbola with no gap', () => {
      // critère 3
      verifieProche(r, truth, 1)
      verifieCouverture(r, truth, 2)
      verifieCadre(r)
    })
  })

  // critère 4 : 1/(x-1)
  describe('pôle 1/(x - 1)', () => {
    it('should draw nothing: no zero, no vertical line at x = 1', () => {
      // critère 4
      const r = traceImplicite((x) => 1 / (x - 1), carre5.fenetre, carre5.versSvg)
      expect(r.chemins).toEqual([])
      expect(r.points).toEqual([])
    })

    it('should draw nothing for 1/(x - 1) with the pole off the grid lines', () => {
      // critère 4
      const v = vue({ xMin: -4.3, xMax: 6.1, yMin: -2.7, yMax: 3.9 })
      const r = traceImplicite((x) => 1 / (x - 1), v.fenetre, v.versSvg)
      expect(r.chemins).toEqual([])
      expect(r.points).toEqual([])
    })
  })

  // critère 5 : sin x - sin y
  describe('sin x = sin y sur [-4 ; 4]²', () => {
    const v = vue({ xMin: -4, xMax: 4, yMin: -4, yMax: 4 })
    const F = (x: number, y: number) => Math.sin(x) - Math.sin(y)
    const r = traceImplicite(F, v.fenetre, v.versSvg)
    const P = Math.PI
    // Every solution in the window: y = x + 2kπ or y = π - x + 2kπ.
    const droite = (a: number, b: number) =>
      verite(
        v,
        (t) => {
          const x = -8 + 16 * t // generous range, clipped by the frame
          return [x, a * x + b]
        },
        2000
      )
    const truth = [
      droite(1, 0), // y = x
      droite(-1, P), // y = π - x
      droite(-1, -P), // y = -π - x
      droite(1, 2 * P), // y = x + 2π
      droite(1, -2 * P), // y = x - 2π
    ]

    it('should keep every point within 1 px of the lines y = x + 2kπ or y = π - x + 2kπ', () => {
      // critère 5
      verifieProche(r, truth, 1)
      verifieCadre(r)
    })

    it('should leave no gap larger than 2 px, saddle points included', () => {
      // critère 5
      verifieCouverture(r, truth, 2)
    })

    it('should pass through the crossings (π/2, π/2) and (-π/2, -π/2)', () => {
      // critère 5
      const trace = [...r.chemins, ...r.points.map((p) => [p])]
      for (const c of [P / 2, -P / 2]) {
        expect(distPolylignes(v.versSvg(c, c), trace)).toBeLessThan(2)
      }
    })
  })

  // critère 6 : (x-1)²
  describe('zéro double (x - 1)² = 0', () => {
    const r = traceImplicite((x) => (x - 1) * (x - 1), carre5.fenetre, carre5.versSvg)
    const xSvg = carre5.versSvg(1, 0).x

    it('should draw the line x = 1 from top to bottom', () => {
      // critère 6
      const pts = r.chemins.flat()
      expect(pts.length).toBeGreaterThanOrEqual(2)
      for (const p of pts) expect(Math.abs(p.x - xSvg)).toBeLessThan(1)
      verifieCouverture(r, [[carre5.versSvg(1, -5), carre5.versSvg(1, 5)]], 2)
      verifieCadre(r)
    })
  })

  // besoin : x² + y² = 0, point à l'origine
  describe('solution isolée x² + y² = 0', () => {
    it('should return a point at the origin and no extended curve', () => {
      // besoin (point dessiné comme un point)
      const r = traceImplicite((x, y) => x * x + y * y, carre5.fenetre, carre5.versSvg)
      const o = carre5.versSvg(0, 0)
      expect(r.points.length).toBeGreaterThanOrEqual(1)
      expect(
        distPolylignes(
          o,
          r.points.map((p) => [p])
        )
      ).toBeLessThan(1)
      for (const p of tousPoints(r)) {
        expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeLessThan(1)
      }
    })
  })

  // critère 7 : budget
  describe('sin(xy) sur [-50 ; 50]², budget', () => {
    const v = vue({ xMin: -50, xMax: 50, yMin: -50, yMax: 50 })
    // Documented margin: 5 % of the budget plus one coarse 33x33 grid (1089).
    const marge = (budget: number) => Math.ceil(budget * 0.05) + 1089

    function compte(budget?: number) {
      let appels = 0
      const F = (x: number, y: number) => {
        appels++
        return Math.sin(x * y)
      }
      const r = traceImplicite(
        F,
        v.fenetre,
        v.versSvg,
        budget === undefined ? undefined : { budget }
      )
      return { r, appels }
    }

    it('should stop within an explicit budget and return valid polylines', () => {
      // critère 7
      const budget = 20000
      const { r, appels } = compte(budget)
      expect(appels).toBeLessThanOrEqual(budget + marge(budget))
      expect(r.chemins.length).toBeGreaterThan(0)
      verifieCadre(r)
    })

    it('should honour a smaller budget as well', () => {
      // critère 7
      const budget = 5000
      const { r, appels } = compte(budget)
      expect(appels).toBeLessThanOrEqual(budget + marge(budget))
      verifieCadre(r)
    })

    it('should stop within the default budget of 200 000 evaluations', () => {
      // critère 7
      const { r, appels } = compte()
      expect(appels).toBeLessThanOrEqual(200000 + marge(200000))
      verifieCadre(r)
    })
  })

  // critère 8 : déterminisme
  describe('déterminisme', () => {
    it('should give the same output for two calls on the circle', () => {
      // critère 8
      const F = (x: number, y: number) => x * x + y * y - 4
      const a = traceImplicite(F, carre5.fenetre, carre5.versSvg)
      const b = traceImplicite(F, carre5.fenetre, carre5.versSvg)
      expect(b).toEqual(a)
    })

    it('should give the same output for two calls on sin x = sin y', () => {
      // critère 8
      const v = vue({ xMin: -4, xMax: 4, yMin: -4, yMax: 4 })
      const F = (x: number, y: number) => Math.sin(x) - Math.sin(y)
      expect(traceImplicite(F, v.fenetre, v.versSvg)).toEqual(
        traceImplicite(F, v.fenetre, v.versSvg)
      )
    })

    it('should give the same output for two calls on sin(xy) with a budget', () => {
      // critère 8
      const v = vue({ xMin: -50, xMax: 50, yMin: -50, yMax: 50 })
      const F = (x: number, y: number) => Math.sin(x * y)
      const o = { budget: 20000 }
      expect(traceImplicite(F, v.fenetre, v.versSvg, o)).toEqual(
        traceImplicite(F, v.fenetre, v.versSvg, o)
      )
    })
  })

  // consigne : fenêtre non carrée
  describe('fenêtre non carrée', () => {
    it('should trace a circle of radius 5 cut by the frame on [-8 ; 8] x [-3 ; 3]', () => {
      // besoin (fenêtre non carrée), critère 1 (même propriété)
      const v = vue({ xMin: -8, xMax: 8, yMin: -3, yMax: 3 })
      const r = traceImplicite((x, y) => x * x + y * y - 25, v.fenetre, v.versSvg)
      const truth = [
        verite(v, (t) => [5 * Math.cos(2 * Math.PI * t), 5 * Math.sin(2 * Math.PI * t)]),
      ]
      expect(r.chemins.length).toBeGreaterThanOrEqual(2) // left and right arcs
      verifieProche(r, truth, 1)
      verifieCouverture(r, truth, 2)
      verifieCadre(r)
    })

    it('should trace an off-centre ellipse on a tall window [-2 ; 6] x [-10 ; 10]', () => {
      // besoin (fenêtre non carrée)
      const v = vue({ xMin: -2, xMax: 6, yMin: -10, yMax: 10 })
      const r = traceImplicite(
        (x, y) => ((x - 2) * (x - 2)) / 4 + (y * y) / 49 - 1,
        v.fenetre,
        v.versSvg
      )
      const truth = [
        verite(v, (t) => [2 + 2 * Math.cos(2 * Math.PI * t), 7 * Math.sin(2 * Math.PI * t)]),
      ]
      expect(r.chemins).toHaveLength(1)
      verifieProche(r, truth, 1)
      verifieCouverture(r, truth, 2)
      verifieCadre(r)
    })
  })

  // robustesse : F non définie
  describe('F non définie', () => {
    it('should return nothing and not throw when F is NaN everywhere', () => {
      // besoin (cellules où F est non défini)
      let r: Trace | undefined
      expect(() => {
        r = traceImplicite(() => NaN, carre5.fenetre, carre5.versSvg)
      }).not.toThrow()
      expect(r?.chemins).toEqual([])
      expect(r?.points).toEqual([])
    })

    it('should trace only the defined part when F is NaN on one side (sqrt(x) - y)', () => {
      // besoin (cellules où F est non défini)
      const r = traceImplicite((x, y) => Math.sqrt(x) - y, carre5.fenetre, carre5.versSvg)
      // y = sqrt(x), x in [0, 5]; param by y in [0, sqrt(5)] for uniform sampling
      const m = Math.sqrt(5)
      const truth = [verite(carre5, (t) => [(m * t) ** 2, m * t])]
      verifieProche(r, truth, 1)
      verifieCadre(r)
      for (const p of tousPoints(r)) {
        expect(carre5.versMath(p).x).toBeGreaterThan(-0.05)
      }
    })
  })
})
