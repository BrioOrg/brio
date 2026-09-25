'use client'

import { buildDrawingModel, type FigureSpec, type LabelPlacement } from '@brio/content'

import { FigureRenderer } from '@/components/figure-renderer'
import type { Bloc } from '@/lib/cours-editeur'

// Constructeur de `spec` d'une figure déclarative (ADR 0013). On saisit des points nommés avec
// leurs coordonnées mathématiques, puis les primitives (segments, polygones, cercles, marques
// d'angle et de longueur, étiquettes, droites graduées) qui référencent ces points par leur nom.
// Un aperçu en direct (le même <FigureRenderer/> que l'élève) montre le résultat ; une spec
// incomplète (un segment vers un point non encore défini) affiche un message au lieu de planter.
// `alt` est obligatoire (requis par le schéma) : une figure sans équivalent textuel est invalide.

type Props = {
  bloc: Bloc
  onModifier: (patch: Record<string, unknown>) => void
  onFocusBloc?: () => void
}

type Point = { name: string; x: number; y: number; label?: { placement?: LabelPlacement } }
type Segment = { from: string; to: string }
type Polygon = { vertices: string[] }
type Circle = { center: string; through?: string; radius?: number }
type AngleMark = { vertex: string; from: string; to: string; right?: boolean }
type LengthMark = { segment: string; ticks: 1 | 2 | 3 }
type FreeLabel = { text: string; x: number; y: number }
type NumberLine = {
  from: number
  to: number
  step: number
  labelEvery?: number
  marks?: { value: number; label?: string }[]
}
type CoordinateSpace = { xMin: number; xMax: number; yMin: number; yMax: number }

const PLACEMENTS: LabelPlacement[] = [
  'auto',
  'above',
  'below',
  'left',
  'right',
  'above-left',
  'above-right',
  'below-left',
  'below-right',
]

const champ =
  'rounded-md border border-line bg-surface-page px-2 py-1 font-prose text-sm text-ink focus:border-accent focus:outline-none'
const selectClass = `${champ} font-display font-bold`
const titreSection = 'font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted'
const boutonAjouter = 'font-display text-sm font-bold text-accent-ink hover:underline'

/** Petit bouton « supprimer » d'une ligne de primitive. */
function Supprimer({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="shrink-0 text-ink-muted hover:text-danger"
    >
      ✕
    </button>
  )
}

/** Champ numérique compact qui renvoie un nombre (ou 0 si vide). */
function ChampNombre({
  value,
  onChange,
  onFocus,
  ariaLabel,
  className,
}: {
  value: number
  onChange: (n: number) => void
  onFocus?: () => void
  ariaLabel: string
  className?: string
}) {
  return (
    <input
      type="number"
      step="any"
      inputMode="decimal"
      aria-label={ariaLabel}
      className={`${champ} w-16 ${className ?? ''}`}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      onFocus={onFocus}
    />
  )
}

