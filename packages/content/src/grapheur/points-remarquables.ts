// The remarkable points of an explicit curve in a window (ADR 0049 §4, #422): its zeros, its
// y-intercept, its local extrema and its intersections with the other explicit curves on screen.
// Pure and deterministic: no React, no DOM. Every value is found numerically, so each point says
// which of its coordinates is only approximate; the screen writes those with "≈".

import { solveFor } from '../function-plot'
import type { Fenetre } from './implicite'

/** A curve y = f(x), as the calculator draws it. */
export type CourbeExplicite = { id: string; f: (x: number) => number }

/** What a point is to the curve: a zero, its y-intercept, an extremum, or where it meets another. */
export type NaturePoint =
  | { genre: 'zero' }
  | { genre: 'ordonnee' }
  | { genre: 'maximum' }
  | { genre: 'minimum' }
  | { genre: 'intersection'; avec: string }

export type PointRemarquable = {
  x: number
  y: number
  /** x is a numerical approximation: written with "≈" whatever its digits. */
  xApproche: boolean
  /** y is a numerical approximation: written with "≈" whatever its digits. */
  yApproche: boolean
  /** One point can be several things at once: (0 ; −4) is the y-intercept and the minimum. */
  natures: NaturePoint[]
}

export type ResultatPoints = {
  /** Sorted by x. */
  points: PointRemarquable[]
  /** Evaluations of the curves' functions actually made (never more than the budget). */
  evaluations: number
  /** False when the budget or POINTS_MAX cut the search short: some points may be missing. */
  complet: boolean
}

export type OptionsPoints = {
  /** Evaluations allowed for this curve (BUDGET_POINTS by default). */
  budget?: number
}

/** Evaluations of f (and of the other curves, for intersections) allowed for one curve. */
export const BUDGET_POINTS = 100_000
/** No more points than this on one curve: sin(50x) on a wide window would cover the curve. */
export const POINTS_MAX = 60
/** Samples of the window searched for extrema, as many as `solveFor` uses for zeros. */
const ECHANTILLONS = 800
/** Golden-section steps refining an extremum: the bracket shrinks by 0,618^60 ≈ 3·10⁻¹³. */
const PAS_EXTREMUM = 60
const NOMBRE_OR = (Math.sqrt(5) - 1) / 2

/**
 * Counts the evaluations of the functions it wraps; past the budget they read NaN without being
 * called (a hard cap). A non-finite value is NaN, as everywhere in the engine.
 */
class Compteur {
  n = 0
  constructor(readonly budget: number) {}

  envelopper(f: (x: number) => number): (x: number) => number {
    return (x) => {
      if (this.n >= this.budget) return Number.NaN
      this.n++
      const v = f(x)
      return Number.isFinite(v) ? v : Number.NaN
    }
  }

  get epuise(): boolean {
    return this.n >= this.budget
  }
}

function dansFenetreY(y: number, f: Fenetre): boolean {
  return Number.isFinite(y) && y >= f.yMin && y <= f.yMax
}

/**
 * The roots of g on [a, b] (`solveFor`, ADR 0038: sign changes refined by bisection, a pole
 * rejected because g does not go to 0 there), minus those lying on a stretch where g is 0 at the
 * neighbouring samples too: y = 0, or two curves that coincide, have no isolated root to show.
 */
function racinesIsolees(g: (x: number) => number, a: number, b: number): number[] {
  const dx = (b - a) / ECHANTILLONS
  return solveFor(g, 0, a, b).filter((r) => !(g(r - dx) === 0 && g(r + dx) === 0))
}

/**
 * Whether c is exactly the extremum: f is symmetric about c (f(c − δ) = f(c + δ) to the last bit)
 * and c beats both sides, for three powers of two δ well inside the bracket. x² − 4 at 0 or
 * (x − 1)² at 1 pass; x³ − 3x at 1 does not (its minimum is there, but nothing here proves it), so
 * its coordinates keep their "≈".
 */
function extremumExact(phi: (x: number) => number, c: number, dx: number): boolean {
  const base = 2 ** Math.floor(Math.log2(dx / 16))
  if (!(base > 0) || !Number.isFinite(base)) return false
  const vc = phi(c)
  return [base, base / 8, base / 64].every((d) => {
    const g = phi(c - d)
    const h = phi(c + d)
    return Number.isFinite(g) && g === h && vc > g
  })
}

