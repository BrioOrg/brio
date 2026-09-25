'use client'

import { useMemo, useState } from 'react'

import type { Competence } from '@brio/api-client'

// Picker de compétences du référentiel (ADR 0009, issue #144). À côté des objectifs en texte
// libre, l'enseignant coche des compétences codées par leur libellé. Les codes valides partent
// dans `objectives.competencies` ; ils sont revalidés à la publication (ContentReferentialValidator).

type Props = {
  /** Les compétences proposées (déjà filtrées au niveau du cours par l'appelant). */
  competences: Competence[]
  /** Les codes actuellement retenus sur le bloc. */
  selection: string[]
  onChange: (codes: string[]) => void
  onFocus?: () => void
}

/** Un choix normalisé : le schéma généré rend les champs optionnels, on garantit ici des chaînes. */
type Choix = { code: string; intitule: string }

/** Le libellé lisible d'un code, ou le code lui-même si le référentiel ne le connaît pas (ex. autre niveau). */
function libelle(options: Choix[], code: string): string {
  return options.find((c) => c.code === code)?.intitule ?? code
}

function sansAccents(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function CompetencesPicker({ competences, selection, onChange, onFocus }: Props) {
  const [requete, setRequete] = useState('')
  const selectionnes = useMemo(() => new Set(selection), [selection])

  // Les entrées utilisables : un code non vide, un libellé de repli sur le code.
  const options = useMemo<Choix[]>(
    () =>
      competences
        .filter(
          (c): c is Competence & { code: string } => typeof c.code === 'string' && c.code !== ''
        )
        .map((c) => ({ code: c.code, intitule: c.intitule ?? c.code })),
    [competences]
  )

  // Recherche insensible à la casse et aux accents, sur le libellé et le code.
  const filtre = useMemo(() => {
    const q = sansAccents(requete.trim())
    if (!q) return options
    return options.filter((c) => sansAccents(`${c.intitule} ${c.code}`).includes(q))
  }, [options, requete])

  const basculer = (code: string) => {
    if (selectionnes.has(code)) onChange(selection.filter((c) => c !== code))
    else onChange([...selection, code])
  }

  return (
    <div className="mt-4 border-t border-accent-edge/40 pt-3">
      <p className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-accent-ink">
        Compétences du référentiel
      </p>

      {selection.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {selection.map((code) => (
            <li key={code}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-panel px-2.5 py-1 font-prose text-sm text-ink">
                {libelle(options, code)}
                <button
                  type="button"
                  aria-label={`Retirer ${libelle(options, code)}`}
                  onClick={() => onChange(selection.filter((c) => c !== code))}
                  className="text-ink-muted hover:text-danger"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {options.length === 0 ? (
        <p className="font-prose text-sm text-ink-muted">
          Aucune compétence du référentiel pour ce niveau.
        </p>
      ) : (
        <>
          <input
            type="search"
            value={requete}
            onChange={(e) => setRequete(e.target.value)}
            onFocus={onFocus}
            placeholder="Rechercher une compétence…"
            aria-label="Rechercher une compétence"
            className="mb-2 w-full rounded-md border border-line bg-surface-panel px-3 py-1.5 font-prose text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <ul className="max-h-56 overflow-y-auto rounded-md border border-line bg-surface-panel">
            {filtre.length === 0 ? (
              <li className="px-3 py-2 font-prose text-sm text-ink-muted">Aucun résultat.</li>
            ) : (
              filtre.map((c) => (
                <li key={c.code}>
                  <label className="flex cursor-pointer items-start gap-2 px-3 py-1.5 hover:bg-accent-soft">
                    <input
                      type="checkbox"
                      checked={selectionnes.has(c.code)}
                      onChange={() => basculer(c.code)}
                      onFocus={onFocus}
                      className="mt-1 shrink-0 accent-accent"
                    />
                    <span className="min-w-0">
                      <span className="block font-prose text-sm text-ink">{c.intitule}</span>
                      <span className="block font-mono text-xs text-ink-muted">{c.code}</span>
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  )
}
