// The view of the graphing calculator (ADR 0049 §3): the window of the plane on screen, its
// graduations, pan and zoom, and the whole drawing model of a view — grid, axes, numbers and
// curves — in SVG pixels. Pure: no React, no DOM. The page only maps this model to SVG, and the
// mobile app can reuse it as is.

import { sampleCurve } from '../function-plot'
import { traceImplicite, type Fenetre, type PointSvg } from './implicite'

export type { Fenetre, PointSvg } from './implicite'

/** Size of the drawing, in CSS pixels. */
export type TailleVue = { largeur: number; hauteur: number }

/** Smallest and largest width (or height) of a window: beyond, doubles lose the graduations. */
export const ETENDUE_MIN = 1e-6
export const ETENDUE_MAX = 1e6
/** How far the centre of a window may be panned from the origin. */
export const CENTRE_MAX = 1e6
/** About one graduation every this many pixels. */
export const PX_PAR_GRADUATION = 80
/** Default window: x from −10 to 10. */
export const X_PAR_DEFAUT = 10

const FACTEURS_PAS = [1, 2, 5] as const

const NBSP_FINE = ' '
const MOINS = '−'

// --- Window -------------------------------------------------------------------------------------

function taillePositive(taille: TailleVue): boolean {
  return (
    Number.isFinite(taille.largeur) &&
    Number.isFinite(taille.hauteur) &&
    taille.largeur > 0 &&
    taille.hauteur > 0
  )
}

/** x from −10 to 10, y centred on 0 with the same unit as x (an orthonormal grid). */
export function fenetreParDefaut(taille: TailleVue): Fenetre {
  const demiY = taillePositive(taille) ? (X_PAR_DEFAUT * taille.hauteur) / taille.largeur : 10
  return borner({ xMin: -X_PAR_DEFAUT, xMax: X_PAR_DEFAUT, yMin: -demiY, yMax: demiY })
}

function bornerAxe(min: number, max: number): [number, number] {
  const centre = Math.min(CENTRE_MAX, Math.max(-CENTRE_MAX, (min + max) / 2))
  const etendue = Math.min(ETENDUE_MAX, Math.max(ETENDUE_MIN, max - min))
  return [centre - etendue / 2, centre + etendue / 2]
}

/** The same window, its extents kept between ETENDUE_MIN and ETENDUE_MAX, its centre in range. */
export function borner(f: Fenetre): Fenetre {
  const [xMin, xMax] = bornerAxe(f.xMin, f.xMax)
  const [yMin, yMax] = bornerAxe(f.yMin, f.yMax)
  return { xMin, xMax, yMin, yMax }
}

/** Whether a window can be drawn: finite, increasing, within the zoom bounds. */
export function fenetreValide(f: Fenetre): boolean {
  const { xMin, xMax, yMin, yMax } = f
  if (![xMin, xMax, yMin, yMax].every(Number.isFinite)) return false
  const ok = (min: number, max: number) =>
    max > min &&
    max - min >= ETENDUE_MIN * (1 - 1e-9) &&
    max - min <= ETENDUE_MAX * (1 + 1e-9) &&
    Math.abs((min + max) / 2) <= CENTRE_MAX * (1 + 1e-9)
  return ok(xMin, xMax) && ok(yMin, yMax)
}

/**
 * Zooms by `facteur` (> 1 zooms in, < 1 out) about the point `(x, y)` of the plane: that point
 * stays where it is on screen. A zoom past the bounds stops at the bound, about the same point.
 */
export function zoomAutour(f: Fenetre, point: { x: number; y: number }, facteur: number): Fenetre {
  if (!(facteur > 0) || !Number.isFinite(facteur)) return f
  const largeur = f.xMax - f.xMin
  const hauteur = f.yMax - f.yMin
  // One factor for both axes, limited so that neither axis leaves its bounds.
  const maxFacteur = Math.min(largeur, hauteur) / ETENDUE_MIN
  const minFacteur = Math.max(largeur, hauteur) / ETENDUE_MAX
  const k = Math.min(maxFacteur, Math.max(minFacteur, facteur))
  const fenetre = {
    xMin: point.x - (point.x - f.xMin) / k,
    xMax: point.x + (f.xMax - point.x) / k,
    yMin: point.y - (point.y - f.yMin) / k,
    yMax: point.y + (f.yMax - point.y) / k,
  }
  return borner(fenetre)
}

