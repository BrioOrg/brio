'use client'

import { useEffect, useRef } from 'react'

import { ChampFormule } from '@/components/maths/champ-formule'
import { CALLOUT_VARIANTES, type Bloc, type Etape } from '@/lib/cours-editeur'

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

    case 'exercise':
      return (
        <div className="rounded-lg border border-line bg-surface-panel p-4">
          <p className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
            Exercice
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
}
