'use client'

import type {
  FigureLine,
  FigureRay,
  FigureSpec,
  FigureTransformation,
  FigureVector,
  TransformationKind,
} from '@brio/content'

// Droites, demi-droites, vecteurs et transformations d'une figure (ADR 0041). Les points sont
// désignés par leur nom ; les images (A′, B′…) sont calculées et peuvent être nommées ailleurs.
// Les règles (points définis, transformation non triviale, axe tracé…) sont vérifiées avant la
// publication par cours-editeur.ts, avec celles de check-content.

const champ =
  'rounded-md border border-line bg-surface-page px-2 py-1 font-prose text-sm text-ink focus:border-accent focus:outline-none'
const selectClass = `${champ} font-display font-bold`
const titreSection = 'font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted'
const boutonAjouter = 'font-display text-sm font-bold text-accent-ink hover:underline'
const boutonSupprimer = 'font-display text-xs font-bold text-ink-muted hover:text-danger'

const SORTES: { kind: TransformationKind; nom: string }[] = [
  { kind: 'symetrie-axiale', nom: 'Symétrie axiale' },
  { kind: 'symetrie-centrale', nom: 'Symétrie centrale' },
  { kind: 'translation', nom: 'Translation' },
  { kind: 'rotation', nom: 'Rotation' },
  { kind: 'homothetie', nom: 'Homothétie' },
]

type Props = {
  spec: FigureSpec
  patchSpec: (patch: Partial<FigureSpec>) => void
  onFocusBloc?: () => void
}

/** Une transformation de cette sorte, qui garde la source et les tracés de `depuis`. */
function transformationParDefaut(
  kind: TransformationKind,
  depuis?: FigureTransformation
): FigureTransformation {
  const commun = { source: depuis?.source ?? [], show: depuis?.show }
  switch (kind) {
    case 'symetrie-axiale':
      return { kind, axis: ['', ''], ...commun }
    case 'symetrie-centrale':
      return { kind, center: 'O', ...commun }
    case 'translation':
      return { kind, from: '', to: '', ...commun }
    case 'rotation':
      return { kind, center: 'O', angle: 90, ...commun }
    case 'homothetie':
      return { kind, center: 'O', ratio: 2, ...commun }
  }
}

function noms(texte: string): string[] {
  return texte
    .split(/[\s,;]+/)
    .map((n) => n.trim())
    .filter((n) => n !== '')
}