/** Zoom about the centre of the window (the + and − buttons). */
export function zoomAuCentre(f: Fenetre, facteur: number): Fenetre {
  return zoomAutour(f, { x: (f.xMin + f.xMax) / 2, y: (f.yMin + f.yMax) / 2 }, facteur)
}

/**
 * Moves the window as the pointer drags the plane by (dxPx, dyPx) screen pixels: the plane
 * follows the pointer (dragging right shows what was on the left).
 */
export function deplacer(f: Fenetre, dxPx: number, dyPx: number, taille: TailleVue): Fenetre {
  if (!taillePositive(taille) || !Number.isFinite(dxPx) || !Number.isFinite(dyPx)) return f
  const dx = (dxPx * (f.xMax - f.xMin)) / taille.largeur
  const dy = (dyPx * (f.yMax - f.yMin)) / taille.hauteur
  return borner({ xMin: f.xMin - dx, xMax: f.xMax - dx, yMin: f.yMin + dy, yMax: f.yMax + dy })
}

/** The same x range and y centre, with the y range set so one unit is as long on both axes. */
export function orthonormer(f: Fenetre, taille: TailleVue): Fenetre {
  if (!taillePositive(taille)) return f
  const centreY = (f.yMin + f.yMax) / 2
  const demiY = ((f.xMax - f.xMin) * taille.hauteur) / taille.largeur / 2
  if (demiY * 2 <= ETENDUE_MAX && demiY * 2 >= ETENDUE_MIN) {
    return borner({ ...f, yMin: centreY - demiY, yMax: centreY + demiY })
  }
  // A very wide or very tall drawing: keep y within the bounds, adjust x instead.
  const hauteur = Math.min(ETENDUE_MAX, Math.max(ETENDUE_MIN, demiY * 2))
  const centreX = (f.xMin + f.xMax) / 2
  const demiX = (hauteur * taille.largeur) / taille.hauteur / 2
  return borner({
    xMin: centreX - demiX,
    xMax: centreX + demiX,
    yMin: centreY - hauteur / 2,
    yMax: centreY + hauteur / 2,
  })
}

/** Whether one unit is as long on both axes, to a pixel's thousandth. */
export function estOrthonorme(f: Fenetre, taille: TailleVue): boolean {
  if (!taillePositive(taille)) return false
  const ux = taille.largeur / (f.xMax - f.xMin)
  const uy = taille.hauteur / (f.yMax - f.yMin)
  return Math.abs(ux - uy) <= 1e-3 * Math.max(ux, uy)
}

/** From the plane to SVG pixels (y downwards). */
export function versSvg(f: Fenetre, taille: TailleVue): (x: number, y: number) => PointSvg {
  const sx = taille.largeur / (f.xMax - f.xMin)
  const sy = taille.hauteur / (f.yMax - f.yMin)
  return (x, y) => ({ x: (x - f.xMin) * sx, y: (f.yMax - y) * sy })
}

/** From SVG pixels to the plane. */
export function depuisSvg(f: Fenetre, taille: TailleVue): (px: number, py: number) => PointSvg {
  const sx = (f.xMax - f.xMin) / taille.largeur
  const sy = (f.yMax - f.yMin) / taille.hauteur
  return (px, py) => ({ x: f.xMin + px * sx, y: f.yMax - py * sy })
}

// --- Graduations --------------------------------------------------------------------------------

/** The 1-2-5 step closest (on a log scale) to one graduation every PX_PAR_GRADUATION pixels. */
export function pasGraduation(etendue: number, pixels: number): number {
  if (!(etendue > 0) || !(pixels > 0) || !Number.isFinite(etendue) || !Number.isFinite(pixels)) {
    return 1
  }
  const brut = (etendue * PX_PAR_GRADUATION) / pixels
  const puissance = Math.floor(Math.log10(brut))
  let meilleur = 1
  let ecart = Infinity
  for (let p = puissance - 1; p <= puissance + 1; p++) {
    for (const c of FACTEURS_PAS) {
      const pas = Number((c * 10 ** p).toPrecision(1))
      const e = Math.abs(Math.log(pas / brut))
      if (e < ecart) {
        ecart = e
        meilleur = pas
      }
    }
  }
  return meilleur
}

/** Number of decimals a multiple of `pas` needs: 0,5 → 1, 0,02 → 2, 10 → 0. */
export function decimalesDuPas(pas: number): number {
  return pas >= 1 ? 0 : Math.max(0, Math.ceil(-Math.log10(pas) - 1e-9))
}