/**
 * The extremum of the bracket [lo, hi] around a sample higher (phi = f: maximum) or lower
 * (phi = −f: minimum) than both its neighbours, refined by golden section; null when what the
 * samples showed is a pole (tan near π/2, 1/x² near 0), a jump, or nothing finite.
 */
function affinerExtremum(
  phi: (x: number) => number,
  lo: number,
  hi: number,
  echantillons: { xm: number; v: number; ecart: number }
): number | null {
  const val = (x: number) => {
    const v = phi(x)
    return Number.isNaN(v) ? -Infinity : v
  }
  let a = lo
  let b = hi
  let c = b - NOMBRE_OR * (b - a)
  let d = a + NOMBRE_OR * (b - a)
  let fc = val(c)
  let fd = val(d)
  for (let k = 0; k < PAS_EXTREMUM; k++) {
    if (fc >= fd) {
      b = d
      d = c
      fd = fc
      c = b - NOMBRE_OR * (b - a)
      fc = val(c)
    } else {
      a = c
      c = d
      fc = fd
      d = a + NOMBRE_OR * (b - a)
      fd = val(d)
    }
  }
  const [x, v] = fc >= fd ? [c, fc] : [d, fd]
  const meilleur = v >= echantillons.v ? x : echantillons.xm
  const vm = Math.max(v, echantillons.v)
  if (!Number.isFinite(vm)) return null
  // A pole: the refined value runs far past what the samples showed.
  if (vm - echantillons.v > echantillons.ecart + 1e-12 * Math.max(1, Math.abs(echantillons.v))) {
    return null
  }
  // A jump or a pole next to the point: f must close in on its value from both sides.
  const dx = (hi - lo) / 2
  for (const s of [-1, 1]) {
    const loin = val(meilleur + s * dx * 1e-3)
    const pres = val(meilleur + s * dx * 1e-5)
    if (!Number.isFinite(loin) || !Number.isFinite(pres)) return null
    if (loin > vm || pres > vm) return null
    const tolerance = 1e-9 * Math.max(1, Math.abs(vm))
    if (vm - pres > Math.max(vm - loin, tolerance)) return null
  }
  return meilleur
}

/**
 * The shortest decimal writing of x (0, 1, 2… decimals) at which phi is at least as high as at x:
 * the refined 1,0000000002 is the 1 it cannot be told apart from.
 */
function arrondirExtremum(phi: (x: number) => number, x: number): number {
  const v = phi(x)
  for (let d = 0; d <= 12; d++) {
    const c = Number(x.toFixed(d))
    if (c === x) return x
    const vc = phi(c)
    if (Number.isFinite(vc) && vc >= v) return Object.is(c, -0) ? 0 : c
  }
  return x
}

function extrema(
  f: (x: number) => number,
  fenetre: Fenetre,
  compteur: Compteur
): PointRemarquable[] {
  const a = fenetre.xMin
  const b = fenetre.xMax
  const dx = (b - a) / ECHANTILLONS
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i <= ECHANTILLONS; i++) {
    const x = a + dx * i
    xs.push(x)
    ys.push(f(x))
  }
  const points: PointRemarquable[] = []
  for (let i = 1; i < ECHANTILLONS; i++) {
    if (compteur.epuise) break
    const [y0, y1, y2] = [ys[i - 1], ys[i], ys[i + 1]]
    if (!Number.isFinite(y0) || !Number.isFinite(y1) || !Number.isFinite(y2)) continue
    const genre = y1 > y0 && y1 >= y2 ? 'maximum' : y1 < y0 && y1 <= y2 ? 'minimum' : null
    if (!genre) continue
    const s = genre === 'maximum' ? 1 : -1
    const phi = (x: number) => s * f(x)
    const x = affinerExtremum(phi, xs[i - 1], xs[i + 1], {
      xm: xs[i],
      v: s * y1,
      ecart: Math.abs(y1 - y0) + Math.abs(y1 - y2),
    })
    if (x === null) continue
    const c = arrondirExtremum(phi, x)
    const y = f(c)
    if (!dansFenetreY(y, fenetre)) continue
    const exact = extremumExact(phi, c, dx)
    points.push({ x: c, y, xApproche: !exact, yApproche: !exact, natures: [{ genre }] })
  }
  return points
}