/** Sélecteur d'un point par son nom (les primitives référencent les points par nom). */
function ChoixPoint({
  value,
  points,
  onChange,
  ariaLabel,
}: {
  value: string
  points: Point[]
  onChange: (name: string) => void
  ariaLabel: string
}) {
  return (
    <select
      aria-label={ariaLabel}
      className={`${selectClass} w-20`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      {points.map((p) => (
        <option key={p.name} value={p.name}>
          {p.name}
        </option>
      ))}
    </select>
  )
}

export function FigureEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  const spec = (bloc.spec ?? {}) as FigureSpec
  const points = (spec.points ?? []) as Point[]
  const segments = (spec.segments ?? []) as Segment[]
  const polygons = (spec.polygons ?? []) as Polygon[]
  const circles = (spec.circles ?? []) as Circle[]
  const angleMarks = (spec.angleMarks ?? []) as AngleMark[]
  const lengthMarks = (spec.lengthMarks ?? []) as LengthMark[]
  const labels = (spec.labels ?? []) as FreeLabel[]
  const numberLines = (spec.numberLines ?? []) as NumberLine[]
  const coordinateSpace = spec.coordinateSpace as CoordinateSpace | undefined

  const patchSpec = (patch: Partial<FigureSpec>) => onModifier({ spec: { ...spec, ...patch } })

  // Nom par défaut d'un nouveau point : la première lettre libre A, B, C…
  const nomLibre = () => {
    const utilises = new Set(points.map((p) => p.name))
    for (let i = 0; i < 26; i++) {
      const c = String.fromCharCode(65 + i)
      if (!utilises.has(c)) return c
    }
    return `P${points.length + 1}`
  }

  return (
    <div className="rounded-lg border border-line bg-surface-panel p-4">
      <p className={`${titreSection} mb-3`}>Figure</p>

      {/* alt (obligatoire) + légende */}
      <label className="flex flex-col gap-1">
        <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
          Texte alternatif <span className="text-danger">*</span>
        </span>
        <input
          className={champ}
          value={(bloc.alt as string) ?? ''}
          onChange={(e) => onModifier({ alt: e.target.value })}
          onFocus={onFocusBloc}
          placeholder="Décris la figure pour un élève qui ne la voit pas (ex. Triangle rectangle en A)"
          aria-label="Texte alternatif de la figure"
        />
      </label>
      <label className="mt-2 flex flex-col gap-1">
        <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
          Légende (facultatif)
        </span>
        <input
          className={champ}
          value={(bloc.caption as string) ?? ''}
          onChange={(e) => onModifier({ caption: e.target.value || undefined })}
          onFocus={onFocusBloc}
          aria-label="Légende de la figure"
        />
      </label>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Colonne des primitives */}
        <div className="flex flex-col gap-4">
          {/* Points */}
          <section>
            <p className={`${titreSection} mb-1.5`}>Points</p>
            <ul className="flex flex-col gap-1.5">
              {points.map((p, i) => {
                const majP = (patch: Partial<Point>) =>
                  patchSpec({ points: points.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
                return (
                  <li key={i} className="flex flex-wrap items-center gap-1.5">
                    <input
                      aria-label={`Nom du point ${i + 1}`}
                      className={`${champ} w-14`}
                      value={p.name}
                      onChange={(e) => majP({ name: e.target.value })}
                      onFocus={onFocusBloc}
                      placeholder="A"
                    />
                    <span className="text-ink-muted">(</span>
                    <ChampNombre
                      value={p.x}
                      onChange={(x) => majP({ x })}
                      onFocus={onFocusBloc}
                      ariaLabel={`Abscisse du point ${p.name || i + 1}`}
                    />
                    <ChampNombre
                      value={p.y}
                      onChange={(y) => majP({ y })}
                      onFocus={onFocusBloc}
                      ariaLabel={`Ordonnée du point ${p.name || i + 1}`}
                    />
                    <span className="text-ink-muted">)</span>
                    <select
                      aria-label={`Placement de l’étiquette du point ${p.name || i + 1}`}
                      className={`${selectClass} w-28`}
                      value={p.label?.placement ?? 'auto'}
                      onChange={(e) =>
                        majP({ label: { placement: e.target.value as LabelPlacement } })
                      }
                    >
                      {PLACEMENTS.map((pl) => (
                        <option key={pl} value={pl}>
                          {pl}
                        </option>
                      ))}
                    </select>
                    <Supprimer
                      label={`Supprimer le point ${p.name || i + 1}`}
                      onClick={() => patchSpec({ points: points.filter((_, j) => j !== i) })}
                    />
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className={`mt-1.5 ${boutonAjouter}`}
              onClick={() => patchSpec({ points: [...points, { name: nomLibre(), x: 0, y: 0 }] })}
            >
              ＋ Point
            </button>
          </section>

          {/* Segments */}
          <PrimitiveListe
            titre="Segments"
            items={segments}
            onAjouter={() => patchSpec({ segments: [...segments, { from: '', to: '' }] })}
            onSupprimer={(i) => patchSpec({ segments: segments.filter((_, j) => j !== i) })}
            labelSuppr="Supprimer le segment"
            rendu={(seg, i) => {
              const maj = (patch: Partial<Segment>) =>
                patchSpec({ segments: segments.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
              return (
                <>
                  <ChoixPoint
                    value={seg.from}
                    points={points}
                    onChange={(from) => maj({ from })}
                    ariaLabel={`Segment ${i + 1} — départ`}
                  />
                  <span className="text-ink-muted">→</span>
                  <ChoixPoint
                    value={seg.to}
                    points={points}
                    onChange={(to) => maj({ to })}
                    ariaLabel={`Segment ${i + 1} — arrivée`}
                  />
                </>
              )
            }}
          />

          {/* Polygones */}
          <section>
            <p className={`${titreSection} mb-1.5`}>Polygones</p>
            <ul className="flex flex-col gap-1.5">
              {polygons.map((poly, i) => {
                const majV = (vertices: string[]) =>
                  patchSpec({ polygons: polygons.map((x, j) => (j === i ? { vertices } : x)) })
                return (
                  <li key={i} className="flex flex-wrap items-center gap-1.5">
                    {poly.vertices.map((v, k) => (
                      <ChoixPoint
                        key={k}
                        value={v}
                        points={points}
                        onChange={(name) => majV(poly.vertices.map((x, j) => (j === k ? name : x)))}
                        ariaLabel={`Polygone ${i + 1} — sommet ${k + 1}`}
                      />
                    ))}
                    <button
                      type="button"
                      className={boutonAjouter}
                      onClick={() => majV([...poly.vertices, ''])}
                    >
                      ＋ sommet
                    </button>
                    {poly.vertices.length > 3 && (
                      <button
                        type="button"
                        className="font-display text-sm font-bold text-ink-muted hover:text-danger"
                        onClick={() => majV(poly.vertices.slice(0, -1))}
                      >
                        − sommet
                      </button>
                    )}
                    <Supprimer
                      label={`Supprimer le polygone ${i + 1}`}
                      onClick={() => patchSpec({ polygons: polygons.filter((_, j) => j !== i) })}
                    />
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className={`mt-1.5 ${boutonAjouter}`}
              onClick={() => patchSpec({ polygons: [...polygons, { vertices: ['', '', ''] }] })}
            >
              ＋ Polygone
            </button>
          </section>

          {/* Cercles */}
          <section>
            <p className={`${titreSection} mb-1.5`}>Cercles</p>
            <ul className="flex flex-col gap-1.5">
              {circles.map((c, i) => {
                const par = c.radius !== undefined ? 'radius' : 'through'
                const maj = (next: Circle) =>
                  patchSpec({
                    // Circle est un union « through | radius » côté schéma ; on édite en local avec
                    // un type souple et on recolle au type strict à l'écriture.
                    circles: circles.map((x, j) => (j === i ? next : x)) as FigureSpec['circles'],
                  })
                return (
                  <li key={i} className="flex flex-wrap items-center gap-1.5">
                    <span className="font-prose text-xs text-ink-muted">centre</span>
                    <ChoixPoint
                      value={c.center}
                      points={points}
                      onChange={(center) => maj({ ...c, center })}
                      ariaLabel={`Cercle ${i + 1} — centre`}
                    />
                    <select
                      aria-label={`Cercle ${i + 1} — défini par`}
                      className={`${selectClass} w-28`}
                      value={par}
                      onChange={(e) =>
                        maj(
                          e.target.value === 'radius'
                            ? { center: c.center, radius: 1 }
                            : { center: c.center, through: '' }
                        )
                      }
                    >
                      <option value="through">passant par</option>
                      <option value="radius">rayon</option>
                    </select>
                    {par === 'through' ? (
                      <ChoixPoint
                        value={c.through ?? ''}
                        points={points}
                        onChange={(through) => maj({ center: c.center, through })}
                        ariaLabel={`Cercle ${i + 1} — point de passage`}
                      />
                    ) : (
                      <ChampNombre
                        value={c.radius ?? 1}
                        onChange={(radius) => maj({ center: c.center, radius })}
                        onFocus={onFocusBloc}
                        ariaLabel={`Cercle ${i + 1} — rayon`}
                      />
                    )}
                    <Supprimer
                      label={`Supprimer le cercle ${i + 1}`}
                      onClick={() =>
                        patchSpec({
                          circles: circles.filter((_, j) => j !== i) as FigureSpec['circles'],
                        })
                      }
                    />
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className={`mt-1.5 ${boutonAjouter}`}
              onClick={() =>
                patchSpec({
                  circles: [...circles, { center: '', through: '' }] as FigureSpec['circles'],
                })
              }
            >
              ＋ Cercle
            </button>
          </section>

          {/* Marques d'angle */}
          <section>
            <p className={`${titreSection} mb-1.5`}>Marques d’angle</p>
            <ul className="flex flex-col gap-1.5">
              {angleMarks.map((am, i) => {
                const maj = (patch: Partial<AngleMark>) =>
                  patchSpec({
                    angleMarks: angleMarks.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                  })
                return (
                  <li key={i} className="flex flex-wrap items-center gap-1.5">
                    <span className="font-prose text-xs text-ink-muted">sommet</span>
                    <ChoixPoint
                      value={am.vertex}
                      points={points}
                      onChange={(vertex) => maj({ vertex })}
                      ariaLabel={`Angle ${i + 1} — sommet`}
                    />
                    <span className="font-prose text-xs text-ink-muted">entre</span>
                    <ChoixPoint
                      value={am.from}
                      points={points}
                      onChange={(from) => maj({ from })}
                      ariaLabel={`Angle ${i + 1} — première branche`}
                    />
                    <ChoixPoint
                      value={am.to}
                      points={points}
                      onChange={(to) => maj({ to })}
                      ariaLabel={`Angle ${i + 1} — seconde branche`}
                    />
                    <label className="flex items-center gap-1 font-prose text-xs text-ink-muted">
                      <input
                        type="checkbox"
                        className="accent-accent"
                        checked={am.right === true}
                        onChange={(e) => maj({ right: e.target.checked })}
                      />
                      droit
                    </label>
                    <Supprimer
                      label={`Supprimer la marque d’angle ${i + 1}`}
                      onClick={() =>
                        patchSpec({ angleMarks: angleMarks.filter((_, j) => j !== i) })
                      }
                    />
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className={`mt-1.5 ${boutonAjouter}`}
              onClick={() =>
                patchSpec({ angleMarks: [...angleMarks, { vertex: '', from: '', to: '' }] })
              }
            >
              ＋ Marque d’angle
            </button>
          </section>

          {/* Marques de longueur */}
          <section>
            <p className={`${titreSection} mb-1.5`}>Marques de longueur</p>
            <ul className="flex flex-col gap-1.5">
              {lengthMarks.map((lm, i) => {
                const maj = (patch: Partial<LengthMark>) =>
                  patchSpec({
                    lengthMarks: lengthMarks.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                  })
                return (
                  <li key={i} className="flex flex-wrap items-center gap-1.5">
                    <span className="font-prose text-xs text-ink-muted">segment</span>
                    <select
                      aria-label={`Marque de longueur ${i + 1} — segment`}
                      className={`${selectClass} w-20`}
                      value={lm.segment}
                      onChange={(e) => maj({ segment: e.target.value })}
                    >
                      <option value="">—</option>
                      {segments
                        .filter((s) => s.from && s.to)
                        .map((s) => `${s.from}${s.to}`)
                        .map((nom) => (
                          <option key={nom} value={nom}>
                            {nom}
                          </option>
                        ))}
                    </select>
                    <select
                      aria-label={`Marque de longueur ${i + 1} — nombre de traits`}
                      className={`${selectClass} w-16`}
                      value={lm.ticks}
                      onChange={(e) => maj({ ticks: Number(e.target.value) as 1 | 2 | 3 })}
                    >
                      <option value={1}>1 trait</option>
                      <option value={2}>2 traits</option>
                      <option value={3}>3 traits</option>
                    </select>
                    <Supprimer
                      label={`Supprimer la marque de longueur ${i + 1}`}
                      onClick={() =>
                        patchSpec({ lengthMarks: lengthMarks.filter((_, j) => j !== i) })
                      }
                    />
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className={`mt-1.5 ${boutonAjouter}`}
              onClick={() =>
                patchSpec({ lengthMarks: [...lengthMarks, { segment: '', ticks: 1 }] })
              }
            >
              ＋ Marque de longueur
            </button>
          </section>

          {/* Étiquettes libres */}
          <PrimitiveListe
            titre="Étiquettes"
            items={labels}
            onAjouter={() => patchSpec({ labels: [...labels, { text: '', x: 0, y: 0 }] })}
            onSupprimer={(i) => patchSpec({ labels: labels.filter((_, j) => j !== i) })}
            labelSuppr="Supprimer l’étiquette"
            rendu={(lbl, i) => {
              const maj = (patch: Partial<FreeLabel>) =>
                patchSpec({ labels: labels.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
              return (
                <>
                  <input
                    aria-label={`Étiquette ${i + 1} — texte`}
                    className={`${champ} w-28`}
                    value={lbl.text}
                    onChange={(e) => maj({ text: e.target.value })}
                    onFocus={onFocusBloc}
                    placeholder="texte"
                  />
                  <span className="text-ink-muted">(</span>
                  <ChampNombre
                    value={lbl.x}
                    onChange={(x) => maj({ x })}
                    onFocus={onFocusBloc}
                    ariaLabel={`Étiquette ${i + 1} — abscisse`}
                  />
                  <ChampNombre
                    value={lbl.y}
                    onChange={(y) => maj({ y })}
                    onFocus={onFocusBloc}
                    ariaLabel={`Étiquette ${i + 1} — ordonnée`}
                  />
                  <span className="text-ink-muted">)</span>
                </>
              )
            }}
          />

          {/* Droites graduées */}
          <section>
            <p className={`${titreSection} mb-1.5`}>Droites graduées</p>
            <ul className="flex flex-col gap-1.5">
              {numberLines.map((nl, i) => {
                const maj = (patch: Partial<NumberLine>) =>
                  patchSpec({
                    numberLines: numberLines.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                  })
                return (
                  <li key={i} className="flex flex-wrap items-center gap-1.5">
                    <span className="font-prose text-xs text-ink-muted">de</span>
                    <ChampNombre
                      value={nl.from}
                      onChange={(from) => maj({ from })}
                      onFocus={onFocusBloc}
                      ariaLabel={`Droite ${i + 1} — début`}
                    />
                    <span className="font-prose text-xs text-ink-muted">à</span>
                    <ChampNombre
                      value={nl.to}
                      onChange={(to) => maj({ to })}
                      onFocus={onFocusBloc}
                      ariaLabel={`Droite ${i + 1} — fin`}
                    />
                    <span className="font-prose text-xs text-ink-muted">pas</span>
                    <ChampNombre
                      value={nl.step}
                      onChange={(step) => maj({ step })}
                      onFocus={onFocusBloc}
                      ariaLabel={`Droite ${i + 1} — pas`}
                    />
                    <Supprimer
                      label={`Supprimer la droite graduée ${i + 1}`}
                      onClick={() =>
                        patchSpec({ numberLines: numberLines.filter((_, j) => j !== i) })
                      }
                    />
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className={`mt-1.5 ${boutonAjouter}`}
              onClick={() =>
                patchSpec({ numberLines: [...numberLines, { from: 0, to: 10, step: 1 }] })
              }
            >
              ＋ Droite graduée
            </button>
          </section>

          {/* Repère (facultatif) */}
          <section>
            <label className="flex items-center gap-1.5 font-prose text-xs text-ink-muted">
              <input
                type="checkbox"
                className="accent-accent"
                checked={coordinateSpace !== undefined}
                onChange={(e) =>
                  patchSpec({
                    coordinateSpace: e.target.checked
                      ? { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }
                      : undefined,
                  })
                }
              />
              Fixer le repère (sinon calculé automatiquement)
            </label>
            {coordinateSpace && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {(['xMin', 'xMax', 'yMin', 'yMax'] as const).map((k) => (
                  <label
                    key={k}
                    className="flex items-center gap-1 font-prose text-xs text-ink-muted"
                  >
                    {k}
                    <ChampNombre
                      value={coordinateSpace[k]}
                      onChange={(v) =>
                        patchSpec({ coordinateSpace: { ...coordinateSpace, [k]: v } })
                      }
                      onFocus={onFocusBloc}
                      ariaLabel={`Repère — ${k}`}
                    />
                  </label>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Aperçu en direct */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <p className={`${titreSection} mb-1.5`}>Aperçu</p>
          <ApercuFigure
            spec={spec}
            alt={(bloc.alt as string) ?? ''}
            caption={bloc.caption as string | undefined}
          />
        </div>
      </div>
    </div>
  )
}

// Aperçu tolérant : une spec en cours de saisie peut référencer un point pas encore défini, ce qui
// ferait lever buildDrawingModel. On teste d'abord la construction ; en cas d'échec on affiche un
// message plutôt que de laisser planter l'éditeur.
function ApercuFigure({ spec, alt, caption }: { spec: FigureSpec; alt: string; caption?: string }) {
  let erreur: string | null = null
  try {
    buildDrawingModel(spec)
  } catch (e) {
    erreur = e instanceof Error ? e.message : 'Figure incomplète'
  }

  if (erreur) {
    return (
      <div className="rounded-md border border-dashed border-line bg-surface-page p-4 text-center font-prose text-xs text-ink-muted">
        Aperçu indisponible — {erreur}
      </div>
    )
  }

  return (
    <div className="rounded-md border border-line bg-surface-page p-2">
      <FigureRenderer spec={spec} alt={alt} caption={caption} />
    </div>
  )
}

// Petite liste générique pour les primitives « à une ligne » (segments, étiquettes) : un rendu de
// ligne, un ajout, une suppression. Les primitives à structure variable (points, polygones,
// cercles…) gardent leur propre section.
function PrimitiveListe<T>({
  titre,
  items,
  rendu,
  onAjouter,
  onSupprimer,
  labelSuppr,
}: {
  titre: string
  items: T[]
  rendu: (item: T, index: number) => React.ReactNode
  onAjouter: () => void
  onSupprimer: (index: number) => void
  labelSuppr: string
}) {
  return (
    <section>
      <p className={`${titreSection} mb-1.5`}>{titre}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex flex-wrap items-center gap-1.5">
            {rendu(item, i)}
            <Supprimer label={`${labelSuppr} ${i + 1}`} onClick={() => onSupprimer(i)} />
          </li>
        ))}
      </ul>
      <button type="button" className={`mt-1.5 ${boutonAjouter}`} onClick={onAjouter}>
        ＋ {titre.replace(/s$/, '')}
      </button>
    </section>
  )
}