/** The graduations between min and max for a length of `pixels`: the step and its multiples. */
export function graduations(
  min: number,
  max: number,
  pixels: number
): { pas: number; valeurs: number[] } {
  const pas = pasGraduation(max - min, pixels)
  const valeurs: number[] = []
  if (!(max > min)) return { pas, valeurs }
  const premier = Math.ceil(min / pas - 1e-9)
  const dernier = Math.floor(max / pas + 1e-9)
  // A safety cap: never more than one graduation per pixel.
  if (dernier - premier > Math.max(pixels, 1)) return { pas, valeurs }
  const decimales = decimalesDuPas(pas)
  for (let k = premier; k <= dernier; k++) {
    const v = Number((k * pas).toFixed(Math.min(20, decimales)))
    valeurs.push(Object.is(v, -0) ? 0 : v)
  }
  return { pas, valeurs }
}

// --- French numbers ------------------------------------------------------------------------------

const formats = new Map<string, Intl.NumberFormat>()

function format(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cle = JSON.stringify(options)
  let f = formats.get(cle)
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', { useGrouping: true, ...options })
    formats.set(cle, f)
  }
  return f
}

/** Intl's French, with U+2212 for minus and a narrow no-break space between digit groups. */
function versFrancais(texte: string): string {
  return texte.replace(/[-‐-‒]/g, MOINS).replace(/[   ]/g, NBSP_FINE)
}

/**
 * A number in French with at most `decimales` decimals: comma, U+2212, thin spaces between groups
 * of three digits, never an exponent, never "−0".
 */
export function formaterNombre(v: number, decimales: number): string {
  if (!Number.isFinite(v)) return ''
  const d = Math.max(0, Math.min(20, Math.floor(decimales)))
  const texte = format({ maximumFractionDigits: d }).format(v)
  return versFrancais(texte.replace(/^-(0(,0*)?)$/, '$1'))
}

/** |v| under this, for a value computed with doubles, is a rounding residue: shown as 0. */
export const RESIDU = 1e-10

/**
 * A computed value as the calculator shows it in decimal writing: the floating-point residue
 * removed (sin π is 0, not 1,22e−16), rounded to 10 significant digits, then written with two
 * decimals (three significant digits under 0,1), `approche` when that is not the exact value.
 */
export function formaterDecimal(v: number): { texte: string; approche: boolean } | null {
  if (!Number.isFinite(v)) return null
  if (Number.isSafeInteger(v)) return { texte: formaterNombre(v, 0), approche: false }
  const propre = Math.abs(v) < RESIDU ? 0 : Number(v.toPrecision(10))
  const absolu = Math.abs(propre)
  if (absolu >= 1e10) {
    const texte = versFrancais(format({ maximumSignificantDigits: 10 }).format(propre))
    return { texte, approche: !Number.isSafeInteger(propre) }
  }
  const decimales =
    propre === 0 ? 0 : absolu >= 0.1 ? 2 : Math.min(12, 2 - Math.floor(Math.log10(absolu)))
  const arrondi = Number(propre.toFixed(decimales))
  return {
    texte: formaterNombre(arrondi, decimales),
    approche: Math.abs(propre - arrondi) > 1e-12 * Math.max(1, absolu),
  }
}

// --- Drawing model -------------------------------------------------------------------------------

export type CouleurCourbe = 1 | 2 | 3 | 4 | 5 | 6

/** A curve to draw: y = f(x) or F(x, y) = 0, in a colour, solid or dashed. */
export type CourbeVue =
  | {
      id: string
      genre: 'explicite'
      f: (x: number) => number
      couleur: CouleurCourbe
      pointille: boolean
    }
  | {
      id: string
      genre: 'implicite'
      F: (x: number, y: number) => number
      couleur: CouleurCourbe
      pointille: boolean
    }

export type TexteVue = {
  texte: string
  x: number
  y: number
  ancre: 'start' | 'middle' | 'end'
  ligne: 'hanging' | 'central' | 'auto'
}

export type AxeVue = {
  /** The line, from edge to edge; null when the axis is outside the window. */
  ligne: { x1: number; y1: number; x2: number; y2: number } | null
  /** The arrow at the positive end. */
  fleche: string | null
  nom: TexteVue | null
  nombres: TexteVue[]
  pas: number
}

export type CourbeDessinee = {
  id: string
  couleur: CouleurCourbe
  pointille: boolean
  /** One SVG path for all the pieces of the curve; '' when nothing is in the window. */
  d: string
  /** Isolated solutions of an implicit curve (x² + y² = 0). */
  points: PointSvg[]
}