function ChampPoint({
  value,
  onChange,
  onFocus,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  onFocus?: () => void
  ariaLabel: string
}) {
  return (
    <input
      className={`${champ} w-14`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      aria-label={ariaLabel}
      placeholder="A"
    />
  )
}

function ChampDecimal({
  value,
  onChange,
  ariaLabel,
}: {
  value: number
  onChange: (v: number) => void
  ariaLabel: string
}) {
  return (
    <input
      type="number"
      step="any"
      className={`${champ} w-20`}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
      aria-label={ariaLabel}
    />
  )
}

export function TransformationsEditeur({ spec, patchSpec, onFocusBloc }: Props) {
  const lines = spec.lines ?? []
  const rays = spec.rays ?? []
  const vectors = spec.vectors ?? []
  const transformations = spec.transformations ?? []

  const majLigne = (i: number, patch: Partial<FigureLine>) =>
    patchSpec({ lines: lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) })
  const majDemi = (i: number, patch: Partial<FigureRay>) =>
    patchSpec({ rays: rays.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const majVecteur = (i: number, patch: Partial<FigureVector>) =>
    patchSpec({ vectors: vectors.map((v, j) => (j === i ? { ...v, ...patch } : v)) })
  const majTransformation = (i: number, t: FigureTransformation) =>
    patchSpec({ transformations: transformations.map((x, j) => (j === i ? t : x)) })

  return (
    <>
      <section>
        <p className={`${titreSection} mb-1.5`}>Droites</p>
        <ul className="flex flex-col gap-1.5">
          {lines.map((l, i) => (
            <li key={i} className="flex flex-wrap items-center gap-1.5">
              <span className="text-ink-muted">(</span>
              <ChampPoint
                value={l.through[0]}
                onChange={(n) => majLigne(i, { through: [n, l.through[1]] })}
                onFocus={onFocusBloc}
                ariaLabel={`Premier point de la droite ${i + 1}`}
              />
              <ChampPoint
                value={l.through[1]}
                onChange={(n) => majLigne(i, { through: [l.through[0], n] })}
                onFocus={onFocusBloc}
                ariaLabel={`Second point de la droite ${i + 1}`}
              />
              <span className="text-ink-muted">)</span>
              <input
                className={`${champ} w-16`}
                value={l.label ?? ''}
                onChange={(e) => majLigne(i, { label: e.target.value || undefined })}
                aria-label={`Nom de la droite ${i + 1}`}
                placeholder="(d)"
              />
              <button
                type="button"
                className={boutonSupprimer}
                onClick={() => patchSpec({ lines: lines.filter((_, j) => j !== i) })}
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`mt-1.5 ${boutonAjouter}`}
          onClick={() => patchSpec({ lines: [...lines, { through: ['', ''] }] })}
        >
          ＋ Droite
        </button>
      </section>

      <section>
        <p className={`${titreSection} mb-1.5`}>Demi-droites</p>
        <ul className="flex flex-col gap-1.5">
          {rays.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-1.5">
              <span className="text-ink-muted">[</span>
              <ChampPoint
                value={r.from}
                onChange={(from) => majDemi(i, { from })}
                onFocus={onFocusBloc}
                ariaLabel={`Origine de la demi-droite ${i + 1}`}
              />
              <ChampPoint
                value={r.through}
                onChange={(through) => majDemi(i, { through })}
                onFocus={onFocusBloc}
                ariaLabel={`Point de la demi-droite ${i + 1}`}
              />
              <span className="text-ink-muted">)</span>
              <button
                type="button"
                className={boutonSupprimer}
                onClick={() => patchSpec({ rays: rays.filter((_, j) => j !== i) })}
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`mt-1.5 ${boutonAjouter}`}
          onClick={() => patchSpec({ rays: [...rays, { from: '', through: '' }] })}
        >
          ＋ Demi-droite
        </button>
      </section>

      <section>
        <p className={`${titreSection} mb-1.5`}>Vecteurs</p>
        <ul className="flex flex-col gap-1.5">
          {vectors.map((v, i) => (
            <li key={i} className="flex flex-wrap items-center gap-1.5">
              <ChampPoint
                value={v.from}
                onChange={(from) => majVecteur(i, { from })}
                onFocus={onFocusBloc}
                ariaLabel={`Origine du vecteur ${i + 1}`}
              />
              <span className="text-ink-muted">→</span>
              <ChampPoint
                value={v.to}
                onChange={(to) => majVecteur(i, { to })}
                onFocus={onFocusBloc}
                ariaLabel={`Extrémité du vecteur ${i + 1}`}
              />
              <input
                className={`${champ} w-28`}
                value={v.label ?? ''}
                onChange={(e) => majVecteur(i, { label: e.target.value || undefined })}
                aria-label={`Nom du vecteur ${i + 1} (LaTeX)`}
                placeholder="\vec{u}"
              />
              <button
                type="button"
                className={boutonSupprimer}
                onClick={() => patchSpec({ vectors: vectors.filter((_, j) => j !== i) })}
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`mt-1.5 ${boutonAjouter}`}
          onClick={() => patchSpec({ vectors: [...vectors, { from: '', to: '' }] })}
        >
          ＋ Vecteur
        </button>
      </section>

      <section>
        <p className={`${titreSection} mb-1.5`}>Transformations</p>
        <ul className="flex flex-col gap-2">
          {transformations.map((t, i) => (
            <li key={i} className="flex flex-col gap-1.5 border-l-2 border-line pl-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  className={`${selectClass} w-44`}
                  value={t.kind}
                  aria-label={`Sorte de la transformation ${i + 1}`}
                  onChange={(e) =>
                    majTransformation(
                      i,
                      transformationParDefaut(e.target.value as TransformationKind, t)
                    )
                  }
                >
                  {SORTES.map((s) => (
                    <option key={s.kind} value={s.kind}>
                      {s.nom}
                    </option>
                  ))}
                </select>
                <ParametresTransformation
                  t={t}
                  rang={i + 1}
                  onChange={(nt) => majTransformation(i, nt)}
                  onFocus={onFocusBloc}
                />
                <button
                  type="button"
                  className={boutonSupprimer}
                  onClick={() =>
                    patchSpec({ transformations: transformations.filter((_, j) => j !== i) })
                  }
                >
                  Supprimer
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <label className="flex items-center gap-1 font-prose text-xs text-ink-muted">
                  Points transformés
                  <input
                    className={`${champ} w-32`}
                    defaultValue={t.source.join(', ')}
                    onBlur={(e) => majTransformation(i, { ...t, source: noms(e.target.value) })}
                    onFocus={onFocusBloc}
                    aria-label={`Points transformés par la transformation ${i + 1}`}
                    placeholder="A, B, C"
                  />
                </label>
                <label className="flex items-center gap-1 font-prose text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    checked={t.show?.construction === true}
                    onChange={(e) =>
                      majTransformation(i, {
                        ...t,
                        show: e.target.checked ? { construction: true } : undefined,
                      })
                    }
                  />
                  Tracés de construction
                </label>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`mt-1.5 ${boutonAjouter}`}
          onClick={() =>
            patchSpec({
              transformations: [...transformations, transformationParDefaut('symetrie-centrale')],
            })
          }
        >
          ＋ Transformation
        </button>
      </section>
    </>
  )
}

function ParametresTransformation({
  t,
  rang,
  onChange,
  onFocus,
}: {
  t: FigureTransformation
  rang: number
  onChange: (t: FigureTransformation) => void
  onFocus?: () => void
}) {
  switch (t.kind) {
    case 'symetrie-axiale':
      return (
        <>
          <span className="font-prose text-xs text-ink-muted">axe (</span>
          <ChampPoint
            value={t.axis[0]}
            onChange={(n) => onChange({ ...t, axis: [n, t.axis[1]] })}
            onFocus={onFocus}
            ariaLabel={`Premier point de l’axe ${rang}`}
          />
          <ChampPoint
            value={t.axis[1]}
            onChange={(n) => onChange({ ...t, axis: [t.axis[0], n] })}
            onFocus={onFocus}
            ariaLabel={`Second point de l’axe ${rang}`}
          />
          <span className="font-prose text-xs text-ink-muted">)</span>
        </>
      )
    case 'translation':
      return (
        <>
          <span className="font-prose text-xs text-ink-muted">de</span>
          <ChampPoint
            value={t.from}
            onChange={(from) => onChange({ ...t, from })}
            onFocus={onFocus}
            ariaLabel={`Origine du vecteur de la translation ${rang}`}
          />
          <span className="font-prose text-xs text-ink-muted">vers</span>
          <ChampPoint
            value={t.to}
            onChange={(to) => onChange({ ...t, to })}
            onFocus={onFocus}
            ariaLabel={`Extrémité du vecteur de la translation ${rang}`}
          />
        </>
      )
    case 'symetrie-centrale':
    case 'rotation':
    case 'homothetie':
      return (
        <>
          <span className="font-prose text-xs text-ink-muted">centre</span>
          <ChampPoint
            value={t.center}
            onChange={(center) => onChange({ ...t, center })}
            onFocus={onFocus}
            ariaLabel={`Centre de la transformation ${rang}`}
          />
          {t.kind === 'rotation' && (
            <>
              <span className="font-prose text-xs text-ink-muted">angle (°)</span>
              <ChampDecimal
                value={t.angle}
                onChange={(angle) => onChange({ ...t, angle })}
                ariaLabel={`Angle de la rotation ${rang}, en degrés`}
              />
            </>
          )}
          {t.kind === 'homothetie' && (
            <>
              <span className="font-prose text-xs text-ink-muted">rapport</span>
              <ChampDecimal
                value={t.ratio}
                onChange={(ratio) => onChange({ ...t, ratio })}
                ariaLabel={`Rapport de l’homothétie ${rang}`}
              />
            </>
          )}
        </>
      )
  }
}