/** The same place, to the precision the points are found with. */
function memePoint(p: PointRemarquable, q: PointRemarquable, fenetre: Fenetre): boolean {
  const ex = 1e-9 * Math.max(1, fenetre.xMax - fenetre.xMin)
  const ey = 1e-9 * Math.max(1, fenetre.yMax - fenetre.yMin)
  return Math.abs(p.x - q.x) <= ex && Math.abs(p.y - q.y) <= ey
}

/** Points found twice (a zero that is also the y-intercept) become one, with both natures. */
function fusionner(points: PointRemarquable[], fenetre: Fenetre): PointRemarquable[] {
  const tries = [...points].sort((p, q) => p.x - q.x)
  const out: PointRemarquable[] = []
  for (const p of tries) {
    const deja = out.find((q) => memePoint(p, q, fenetre))
    if (!deja) {
      out.push({ ...p, natures: [...p.natures] })
      continue
    }
    // An exact coordinate wins: it is the same point, known better.
    if (!p.xApproche && deja.xApproche) {
      deja.x = p.x
      deja.xApproche = false
    }
    if (!p.yApproche && deja.yApproche) {
      deja.y = p.y
      deja.yApproche = false
    }
    for (const n of p.natures) {
      if (!deja.natures.some((m) => JSON.stringify(m) === JSON.stringify(n))) deja.natures.push(n)
    }
  }
  return out
}

/**
 * The remarkable points of `courbe` in `fenetre`: the y-intercept, the zeros, the local extrema
 * and the intersections with each curve of `autres`, every one inside the window. At most
 * `options.budget` evaluations of the functions are made, whatever the curves; past it, the
 * search stops and `complet` is false. No point is ever made up: a pole, where f jumps across a
 * value without reaching it, gives neither a zero, an extremum nor an intersection.
 */
export function pointsRemarquables(
  courbe: CourbeExplicite,
  autres: readonly CourbeExplicite[],
  fenetre: Fenetre,
  options: OptionsPoints = {}
): ResultatPoints {
  const budget = Math.max(0, Math.floor(options.budget ?? BUDGET_POINTS))
  const compteur = new Compteur(budget)
  const a = fenetre.xMin
  const b = fenetre.xMax
  if (!(b > a) || !Number.isFinite(a) || !Number.isFinite(b)) {
    return { points: [], evaluations: 0, complet: true }
  }
  const f = compteur.envelopper(courbe.f)
  const trouves: PointRemarquable[] = []

  // The y-intercept: x = 0 exactly, y the value the curve has there.
  if (a <= 0 && 0 <= b) {
    const y0 = f(0)
    if (dansFenetreY(y0, fenetre)) {
      trouves.push({
        x: 0,
        y: y0,
        xApproche: false,
        yApproche: false,
        natures: [{ genre: 'ordonnee' }],
      })
    }
  }

  // The zeros, if the x-axis is in the window. Exact when f is 0 there to the last bit.
  if (dansFenetreY(0, fenetre)) {
    for (const r of racinesIsolees(f, a, b)) {
      trouves.push({
        x: r,
        y: 0,
        xApproche: f(r) !== 0,
        yApproche: false,
        natures: [{ genre: 'zero' }],
      })
    }
  }

  trouves.push(...extrema(f, fenetre, compteur))

  for (const autre of autres) {
    if (autre.id === courbe.id || compteur.epuise) continue
    const g = compteur.envelopper(autre.f)
    const ecart = (x: number) => f(x) - g(x)
    for (const r of racinesIsolees(ecart, a, b)) {
      const y = f(r)
      if (!dansFenetreY(y, fenetre)) continue
      const exact = y === g(r)
      trouves.push({
        x: r,
        y,
        xApproche: !exact,
        yApproche: !exact,
        natures: [{ genre: 'intersection', avec: autre.id }],
      })
    }
  }

  const points = fusionner(trouves, fenetre)
  return {
    points: points.slice(0, POINTS_MAX),
    evaluations: compteur.n,
    complet: !compteur.epuise && points.length <= POINTS_MAX,
  }
}

/**
 * The remarkable points of every curve of the list, each against all the others, with one budget
 * shared between them.
 */
export function pointsRemarquablesParCourbe(
  courbes: readonly CourbeExplicite[],
  fenetre: Fenetre,
  options: OptionsPoints = {}
): Map<string, ResultatPoints> {
  const budget = Math.floor((options.budget ?? BUDGET_POINTS) / Math.max(1, courbes.length))
  return new Map(
    courbes.map((c) => [c.id, pointsRemarquables(c, courbes, fenetre, { budget })] as const)
  )
}