export type ModeleVue = {
  largeur: number
  hauteur: number
  /** Grid lines, in pixels: x of the vertical ones, y of the horizontal ones. */
  grille: { verticales: number[]; horizontales: number[] }
  axeX: AxeVue
  axeY: AxeVue
  /** The single "0" at the origin, when both axes are on screen. */
  origine: TexteVue | null
  courbes: CourbeDessinee[]
}

const FLECHE_LONGUEUR = 8
const FLECHE_DEMI_LARGEUR = 4
/** Gap between an axis and its numbers, and between a number and the edge. */
const ECART = 6
/** The height of a number (text-xs) and the width of one of its characters, in pixels. */
const HAUTEUR_NOMBRE = 12
const LARGEUR_CHIFFRE = 7
/** No number closer than this to the left or right edge: it would be cut. */
const MARGE_BORD = 12

function px(v: number): string {
  return (Math.round(v * 100) / 100).toString()
}

function cheminSvg(morceaux: readonly PointSvg[][]): string {
  const parts: string[] = []
  for (const m of morceaux) {
    if (m.length < 2) continue
    parts.push(`M${px(m[0].x)} ${px(m[0].y)}`)
    for (let i = 1; i < m.length; i++) parts.push(`L${px(m[i].x)} ${px(m[i].y)}`)
  }
  return parts.join('')
}

function largeurTexte(texte: string): number {
  return texte.length * LARGEUR_CHIFFRE
}

function axeX(
  f: Fenetre,
  taille: TailleVue,
  toSvg: (x: number, y: number) => PointSvg,
  zeroAffiche: boolean
): AxeVue {
  const { largeur, hauteur } = taille
  const { pas, valeurs } = graduations(f.xMin, f.xMax, largeur)
  const decimales = decimalesDuPas(pas)
  const yAxe = toSvg(0, 0).y
  const visible = yAxe >= 0 && yAxe <= hauteur
  // Under the axis; stuck to the nearest edge when the axis is off screen or too close to it.
  const yNombres = Math.min(Math.max(yAxe + ECART, ECART), hauteur - ECART - HAUTEUR_NOMBRE)
  const nombres: TexteVue[] = []
  for (const v of valeurs) {
    if (v === 0 && !zeroAffiche) continue
    const x = toSvg(v, 0).x
    if (x < MARGE_BORD || x > largeur - MARGE_BORD) continue
    nombres.push({
      texte: formaterNombre(v, decimales),
      x,
      y: yNombres,
      ancre: 'middle',
      ligne: 'hanging',
    })
  }
  const pointe = largeur - 1
  return {
    ligne: visible ? { x1: 0, y1: yAxe, x2: pointe, y2: yAxe } : null,
    fleche: visible
      ? `${px(pointe)},${px(yAxe)} ${px(pointe - FLECHE_LONGUEUR)},${px(yAxe - FLECHE_DEMI_LARGEUR)} ${px(pointe - FLECHE_LONGUEUR)},${px(yAxe + FLECHE_DEMI_LARGEUR)}`
      : null,
    nom: visible
      ? {
          texte: 'x',
          x: pointe - FLECHE_LONGUEUR,
          y: yAxe - FLECHE_DEMI_LARGEUR - ECART,
          ancre: 'end',
          ligne: 'auto',
        }
      : null,
    nombres,
    pas,
  }
}

function axeY(
  f: Fenetre,
  taille: TailleVue,
  toSvg: (x: number, y: number) => PointSvg,
  zeroAffiche: boolean
): AxeVue {
  const { largeur, hauteur } = taille
  const { pas, valeurs } = graduations(f.yMin, f.yMax, hauteur)
  const decimales = decimalesDuPas(pas)
  const xAxe = toSvg(0, 0).x
  const visible = xAxe >= 0 && xAxe <= largeur
  const nombres: TexteVue[] = []
  for (const v of valeurs) {
    if (v === 0 && !zeroAffiche) continue
    const y = toSvg(0, v).y
    if (y < MARGE_BORD || y > hauteur - MARGE_BORD) continue
    const texte = formaterNombre(v, decimales)
    const w = largeurTexte(texte)
    // Left of the axis; on its right when there is no room; at an edge when it is off screen.
    let x: number
    let ancre: TexteVue['ancre']
    if (xAxe - ECART - w >= ECART) {
      x = Math.min(xAxe - ECART, largeur - ECART)
      ancre = 'end'
    } else {
      x = Math.max(xAxe + ECART, ECART)
      ancre = 'start'
    }
    nombres.push({ texte, x, y, ancre, ligne: 'central' })
  }
  const pointe = 1
  return {
    ligne: visible ? { x1: xAxe, y1: hauteur, x2: xAxe, y2: pointe } : null,
    fleche: visible
      ? `${px(xAxe)},${px(pointe)} ${px(xAxe - FLECHE_DEMI_LARGEUR)},${px(pointe + FLECHE_LONGUEUR)} ${px(xAxe + FLECHE_DEMI_LARGEUR)},${px(pointe + FLECHE_LONGUEUR)}`
      : null,
    nom: visible
      ? {
          texte: 'y',
          x: xAxe + FLECHE_DEMI_LARGEUR + ECART,
          y: pointe + FLECHE_LONGUEUR,
          ancre: 'start',
          ligne: 'hanging',
        }
      : null,
    nombres,
    pas,
  }
}

