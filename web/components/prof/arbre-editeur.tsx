'use client'

import { TREE_MAX_CHILDREN, TREE_MAX_DEPTH } from '@brio/content'

import { TreeRenderer } from '@/components/tree-renderer'
import { marqueChamp, useChamp } from '@/components/prof/problemes-du-bloc'
import {
  arbrePourApercu,
  branchesArbre,
  cheminsArbre,
  type Bloc,
  type NoeudArbre,
} from '@/lib/cours-editeur'

// Formulaire du bloc « Arbre » (ADR 0040). L'enseignant nomme les branches niveau par niveau et,
// s'il le veut, leur donne une probabilité ; le moteur (packages/content) place tout. Les règles
// de check-content (somme des branches sœurs égale à 1…) sont rejouées avant la publication.

type Props = {
  bloc: Bloc
  onModifier: (patch: Record<string, unknown>) => void
  onFocusBloc?: () => void
}

const etiquette = 'font-display text-xs font-bold uppercase tracking-wide text-ink-muted'
const champTexte = `w-full rounded-md border border-line bg-surface-page px-2 py-1 font-prose text-sm text-ink focus:border-accent focus:outline-none ${marqueChamp}`
const lien =
  'font-display text-xs font-bold text-accent-ink hover:underline disabled:opacity-30 disabled:hover:no-underline'

/** Remplace la liste de branches au bout de `indices` (vide : celles de la racine). */
function remplacer(
  noeuds: NoeudArbre[],
  indices: number[],
  maj: (enfants: NoeudArbre[]) => NoeudArbre[]
): NoeudArbre[] {
  if (indices.length === 0) return maj(noeuds)
  const [i, ...reste] = indices
  return noeuds.map((n, j) =>
    j === i ? { ...n, children: remplacer(n.children ?? [], reste, maj) } : n
  )
}

