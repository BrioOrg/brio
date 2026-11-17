'use client'

import { CALCUL_MAX_LINES, CALCUL_MIN_LINES, type CalculSpec } from '@brio/content'

import { CalculRenderer } from '@/components/calcul-renderer'
import { marqueChamp, marqueGroupe, useChamp } from '@/components/prof/problemes-du-bloc'
import { type Bloc, type LigneCalcul } from '@/lib/cours-editeur'
import { katexError } from '@/lib/katex'

// Formulaire du bloc « Calcul » (ADR 0042). L'enseignant écrit chaque ligne entière, signe =
// compris ; le moteur (packages/content) l'aligne sur ce signe. Les règles de check-content sont
// rejouées avant la publication (problemesBloc) ; l'aperçu est le même <CalculRenderer/> que
// l'élève, toutes les lignes visibles.

type Props = {
  bloc: Bloc
  onModifier: (patch: Record<string, unknown>) => void
  onFocusBloc?: () => void
}

const MODES = [
  { valeur: 'equation', label: 'Équation' },
  { valeur: 'egalites', label: 'Égalités' },
] as const

const etiquette = 'font-display text-xs font-bold uppercase tracking-wide text-ink-muted'
const champTexte = `w-full rounded-md border border-line bg-surface-page px-2 py-1 font-prose text-sm text-ink focus:border-accent focus:outline-none ${marqueChamp}`
const champLatex = `${champTexte} font-mono`

export function CalculEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  const { champ, groupe } = useChamp()
  const mode = bloc.mode === 'egalites' ? 'egalites' : 'equation'
  const lignes = (Array.isArray(bloc.lines) ? bloc.lines : []) as LigneCalcul[]
  const maj = (next: LigneCalcul[]) => onModifier({ lines: next })
  const majL = (i: number, patch: Partial<LigneCalcul>) =>
    maj(lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const remplies = lignes.filter((l) => l.latex.trim() !== '' && katexError(l.latex) === null)

  return (
    <div className="rounded-lg border border-line bg-surface-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
          Calcul
        </span>
        <div
          role="group"
          aria-label="Sorte de calcul"
          className="flex rounded-md border border-line bg-surface-page p-0.5"
        >
          {MODES.map((m) => (
            <button
              key={m.valeur}
              type="button"
              onClick={() => onModifier({ mode: m.valeur })}
              aria-pressed={mode === m.valeur}
              className={`rounded-md px-3 py-1 font-display text-xs font-bold ${
                mode === m.valeur ? 'bg-surface-panel text-ink shadow-sm' : 'text-ink-muted'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 font-prose text-xs text-ink-muted">
        {mode === 'equation'
          ? 'Chaque ligne est une équation entière : 3x + 5 = 11.'
          : 'La première ligne est l’expression de départ (ou A = …) ; chaque ligne suivante est l’expression suivante, le = est ajouté tout seul.'}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={etiquette}>Titre (facultatif)</span>
            <input
              className={champTexte}
              value={(bloc.title as string) ?? ''}
              onChange={(e) => onModifier({ title: e.target.value })}
              onFocus={onFocusBloc}
              placeholder="Ex. Résoudre $x + 13 = 41$"
            />
          </label>

          <ol className={`flex flex-col gap-3 ${marqueGroupe}`} {...groupe('lines')}>
            {lignes.map((ligne, i) => {
              const erreur = ligne.latex.trim() ? katexError(ligne.latex) : null
              return (
                <li key={i} className="flex flex-col gap-1 border-l-2 border-line pl-3">
                  <div className="flex items-center gap-2">
                    <input
                      className={champLatex}
                      aria-label={`Ligne ${i + 1}`}
                      value={ligne.latex}
                      onChange={(e) => majL(i, { latex: e.target.value })}
                      onFocus={onFocusBloc}
                      placeholder={i === 0 || mode === 'equation' ? '3x + 5 = 11' : '6x + 2'}
                      {...champ(`lines[${i}].latex`)}
                    />
                    <button
                      type="button"
                      aria-label={`Supprimer la ligne ${i + 1}`}
                      onClick={() => maj(lignes.filter((_, j) => j !== i))}
                      disabled={lignes.length <= CALCUL_MIN_LINES}
                      className="shrink-0 text-ink-muted hover:text-danger disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                  {erreur && <p className="font-prose text-xs text-danger">{erreur}</p>}
                  <div className="flex flex-wrap gap-2">
                    {mode === 'equation' && i > 0 && (
                      <input
                        className={`${champLatex} w-28 flex-none`}
                        aria-label={`Opération sur les deux membres, ligne ${i + 1}`}
                        value={ligne.op ?? ''}
                        onChange={(e) => majL(i, { op: e.target.value })}
                        onFocus={onFocusBloc}
                        placeholder="-5"
                        {...champ(`lines[${i}].op`)}
                      />
                    )}
                    <input
                      className={`${champLatex} w-32 flex-none`}
                      aria-label={`Partie mise en évidence, ligne ${i + 1}`}
                      value={ligne.focus ?? ''}
                      onChange={(e) => majL(i, { focus: e.target.value })}
                      onFocus={onFocusBloc}
                      placeholder="En évidence"
                      {...champ(`lines[${i}].focus`)}
                    />
                    <input
                      className={`${champTexte} min-w-40 flex-1`}
                      aria-label={`Note, ligne ${i + 1}`}
                      value={ligne.note ?? ''}
                      onChange={(e) => majL(i, { note: e.target.value })}
                      onFocus={onFocusBloc}
                      placeholder="on développe"
                      {...champ(`lines[${i}].note`)}
                    />
                  </div>
                </li>
              )
            })}
          </ol>
          <button
            type="button"
            onClick={() => maj([...lignes, { latex: '' }])}
            disabled={lignes.length >= CALCUL_MAX_LINES}
            className="self-start font-display text-sm font-bold text-accent-ink hover:underline disabled:opacity-30"
          >
            ＋ Ajouter une ligne
          </button>

          <label className="flex flex-col gap-1">
            <span className={etiquette}>Conclusion (facultative)</span>
            <input
              className={champTexte}
              value={(bloc.conclusion as string) ?? ''}
              onChange={(e) => onModifier({ conclusion: e.target.value })}
              onFocus={onFocusBloc}
              placeholder="Ex. La solution de l’équation est $28$."
            />
          </label>
        </div>

        <div className="min-w-0">
          <span className={etiquette}>Aperçu</span>
          <div className="mt-2">
            {remplies.length > 0 ? (
              <CalculRenderer
                id={`apercu-${bloc.id}`}
                spec={{ ...(bloc as unknown as CalculSpec), mode, lines: remplies }}
              />
            ) : (
              <p className="font-prose text-sm text-ink-muted">
                L’aperçu apparaît dès la première ligne écrite.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
