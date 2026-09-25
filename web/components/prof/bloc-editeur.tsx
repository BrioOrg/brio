'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import { ChampFormule } from '@/components/maths/champ-formule'
import { FigureEditeur } from '@/components/prof/figure-editeur'
import { CALLOUT_VARIANTES, genId, type Bloc, type Choix, type Etape } from '@/lib/cours-editeur'

// Édition « dans la page » (piste A) : chaque bloc s'écrit là où il s'affichera, sans fiche ni
// étiquette. On tape comme dans un document ; les zones grandissent avec le texte.

type Props = {
  bloc: Bloc
  onModifier: (patch: Record<string, unknown>) => void
  onFocusBloc?: () => void
}

/** Zone de texte qui grandit toute seule avec son contenu. */
function ZoneAuto({
  value,
  onChange,
  onFocus,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  onFocus?: () => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      placeholder={placeholder}
      className={`w-full resize-none overflow-hidden border-0 bg-transparent p-0 focus:outline-none focus:ring-0 placeholder:text-ink-muted/60 ${className ?? ''}`}
    />
  )
}

const inline =
  'w-full border-0 bg-transparent p-0 focus:outline-none focus:ring-0 placeholder:text-ink-muted/60'

export function BlocEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  switch (bloc.type) {
    case 'heading': {
      const level = (bloc.level as number) ?? 1
      const taille = level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-lg'
      return (
        <div className="flex items-center gap-3">
          <input
            className={`${inline} font-display font-extrabold tracking-tight text-ink ${taille}`}
            value={(bloc.text as string) ?? ''}
            onChange={(e) => onModifier({ text: e.target.value })}
            onFocus={onFocusBloc}
            placeholder="Titre de section"
          />
          <select
            aria-label="Niveau de titre"
            className="shrink-0 rounded-md border border-line bg-surface-panel px-2 py-1 font-display text-xs font-bold text-ink-muted focus:outline-none"
            value={level}
            onChange={(e) => onModifier({ level: Number(e.target.value) })}
          >
            <option value={1}>H1</option>
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
        </div>
      )
    }

    case 'prose':
      return (
        <ZoneAuto
          value={(bloc.text as string) ?? ''}
          onChange={(v) => onModifier({ text: v })}
          onFocus={onFocusBloc}
          placeholder="Écris ton paragraphe… (**gras**, *italique*, $formule$)"
          className="font-prose text-lg leading-relaxed text-ink"
        />
      )

    case 'formula':
      return (
        <div className="rounded-lg border border-line bg-surface-panel px-4 py-3">
          <ChampFormule
            value={(bloc.latex as string) ?? ''}
            onChange={(v) => onModifier({ latex: v })}
            onFocus={onFocusBloc}
            placeholder="a^2 + b^2 = c^2"
            inputClassName={`${inline} text-center font-mono text-xl text-ink`}
            ariaLabel="Formule du bloc"
          />
        </div>
      )

    case 'callout': {
      const variant = (bloc.variant as string) ?? 'definition'
      return (
        <div className="rounded-lg border border-accent bg-accent-soft p-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <input
              className={`${inline} font-display text-xs font-extrabold uppercase tracking-widest text-accent-ink`}
              value={(bloc.title as string) ?? ''}
              onChange={(e) => onModifier({ title: e.target.value })}
              onFocus={onFocusBloc}
              placeholder={CALLOUT_VARIANTES.find((v) => v.valeur === variant)?.label ?? 'Encadré'}
            />
            <select
              aria-label="Type d’encadré"
              className="shrink-0 rounded-md border border-accent/40 bg-surface-panel px-2 py-1 font-display text-xs font-bold text-accent-ink focus:outline-none"
              value={variant}
              onChange={(e) => onModifier({ variant: e.target.value })}
            >
              {CALLOUT_VARIANTES.map((v) => (
                <option key={v.valeur} value={v.valeur}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <ZoneAuto
            value={(bloc.text as string) ?? ''}
            onChange={(v) => onModifier({ text: v })}
            onFocus={onFocusBloc}
            placeholder="Le texte de l’encadré…"
            className="font-prose text-base leading-relaxed text-ink"
          />
        </div>
      )
    }

    case 'objectives': {
      const items = (Array.isArray(bloc.items) ? bloc.items : []) as string[]
      const maj = (next: string[]) => onModifier({ items: next })
      return (
        <div className="rounded-lg border border-accent bg-accent-soft p-4">
          <input
            className={`${inline} mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-accent-ink`}
            value={(bloc.title as string) ?? ''}
            onChange={(e) => onModifier({ title: e.target.value })}
            onFocus={onFocusBloc}
            placeholder="Ce que tu vas savoir faire"
          />
          <ul className="flex flex-col gap-1.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <span
                  className="font-display text-sm font-extrabold text-accent-ink"
                  aria-hidden="true"
                >
                  ✓
                </span>
                <input
                  className={`${inline} font-prose text-base text-ink`}
                  value={item}
                  onChange={(e) => maj(items.map((it, j) => (j === i ? e.target.value : it)))}
                  onFocus={onFocusBloc}
                  placeholder="Ex. Calculer une longueur avec Pythagore"
                />
                <button
                  type="button"
                  aria-label="Supprimer l’objectif"
                  onClick={() => maj(items.filter((_, j) => j !== i))}
                  disabled={items.length <= 1}
                  className="shrink-0 text-ink-muted hover:text-danger disabled:opacity-30"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => maj([...items, ''])}
            className="mt-2 font-display text-sm font-bold text-accent-ink hover:underline"
          >
            ＋ Ajouter un objectif
          </button>
        </div>
      )
    }

    case 'steps': {
      const etapes = (Array.isArray(bloc.steps) ? bloc.steps : []) as Etape[]
      const maj = (next: Etape[]) => onModifier({ steps: next })
      const majE = (i: number, patch: Partial<Etape>) =>
        maj(etapes.map((e, j) => (j === i ? { ...e, ...patch } : e)))
      return (
        <div className="rounded-lg border border-line bg-surface-panel p-4">
          <input
            className={`${inline} mb-3 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted`}
            value={(bloc.title as string) ?? ''}
            onChange={(e) => onModifier({ title: e.target.value })}
            onFocus={onFocusBloc}
            placeholder="Exemple résolu"
          />
          <ol className="flex flex-col gap-2.5">
            {etapes.map((etape, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-xs font-extrabold text-accent-ink">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <ZoneAuto
                    value={etape.text}
                    onChange={(v) => majE(i, { text: v })}
                    onFocus={onFocusBloc}
                    placeholder="Ce qu’on fait à cette étape…"
                    className="font-prose text-base leading-relaxed text-ink"
                  />
                  <div className="mt-1">
                    <ChampFormule
                      value={etape.formula ?? ''}
                      onChange={(v) => majE(i, { formula: v || undefined })}
                      onFocus={onFocusBloc}
                      placeholder="Formule de l’étape (facultatif)"
                      inputClassName={`${inline} font-mono text-sm text-accent-ink`}
                      ariaLabel={`Formule de l’étape ${i + 1}`}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Supprimer l’étape"
                  onClick={() => maj(etapes.filter((_, j) => j !== i))}
                  disabled={etapes.length <= 1}
                  className="shrink-0 text-ink-muted hover:text-danger disabled:opacity-30"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => maj([...etapes, { text: '' }])}
            className="mt-3 font-display text-sm font-bold text-accent-ink hover:underline"
          >
            ＋ Ajouter une étape
          </button>
        </div>
      )
    }

    case 'table':
      return <TableEditeur bloc={bloc} onModifier={onModifier} onFocusBloc={onFocusBloc} />

    case 'reference':
      return <ReferenceEditeur bloc={bloc} onModifier={onModifier} onFocusBloc={onFocusBloc} />

    case 'figure':
      return <FigureEditeur bloc={bloc} onModifier={onModifier} onFocusBloc={onFocusBloc} />

    case 'exercise':
      return <ExerciceEditeur bloc={bloc} onModifier={onModifier} onFocusBloc={onFocusBloc} />
  }
}

// --- Tableau ------------------------------------------------------------------
// En-têtes (facultatives) + lignes + légende. Structure seule : aucune couleur, aucun alignement
// (le schéma n'a pas ces champs). Les cellules acceptent le balisage inline (**gras**, $formule$),
// rendu à l'aperçu élève par le même parseur que la prose.

function TableEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  const headers = Array.isArray(bloc.headers) ? (bloc.headers as string[]) : null
  const rows = (Array.isArray(bloc.rows) ? bloc.rows : [['']]) as string[][]
  const avecEntetes = headers !== null
  const nbColonnes = avecEntetes ? headers.length : (rows[0]?.length ?? 1)

  const maj = (patch: { headers?: string[] | null; rows?: string[][] }) => {
    const next: Record<string, unknown> = {}
    if ('headers' in patch) next.headers = patch.headers === null ? undefined : patch.headers
    if (patch.rows) next.rows = patch.rows
    onModifier(next)
  }

  const majEntete = (c: number, v: string) =>
    maj({ headers: (headers ?? []).map((h, j) => (j === c ? v : h)) })
  const majCellule = (r: number, c: number, v: string) =>
    maj({ rows: rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) })

  const ajouterColonne = () =>
    maj({
      headers: avecEntetes ? [...(headers as string[]), ''] : undefined,
      rows: rows.map((row) => [...row, '']),
    })
  const supprimerColonne = (c: number) =>
    maj({
      headers: avecEntetes ? (headers as string[]).filter((_, j) => j !== c) : undefined,
      rows: rows.map((row) => row.filter((_, j) => j !== c)),
    })
  const ajouterLigne = () => maj({ rows: [...rows, Array.from({ length: nbColonnes }, () => '')] })
  const supprimerLigne = (r: number) => maj({ rows: rows.filter((_, i) => i !== r) })

  const basculerEntetes = () =>
    maj({ headers: avecEntetes ? null : Array.from({ length: nbColonnes }, () => '') })

  return (
    <div className="rounded-lg border border-line bg-surface-panel p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
          Tableau
        </span>
        <label className="flex shrink-0 items-center gap-1.5 font-prose text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={avecEntetes}
            onChange={basculerEntetes}
            className="accent-accent"
          />
          Ligne d’en-têtes
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {avecEntetes && (
            <thead>
              <tr>
                {(headers as string[]).map((h, c) => (
                  <th key={c} className="border border-line bg-surface-page p-1">
                    <input
                      className={`${inline} font-display text-sm font-extrabold text-ink`}
                      value={h}
                      onChange={(e) => majEntete(c, e.target.value)}
                      onFocus={onFocusBloc}
                      placeholder={`Colonne ${c + 1}`}
                      aria-label={`En-tête colonne ${c + 1}`}
                    />
                  </th>
                ))}
                <th className="w-8" aria-hidden="true" />
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="group/row">
                {row.map((cell, c) => (
                  <td key={c} className="border border-line p-1">
                    <input
                      className={`${inline} font-prose text-sm text-ink`}
                      value={cell}
                      onChange={(e) => majCellule(r, c, e.target.value)}
                      onFocus={onFocusBloc}
                      placeholder="…"
                      aria-label={`Ligne ${r + 1}, colonne ${c + 1}`}
                    />
                  </td>
                ))}
                <td className="w-8 text-center align-middle">
                  <button
                    type="button"
                    aria-label={`Supprimer la ligne ${r + 1}`}
                    onClick={() => supprimerLigne(r)}
                    disabled={rows.length <= 1}
                    className="text-ink-muted opacity-0 hover:text-danger disabled:opacity-30 group-hover/row:opacity-100"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={ajouterLigne}
          className="font-display text-sm font-bold text-accent-ink hover:underline"
        >
          ＋ Ligne
        </button>
        <button
          type="button"
          onClick={ajouterColonne}
          className="font-display text-sm font-bold text-accent-ink hover:underline"
        >
          ＋ Colonne
        </button>
        {nbColonnes > 1 && (
          <button
            type="button"
            onClick={() => supprimerColonne(nbColonnes - 1)}
            className="font-display text-sm font-bold text-ink-muted hover:text-danger"
          >
            − Colonne
          </button>
        )}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <ZoneAuto
          value={(bloc.caption as string) ?? ''}
          onChange={(v) => onModifier({ caption: v || undefined })}
          onFocus={onFocusBloc}
          placeholder="Légende du tableau (facultatif)"
          className="font-prose text-sm leading-relaxed text-ink-muted"
        />
      </div>
    </div>
  )
}

// --- Référence ----------------------------------------------------------------
// Externe (titre + URL https, ouverte dans un nouvel onglet) ou interne (cible level/subject/slug
// + ancre). La résolution des cibles internes est vérifiée à la publication (PublicationValidator) :
// ici on saisit librement, un lien cassé bloquera la publication avec un message clair.

type Cible = { level?: string; subject?: string; slug?: string; anchor?: string }

const champRef =
  'w-full rounded-md border border-line bg-surface-page px-2 py-1 font-prose text-sm text-ink focus:border-accent focus:outline-none'

function ReferenceEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  const scope = (bloc.scope as string) === 'internal' ? 'internal' : 'external'
  const target = (bloc.target ?? {}) as Cible

  const majCible = (patch: Partial<Cible>) => {
    const suivant = { ...target, ...patch }
    // Retire les champs vides : l'ancre est facultative et une chaîne vide n'est pas dans le schéma.
    const nettoye: Cible = {}
    for (const [k, v] of Object.entries(suivant)) {
      if (typeof v === 'string' && v.trim()) nettoye[k as keyof Cible] = v
    }
    onModifier({ target: nettoye })
  }

  const changerScope = (s: 'external' | 'internal') => {
    if (s === scope) return
    if (s === 'external')
      onModifier({ scope: 'external', url: (bloc.url as string) ?? '', target: undefined })
    else onModifier({ scope: 'internal', target, url: undefined })
  }

  return (
    <div className="rounded-lg border border-line bg-surface-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
          Référence
        </span>
        <div className="flex rounded-md border border-line bg-surface-page p-0.5">
          {(['external', 'internal'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changerScope(s)}
              aria-pressed={scope === s}
              className={`rounded-[6px] px-3 py-1 font-display text-xs font-bold ${
                scope === s ? 'bg-surface-panel text-ink shadow-sm' : 'text-ink-muted'
              }`}
            >
              {s === 'external' ? 'Ressource externe' : 'Chapitre de la plateforme'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
            Titre
          </span>
          <input
            className={champRef}
            value={(bloc.title as string) ?? ''}
            onChange={(e) => onModifier({ title: e.target.value })}
            onFocus={onFocusBloc}
            placeholder="Ex. Manuel Sésamath — Théorème de Pythagore"
          />
        </label>

        {scope === 'external' ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
                URL (https)
              </span>
              <input
                type="url"
                inputMode="url"
                className={champRef}
                value={(bloc.url as string) ?? ''}
                onChange={(e) => onModifier({ url: e.target.value })}
                onFocus={onFocusBloc}
                placeholder="https://…"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <label className="flex min-w-32 flex-1 flex-col gap-1">
                <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Source (facultatif)
                </span>
                <input
                  className={champRef}
                  value={(bloc.source as string) ?? ''}
                  onChange={(e) => onModifier({ source: e.target.value || undefined })}
                  onFocus={onFocusBloc}
                  placeholder="Ex. Sésamath"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Consulté le (facultatif)
                </span>
                <input
                  type="date"
                  className={champRef}
                  value={(bloc.consultedOn as string) ?? ''}
                  onChange={(e) => onModifier({ consultedOn: e.target.value || undefined })}
                  onFocus={onFocusBloc}
                />
              </label>
            </div>
          </>
        ) : (
          <>
            <p className="font-prose text-xs text-ink-muted">
              La cible est vérifiée à la publication : elle doit désigner un chapitre publié du
              catalogue.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="flex min-w-28 flex-1 flex-col gap-1">
                <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Niveau
                </span>
                <input
                  className={champRef}
                  value={target.level ?? ''}
                  onChange={(e) => majCible({ level: e.target.value })}
                  onFocus={onFocusBloc}
                  placeholder="Ex. 6e"
                />
              </label>
              <label className="flex min-w-28 flex-1 flex-col gap-1">
                <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Matière
                </span>
                <input
                  className={champRef}
                  value={target.subject ?? ''}
                  onChange={(e) => majCible({ subject: e.target.value })}
                  onFocus={onFocusBloc}
                  placeholder="Ex. mathematiques"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex min-w-28 flex-1 flex-col gap-1">
                <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Chapitre (slug)
                </span>
                <input
                  className={champRef}
                  value={target.slug ?? ''}
                  onChange={(e) => majCible({ slug: e.target.value })}
                  onFocus={onFocusBloc}
                  placeholder="Ex. theoreme-de-pythagore"
                />
              </label>
              <label className="flex min-w-28 flex-1 flex-col gap-1">
                <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Ancre (facultatif)
                </span>
                <input
                  className={champRef}
                  value={target.anchor ?? ''}
                  onChange={(e) => majCible({ anchor: e.target.value })}
                  onFocus={onFocusBloc}
                  placeholder="Ex. enonce"
                />
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// --- Éditeurs d'exercice, un par type -----------------------------------------
// Chaque formulaire ne saisit que les champs du schéma pour son `exerciseType`. Les champs de
// correction (bonnes réponses) sont marqués « non montré à l'élève » : ils sont figés au serveur
// et retirés à la publication (ADR 0019 §4), mais l'enseignant doit voir ce qu'il corrige.

const EXERCICE_LABELS: Record<string, string> = {
  'multiple-choice': 'QCM',
  'short-answer': 'Réponse courte',
  numeric: 'Numérique',
  paper: 'Exercice sur feuille',
}

/** Étiquette « champ de correction, invisible pour l'élève ». */
function LabelCorrection({ children }: { children: ReactNode }) {
  return (
    <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
      {children}
      <span className="ml-1 font-normal normal-case tracking-normal text-ink-muted/70">
        · non montré à l’élève
      </span>
    </span>
  )
}

const champCorrection =
  'rounded-md border border-line bg-surface-page px-2 py-1 font-prose text-sm text-ink focus:border-accent focus:outline-none'

function ExerciceEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  const exerciseType = (bloc.exerciseType as string) ?? 'paper'

  // « Sur feuille » : pré-existant, laissé tel quel (dette #142). Auto-évalué côté élève.
  if (exerciseType === 'paper') {
    return (
      <div className="rounded-lg border border-line bg-surface-panel p-4">
        <p className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
          {EXERCICE_LABELS.paper}
        </p>
        <ZoneAuto
          value={(bloc.prompt as string) ?? ''}
          onChange={(v) => onModifier({ prompt: v })}
          onFocus={onFocusBloc}
          placeholder="L’énoncé de l’exercice…"
          className="font-prose text-base leading-relaxed text-ink"
        />
        <ZoneAuto
          value={(bloc.statement as string) ?? ''}
          onChange={(v) => onModifier({ statement: v })}
          onFocus={onFocusBloc}
          placeholder="Données / précisions (facultatif)"
          className="mt-2 font-prose text-sm leading-relaxed text-ink-muted"
        />
        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-1 font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
            Corrigé
          </p>
          <ZoneAuto
            value={(bloc.solution as string) ?? ''}
            onChange={(v) => onModifier({ solution: v })}
            onFocus={onFocusBloc}
            placeholder="La solution rédigée…"
            className="font-prose text-base leading-relaxed text-ink"
          />
        </div>
      </div>
    )
  }

  // Types auto-corrigés : énoncé partagé, champs du type, puis explication facultative.
  return (
    <div className="rounded-lg border border-line bg-surface-panel p-4">
      <p className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
        {EXERCICE_LABELS[exerciseType] ?? 'Exercice'}
      </p>
      <ZoneAuto
        value={(bloc.prompt as string) ?? ''}
        onChange={(v) => onModifier({ prompt: v })}
        onFocus={onFocusBloc}
        placeholder="La question posée à l’élève…"
        className="font-prose text-base leading-relaxed text-ink"
      />

      <div className="mt-3 border-t border-line pt-3">
        {exerciseType === 'multiple-choice' && (
          <ChoixEditeur bloc={bloc} onModifier={onModifier} onFocusBloc={onFocusBloc} />
        )}
        {exerciseType === 'short-answer' && (
          <ReponseCourteEditeur bloc={bloc} onModifier={onModifier} onFocusBloc={onFocusBloc} />
        )}
        {exerciseType === 'numeric' && (
          <NumeriqueEditeur bloc={bloc} onModifier={onModifier} onFocusBloc={onFocusBloc} />
        )}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <ZoneAuto
          value={(bloc.explanation as string) ?? ''}
          onChange={(v) => onModifier({ explanation: v || undefined })}
          onFocus={onFocusBloc}
          placeholder="Explication montrée après la réponse (facultatif)"
          className="font-prose text-sm leading-relaxed text-ink-muted"
        />
      </div>
    </div>
  )
}

function ChoixEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  const choix = (Array.isArray(bloc.choices) ? bloc.choices : []) as Choix[]
  const multiple = bloc.multiple === true
  const maj = (next: Choix[]) => onModifier({ choices: next })
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <LabelCorrection>Coche la ou les bonnes réponses</LabelCorrection>
        <label className="flex shrink-0 items-center gap-1.5 font-prose text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={multiple}
            onChange={(e) => onModifier({ multiple: e.target.checked })}
            className="accent-accent"
          />
          Plusieurs bonnes réponses
        </label>
      </div>
      <ul className="flex flex-col gap-1.5">
        {choix.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={`Bonne réponse ${i + 1}`}
              checked={c.correct}
              onChange={(e) =>
                maj(choix.map((x, j) => (j === i ? { ...x, correct: e.target.checked } : x)))
              }
              className="shrink-0 accent-accent"
            />
            <input
              className={`${inline} font-prose text-base text-ink`}
              value={c.text}
              onChange={(e) =>
                maj(choix.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
              }
              onFocus={onFocusBloc}
              placeholder={`Réponse ${i + 1}`}
            />
            <button
              type="button"
              aria-label="Supprimer la réponse"
              onClick={() => maj(choix.filter((_, j) => j !== i))}
              disabled={choix.length <= 2}
              className="shrink-0 text-ink-muted hover:text-danger disabled:opacity-30"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => maj([...choix, { id: genId(), text: '', correct: false }])}
        className="mt-2 font-display text-sm font-bold text-accent-ink hover:underline"
      >
        ＋ Ajouter une réponse
      </button>
    </div>
  )
}

function ReponseCourteEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  const reponses = (Array.isArray(bloc.acceptedAnswers) ? bloc.acceptedAnswers : []) as string[]
  const maj = (next: string[]) => onModifier({ acceptedAnswers: next })
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <LabelCorrection>Réponses acceptées</LabelCorrection>
        <label className="flex shrink-0 items-center gap-1.5 font-prose text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={bloc.caseSensitive === true}
            onChange={(e) => onModifier({ caseSensitive: e.target.checked })}
            className="accent-accent"
          />
          Sensible à la casse
        </label>
      </div>
      <ul className="flex flex-col gap-1.5">
        {reponses.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              className={`${inline} font-prose text-base text-ink`}
              value={r}
              onChange={(e) => maj(reponses.map((x, j) => (j === i ? e.target.value : x)))}
              onFocus={onFocusBloc}
              placeholder="Ex. hypoténuse"
            />
            <button
              type="button"
              aria-label="Supprimer la réponse acceptée"
              onClick={() => maj(reponses.filter((_, j) => j !== i))}
              disabled={reponses.length <= 1}
              className="shrink-0 text-ink-muted hover:text-danger disabled:opacity-30"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => maj([...reponses, ''])}
        className="mt-2 font-display text-sm font-bold text-accent-ink hover:underline"
      >
        ＋ Ajouter une réponse acceptée
      </button>
    </div>
  )
}

function NumeriqueEditeur({ bloc, onModifier, onFocusBloc }: Props) {
  const answer = typeof bloc.answer === 'number' ? String(bloc.answer) : ''
  const tolerance = typeof bloc.tolerance === 'number' ? String(bloc.tolerance) : ''
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1">
        <LabelCorrection>Réponse attendue</LabelCorrection>
        <input
          type="number"
          step="any"
          inputMode="decimal"
          aria-label="Réponse attendue"
          className={`${champCorrection} w-32`}
          value={answer}
          onChange={(e) =>
            onModifier({ answer: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          onFocus={onFocusBloc}
          placeholder="Ex. 5"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
          Tolérance ±
        </span>
        <input
          type="number"
          step="any"
          min={0}
          inputMode="decimal"
          aria-label="Tolérance"
          className={`${champCorrection} w-24`}
          value={tolerance}
          onChange={(e) =>
            onModifier({ tolerance: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          onFocus={onFocusBloc}
          placeholder="0"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
          Unité (facultatif)
        </span>
        <input
          type="text"
          aria-label="Unité"
          className={`${champCorrection} w-24`}
          value={(bloc.unit as string) ?? ''}
          onChange={(e) => onModifier({ unit: e.target.value || undefined })}
          onFocus={onFocusBloc}
          placeholder="Ex. cm"
        />
      </label>
    </div>
  )
}