export function ArbreEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  const { champ } = useChamp()
  const branches = branchesArbre(bloc)
  const apercu = arbrePourApercu(bloc)
  const chemins = cheminsArbre(bloc).filter((c) => c.every((l) => l.trim() !== ''))
  const surligne = Array.isArray(bloc.highlightPath)
    ? (bloc.highlightPath as string[]).join(' › ')
    : ''

  const majBranches = (indices: number[], maj: (enfants: NoeudArbre[]) => NoeudArbre[]) =>
    onModifier({ root: { children: remplacer(branches, indices, maj) } })

  // Une fonction, pas un composant : un composant défini ici serait remonté à chaque frappe et
  // le champ perdrait le focus.
  const rendreNoeuds = (noeuds: NoeudArbre[], indices: number[]) => (
    <ul className={indices.length > 0 ? 'ml-4 border-l border-line pl-3' : ''}>
      {noeuds.map((n, i) => {
        const ici = [...indices, i]
        const chemin = 'root' + ici.map((k) => `.children[${k}]`).join('')
        const rang = ici.map((k) => k + 1).join('.')
        const profondeur = ici.length
        return (
          <li key={i} className="py-1">
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label={`Nom de la branche ${rang}`}
                className={`${champTexte} w-24`}
                value={n.label ?? ''}
                onChange={(e) =>
                  majBranches(indices, (l) =>
                    l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))
                  )
                }
                onFocus={onFocusBloc}
                placeholder="Ex. R"
                {...champ(`${chemin}.label`)}
              />
              <input
                aria-label={`Probabilité de la branche ${rang}`}
                className={`${champTexte} w-24`}
                value={n.probability ?? ''}
                onChange={(e) =>
                  majBranches(indices, (l) =>
                    l.map((x, j) => (j === i ? { ...x, probability: e.target.value } : x))
                  )
                }
                onFocus={onFocusBloc}
                placeholder="Ex. 3/5"
                {...champ(`${chemin}.probability`)}
              />
              {profondeur < TREE_MAX_DEPTH && (
                <button
                  type="button"
                  className={lien}
                  disabled={(n.children?.length ?? 0) >= TREE_MAX_CHILDREN}
                  onClick={() => majBranches(ici, (l) => [...l, { label: '' }])}
                >
                  ＋ Sous-branche
                </button>
              )}
              <button
                type="button"
                aria-label={`Supprimer la branche ${rang}`}
                onClick={() => majBranches(indices, (l) => l.filter((_, j) => j !== i))}
                disabled={indices.length === 0 && noeuds.length <= 1}
                className="text-ink-muted hover:text-danger disabled:opacity-30"
              >
                ✕
              </button>
            </div>
            {n.children && n.children.length > 0 && rendreNoeuds(n.children, ici)}
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="rounded-lg border border-line bg-surface-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
          Arbre
        </span>
        <div
          role="group"
          aria-label="Orientation"
          className="flex rounded-md border border-line bg-surface-page p-0.5"
        >
          {(
            [
              ['horizontal', 'Horizontal'],
              ['vertical', 'Vertical'],
            ] as const
          ).map(([valeur, label]) => {
            const actif = (bloc.orientation === 'vertical' ? 'vertical' : 'horizontal') === valeur
            return (
              <button
                key={valeur}
                type="button"
                onClick={() => onModifier({ orientation: valeur })}
                aria-pressed={actif}
                className={`rounded-md px-3 py-1 font-display text-xs font-bold ${
                  actif ? 'bg-surface-panel text-ink shadow-sm' : 'text-ink-muted'
                }`}
              >
                {label}
              </button>
            )
          })}
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
              placeholder="Ex. Deux tirages sans remise dans une urne"
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
            />
          </label>

          <div>
            <p className={`${etiquette} mb-1`}>Branches (nom, probabilité facultative)</p>
            {rendreNoeuds(branches, [])}
            <button
              type="button"
              className={`${lien} mt-1`}
              disabled={branches.length >= TREE_MAX_CHILDREN}
              onClick={() => majBranches([], (l) => [...l, { label: '' }])}
            >
              ＋ Branche depuis la racine
            </button>
            <p className="mt-1 font-prose text-xs text-ink-muted">
              Probabilités : 3/5, 0,4, 25 %, ? pour une case à compléter, ou une formule entre $. Au
              plus {TREE_MAX_DEPTH} niveaux.
            </p>
          </div>

          <label className="flex items-start gap-1.5 font-prose text-sm text-ink">
            <input
              type="checkbox"
              checked={bloc.outcomes === true}
              onChange={(e) => onModifier({ outcomes: e.target.checked })}
              className="mt-1 accent-accent"
            />
            <span>Écrire les issues au bout des branches</span>
          </label>
          <label className="flex items-start gap-1.5 font-prose text-sm text-ink">
            <input
              type="checkbox"
              checked={bloc.products === true}
              onChange={(e) => onModifier({ products: e.target.checked })}
              className="mt-1 accent-accent"
            />
            <span>
              Écrire la probabilité de chaque issue
              <span className="block text-xs text-ink-muted">
                À éviter pour un exercice : elle donnerait la réponse.
              </span>
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className={etiquette}>Chemin mis en évidence (facultatif)</span>
            <select
              className={champTexte}
              value={surligne}
              onChange={(e) =>
                onModifier({
                  highlightPath: e.target.value === '' ? undefined : e.target.value.split(' › '),
                })
              }
              onFocus={onFocusBloc}
              {...champ('highlightPath')}
            >
              <option value="">Aucun</option>
              {chemins.map((c) => (
                <option key={c.join(' › ')} value={c.join(' › ')}>
                  {c.join(' puis ')}
                </option>
              ))}
            </select>
          </label>

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
              <TreeRenderer
                spec={apercu}
                alt={(bloc.alt as string) || 'Aperçu de l’arbre'}
                title={(bloc.title as string) || undefined}
                caption={(bloc.caption as string) || undefined}
              />
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-line bg-surface-page p-4 text-center font-prose text-xs text-ink-muted">
              Nomme au moins une branche pour voir l’arbre.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