/** Every line of the grid: one per graduation of each axis, the axes themselves excluded. */
function grille(
  f: Fenetre,
  taille: TailleVue,
  toSvg: (x: number, y: number) => PointSvg
): ModeleVue['grille'] {
  const xs = graduations(f.xMin, f.xMax, taille.largeur).valeurs.filter((v) => v !== 0)
  const ys = graduations(f.yMin, f.yMax, taille.hauteur).valeurs.filter((v) => v !== 0)
  return {
    verticales: xs.map((v) => toSvg(v, 0).x),
    horizontales: ys.map((v) => toSvg(0, v).y),
  }
}

/** The curve's pieces in the window, as one SVG path. */
export function dessinerCourbe(
  c: CourbeVue,
  f: Fenetre,
  taille: TailleVue,
  budgetImplicite?: number
): CourbeDessinee {
  const toSvg = versSvg(f, taille)
  if (c.genre === 'explicite') {
    const morceaux = sampleCurve(c.f, f.xMin, f.xMax, f, toSvg)
    return {
      id: c.id,
      couleur: c.couleur,
      pointille: c.pointille,
      d: cheminSvg(morceaux),
      points: [],
    }
  }
  const trace = traceImplicite(c.F, f, toSvg, { budget: budgetImplicite })
  return {
    id: c.id,
    couleur: c.couleur,
    pointille: c.pointille,
    d: cheminSvg(trace.chemins),
    points: trace.points,
  }
}

/**
 * The whole drawing of a view: grid, axes with their arrows and names, graduation numbers in
 * French (a single "0" at the origin; numbers stuck to the nearest edge when their axis is off
 * screen) and the curves sampled over the whole window.
 */
export function modeleVue(
  fenetre: Fenetre,
  taille: TailleVue,
  courbes: readonly CourbeVue[] = []
): ModeleVue {
  const largeur = taillePositive(taille) ? taille.largeur : 0
  const hauteur = taillePositive(taille) ? taille.hauteur : 0
  const vide: AxeVue = { ligne: null, fleche: null, nom: null, nombres: [], pas: 1 }
  if (largeur === 0 || !fenetreValide(fenetre)) {
    return {
      largeur,
      hauteur,
      grille: { verticales: [], horizontales: [] },
      axeX: vide,
      axeY: vide,
      origine: null,
      courbes: courbes.map((c) => ({
        id: c.id,
        couleur: c.couleur,
        pointille: c.pointille,
        d: '',
        points: [],
      })),
    }
  }
  const t = { largeur, hauteur }
  const toSvg = versSvg(fenetre, t)
  const o = toSvg(0, 0)
  const xVisible = o.y >= 0 && o.y <= hauteur
  const yVisible = o.x >= 0 && o.x <= largeur
  const origine: TexteVue | null =
    xVisible &&
    yVisible &&
    o.x - ECART >= MARGE_BORD &&
    o.y + ECART + HAUTEUR_NOMBRE <= hauteur - ECART
      ? { texte: '0', x: o.x - ECART, y: o.y + ECART, ancre: 'end', ligne: 'hanging' }
      : null
  return {
    largeur,
    hauteur,
    grille: grille(fenetre, t, toSvg),
    // A single 0 at the origin; without it, each axis writes its own 0.
    axeX: axeX(fenetre, t, toSvg, origine === null),
    axeY: axeY(fenetre, t, toSvg, origine === null),
    origine,
    courbes: courbes.map((c) => dessinerCourbe(c, fenetre, t)),
  }
}
