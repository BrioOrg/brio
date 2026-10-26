'use client'

import { maxCategories, CHART_MIN_CATEGORIES } from '@brio/content'

import { ChartRenderer } from '@/components/chart-renderer'
import { marqueChamp, marqueGroupe, useChamp } from '@/components/prof/problemes-du-bloc'
import {
  donneesGraphique,
  GRAPHIQUE_SORTES,
  graphiquePourApercu,
  type Bloc,
  type Donnee,
} from '@/lib/cours-editeur'

// Formulaire du bloc « Diagramme » (ADR 0030, #229). L'enseignant donne des catégories et des
// valeurs ; le moteur (packages/content) calcule barres, secteurs et graduations. Les règles de
// check-content sont rejouées avant la publication (problemesBloc) ; l'aperçu en direct est le
// même <ChartRenderer/> que l'élève, dessiné avec les seules lignes complètes.

type Props = {
  bloc: Bloc
  onModifier: (patch: Record<string, unknown>) => void
  onFocusBloc?: () => void
}

const etiquette = 'font-display text-xs font-bold uppercase tracking-wide text-ink-muted'
const champTexte = `w-full rounded-md border border-line bg-surface-page px-2 py-1 font-prose text-sm text-ink focus:border-accent focus:outline-none ${marqueChamp}`

/** Le nombre saisi, ou undefined pour un champ vide (une valeur absente n'est pas zéro). */
function nombre(saisie: string): number | undefined {
  if (saisie.trim() === '') return undefined
  const n = Number(saisie)
  return Number.isFinite(n) ? n : undefined
}

function texteNombre(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
}

