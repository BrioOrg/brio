import {
  formaterDecimal,
  nombreExact,
  type CouleurCourbe,
  type NaturePoint,
  type PointRemarquable,
  type PointSvg,
} from '@brio/content'

import { HALO_CLASS } from '@/components/figure/halo'
import { CURVE_FILL } from '@/lib/curve-colours'

// Reading a curve (ADR 0049 §4, #422): the point that follows an explicit curve, its label, and
// the remarkable points of the selected curve as discreet grey dots. Texts are U5's (gate 2).

const NBSP = ' '

/** Where the point is: on the curve `id`, at x; at a remarkable point when `point` is set. */
export type Lecture = { id: string; x: number; point: PointRemarquable | null }

/** A coordinate as the calculator writes it: "≈" when rounded or only approximate. */
export function coordonnee(v: number, approche: boolean): string {
  const r = formaterDecimal(v)
  if (!r) return ''
  return approche || r.approche ? `≈ ${r.texte}` : r.texte
}

/** x chosen by the student (a multiple of a step): written in full, it is exact. */
function abscisse(l: Lecture): string {
  return l.point ? coordonnee(l.point.x, l.point.xApproche) : nombreExact(l.x)
}

/** The y read at the point, or null where the curve has no value. */
function ordonnee(l: Lecture, y: number): string | null {
  if (!Number.isFinite(y)) return null
  return l.point ? coordonnee(l.point.y, l.point.yApproche) : coordonnee(y, false)
}

const VISIBLE: Record<NaturePoint['genre'], string> = {
  zero: 'Zéro',
  ordonnee: 'Ordonnée à l’origine',
  maximum: 'Maximum',
  minimum: 'Minimum',
  intersection: 'Intersection',
}

/** « f : (1,5 ; 2,25) », « Minimum : (0 ; −4) », or the text of an undefined value. */
export function etiquette(nom: string, l: Lecture, y: number): string {
  const x = abscisse(l)
  const yt = ordonnee(l, y)
  if (yt === null) return `${nom}${NBSP}: cette courbe n’a pas de valeur pour x = ${x}.`
  const tete = l.point ? l.point.natures.map((n) => VISIBLE[n.genre]).join(' · ') : nom
  return `${tete}${NBSP}: (${x}${NBSP}; ${yt})`
}

/** The screen reader's name of one nature of a point (U5). */
function natureSr(n: NaturePoint, p: PointRemarquable, nom: (id: string) => string, de: string) {
  const x = coordonnee(p.x, p.xApproche)
  const egal = (t: string) => (t.startsWith('≈') ? t : `= ${t}`)
  switch (n.genre) {
    case 'zero':
      return `Zéro de ${de}${NBSP}: x ${egal(x)}`
    case 'ordonnee':
      return `Ordonnée à l’origine de ${de}${NBSP}: y ${egal(coordonnee(p.y, p.yApproche))}`
    case 'maximum':
      return `Maximum de ${de} en x ${egal(x)}`
    case 'minimum':
      return `Minimum de ${de} en x ${egal(x)}`
    case 'intersection':
      return `Intersection de ${de} et ${nom(n.avec)}`
  }
}

/**
 * What the live region says once the point has stopped: « f : x = 1,5 ; y ≈ 2,25 », preceded at
 * a remarkable point by what it is (« Minimum de f en x = 0. »).
 */
export function annonce(nom: string, l: Lecture, y: number, nomDe: (id: string) => string): string {
  const x = abscisse(l)
  const yt = ordonnee(l, y)
  if (yt === null) return `${nom}${NBSP}: cette courbe n’a pas de valeur pour x = ${x}.`
  const eq = (t: string) => (t.startsWith('≈') ? t : `= ${t}`)
  const valeurs = `${nom}${NBSP}: x ${eq(x)}${NBSP}; y ${eq(yt)}`
  if (!l.point) return valeurs
  const p = l.point
  const natures = p.natures.map((n) => `${natureSr(n, p, nomDe, nomDe(l.id))}.`).join(' ')
  return `${natures} ${valeurs}`
}

type Props = {
  largeur: number
  hauteur: number
  /** The point and its label; null when nothing is read. */
  lu: { p: PointSvg | null; texte: string; couleur: CouleurCourbe; auPoint: boolean } | null
  /** The remarkable points of the selected curve, in SVG pixels. */
  points: readonly PointSvg[]
}

const LARGEUR_CAR = 7

/** The dots and the point with its label, over the curves. */
export function CoucheLecture({ largeur, hauteur, lu, points }: Props) {
  let label = null
  if (lu) {
    const p = lu.p ?? { x: largeur / 2, y: 24 }
    const w = lu.texte.length * LARGEUR_CAR
    const aDroite = p.x + 10 + w <= largeur - 8
    const y = Math.min(Math.max(p.y - 12, 20), hauteur - 8)
    label = (
      <text
        x={aDroite ? p.x + 10 : Math.max(p.x - 10, 8)}
        y={y}
        textAnchor={aDroite ? 'start' : 'end'}
        data-lecture=""
        className={`font-prose text-sm font-bold ${HALO_CLASS} ${lu.auPoint ? 'fill-ink' : CURVE_FILL[lu.couleur]}`}
      >
        {lu.texte}
      </text>
    )
  }
  return (
    <g aria-hidden="true">
      {points.map((p, i) => (
        <circle
          key={i}
          data-point-remarquable=""
          cx={p.x}
          cy={p.y}
          r={4}
          className="fill-ink-muted"
        />
      ))}
      {lu?.p && (
        <circle
          cx={lu.p.x}
          cy={lu.p.y}
          r={6}
          strokeWidth={2}
          className={`${CURVE_FILL[lu.couleur]} stroke-surface-page`}
        />
      )}
      {label}
    </g>
  )
}