export function GraphiqueEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  const { champ, groupe } = useChamp()
  const kind = bloc.kind === 'pie' || bloc.kind === 'line' ? bloc.kind : 'bar'
  const avecAxes = kind !== 'pie'
  const serie = (Array.isArray(bloc.series) ? bloc.series[0] : undefined) as
    { label?: string } | undefined
  const donnees = donneesGraphique(bloc)
  const max = maxCategories(kind)
  const apercu = graphiquePourApercu(bloc)

  const majSerie = (patch: { label?: string; data?: Donnee[] }) =>
    onModifier({
      series: [{ label: serie?.label ?? '', data: donnees, ...patch }],
    })
  const majDonnee = (i: number, patch: Partial<Donnee>) =>
    majSerie({ data: donnees.map((d, j) => (j === i ? { ...d, ...patch } : d)) })

  return (
    <div className="rounded-lg border border-line bg-surface-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
          Diagramme
        </span>
        <div
          role="group"
          aria-label="Sorte de diagramme"
          className="flex rounded-md border border-line bg-surface-page p-0.5"
        >
          {GRAPHIQUE_SORTES.map((s) => (
            <button
              key={s.valeur}
              type="button"
              onClick={() => onModifier({ kind: s.valeur })}
              aria-pressed={kind === s.valeur}
              className={`rounded-md px-3 py-1 font-display text-xs font-bold ${
                kind === s.valeur ? 'bg-surface-panel text-ink shadow-sm' : 'text-ink-muted'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={etiquette}>
              Texte alternatif <span className="text-danger">*</span>
            </span>
            <input
              className={champTexte}
              value={(bloc.alt as string) ?? ''}
              onChange={(e) => onModifier({ alt: e.target.value })}
              onFocus={onFocusBloc}
              placeholder="Ex. Diagramme en barres : Football 8, Basket 5"
              {...champ('alt')}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={etiquette}>Titre (facultatif)</span>
            <input
              className={champTexte}
              value={(bloc.title as string) ?? ''}
              onChange={(e) => onModifier({ title: e.target.value })}
              onFocus={onFocusBloc}
              placeholder="Ex. Sport préféré des élèves de 5e B"
            />
          </label>

          {avecAxes && (
            <div className="flex flex-wrap gap-2">
              <label className="flex min-w-32 flex-1 flex-col gap-1">
                <span className={etiquette}>Axe horizontal (facultatif)</span>
                <input
                  className={champTexte}
                  value={(bloc.xLabel as string) ?? ''}
                  onChange={(e) => onModifier({ xLabel: e.target.value })}
                  onFocus={onFocusBloc}
                  placeholder="Ex. Sport"
                />
              </label>
              <label className="flex min-w-32 flex-1 flex-col gap-1">
                <span className={etiquette}>Axe vertical (facultatif)</span>
                <input
                  className={champTexte}
                  value={(bloc.yLabel as string) ?? ''}
                  onChange={(e) => onModifier({ yLabel: e.target.value })}
                  onFocus={onFocusBloc}
                  placeholder="Ex. Effectif"
                />
              </label>
            </div>
          )}

          <div className={marqueGroupe} {...groupe('series[0].data')}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={`${etiquette} border border-line p-1 text-left`}>
                    Catégorie
                  </th>
                  <th scope="col" className="border border-line p-1">
                    <input
                      aria-label="Ce que mesurent les valeurs"
                      className={`${champTexte} font-display font-bold`}
                      value={serie?.label ?? ''}
                      onChange={(e) => majSerie({ label: e.target.value })}
                      onFocus={onFocusBloc}
                      placeholder="Ex. Effectif"
                      {...champ('series[0].label')}
                    />
                  </th>
                  <th className="w-8" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {donnees.map((d, i) => (
                  <tr key={i}>
                    <td className="border border-line p-1">
                      <input
                        aria-label={`Catégorie ${i + 1}`}
                        className={champTexte}
                        value={d.label ?? ''}
                        onChange={(e) => majDonnee(i, { label: e.target.value })}
                        onFocus={onFocusBloc}
                        placeholder={`Catégorie ${i + 1}`}
                        {...champ(`series[0].data[${i}].label`)}
                      />
                    </td>
                    <td className="border border-line p-1">
                      <input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        aria-label={`Valeur ${i + 1}`}
                        className={champTexte}
                        value={texteNombre(d.value)}
                        onChange={(e) => majDonnee(i, { value: nombre(e.target.value) })}
                        onFocus={onFocusBloc}
                        placeholder="0"
                        {...champ(`series[0].data[${i}].value`)}
                      />
                    </td>
                    <td className="w-8 text-center align-middle">
                      <button
                        type="button"
                        aria-label={`Supprimer la catégorie ${i + 1}`}
                        onClick={() => majSerie({ data: donnees.filter((_, j) => j !== i) })}
                        disabled={donnees.length <= CHART_MIN_CATEGORIES}
                        className="text-ink-muted hover:text-danger disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => majSerie({ data: [...donnees, { label: '' }] })}
              disabled={donnees.length >= max}
              className="font-display text-sm font-bold text-accent-ink hover:underline disabled:opacity-30 disabled:hover:no-underline"
            >
              ＋ Ajouter une catégorie
            </button>
            <span className="font-prose text-xs text-ink-muted">
              {CHART_MIN_CATEGORIES} à {max} catégories
            </span>
          </div>

          {avecAxes && (
            <>
              <div className="flex flex-wrap gap-2">
                <label className="flex min-w-32 flex-1 flex-col gap-1">
                  <span className={etiquette}>Haut de l’axe (facultatif)</span>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    className={champTexte}
                    value={texteNombre(bloc.yMax)}
                    onChange={(e) => onModifier({ yMax: nombre(e.target.value) })}
                    onFocus={onFocusBloc}
                    placeholder="Automatique"
                    {...champ('yMax')}
                  />
                </label>
                <label className="flex min-w-32 flex-1 flex-col gap-1">
                  <span className={etiquette}>Pas des graduations (facultatif)</span>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    inputMode="decimal"
                    className={champTexte}
                    value={texteNombre(bloc.yStep)}
                    onChange={(e) => onModifier({ yStep: nombre(e.target.value) })}
                    onFocus={onFocusBloc}
                    placeholder="Automatique"
                    {...champ('yStep')}
                  />
                </label>
              </div>
              <label className="flex items-start gap-1.5 font-prose text-sm text-ink">
                <input
                  type="checkbox"
                  checked={bloc.showValues === true}
                  onChange={(e) => onModifier({ showValues: e.target.checked })}
                  className="mt-1 accent-accent"
                />
                <span>
                  Écrire les valeurs sur le diagramme
                  <span className="block text-xs text-ink-muted">
                    À éviter pour un exercice de lecture : elles donneraient les réponses.
                  </span>
                </span>
              </label>
            </>
          )}

          <label className="flex flex-col gap-1">
            <span className={etiquette}>Légende (facultatif)</span>
            <input
              className={champTexte}
              value={(bloc.caption as string) ?? ''}
              onChange={(e) => onModifier({ caption: e.target.value || undefined })}
              onFocus={onFocusBloc}
            />
          </label>
        </div>

        <div className="min-w-0">
          <p className={`${etiquette} mb-1.5`}>Aperçu</p>
          {apercu ? (
            <div className="rounded-md border border-line bg-surface-page p-2">
              <ChartRenderer
                spec={apercu}
                alt={(bloc.alt as string) || 'Aperçu du diagramme'}
                title={(bloc.title as string) || undefined}
                caption={(bloc.caption as string) || undefined}
              />
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-line bg-surface-page p-4 text-center font-prose text-xs text-ink-muted">
              Nomme et chiffre au moins deux catégories pour voir le diagramme.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
