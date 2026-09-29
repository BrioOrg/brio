'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { CoursApiError, getTableauDeBord, type TableauDeBordDevoir } from '@brio/api-client'

import { Icon } from '@/components/ui/icon'
import { apiBaseUrl } from '@/lib/api-base-url'

// Tableau de bord d'un devoir (F4) : qui a rendu / en cours / pas commencé, et la réussite par
// compétence — les chiffres viennent tous du serveur (dérivés des soumissions), jamais fabriqués.

const STATUT_LABEL: Record<string, string> = {
  non_commence: 'Pas commencé',
  en_cours: 'En cours',
  rendu: 'Rendu',
}

export function TableauDeBordDevoirVue({ devoirId }: { devoirId: string }) {
  const [tdb, setTdb] = useState<TableauDeBordDevoir | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setTdb(await getTableauDeBord(apiBaseUrl(), devoirId))
      } catch (e) {
        setErreur(e instanceof CoursApiError ? e.message : 'Chargement impossible.')
      }
    })()
  }, [devoirId])

  return (
    <div data-theme="light" className="min-h-screen bg-surface-page font-prose text-ink">
      <header className="flex items-center gap-3 border-b border-line bg-surface-panel px-4 py-3">
        <Link
          href="/prof/devoirs"
          aria-label="Retour aux devoirs"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line text-ink-muted hover:text-ink"
        >
          <Icon name="arrow-right" size={16} className="rotate-180" aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-ink">
          {tdb?.titre ?? 'Devoir'}
        </h1>
      </header>

      <main className="mx-auto max-w-[52rem] px-4 py-6">
        {erreur && (
          <p className="rounded-lg border border-danger bg-surface-panel px-4 py-2 text-sm text-danger">
            {erreur}
          </p>
        )}
        {!tdb && !erreur && <p className="text-ink-muted">Chargement…</p>}

        {tdb && (
          <>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tuile valeur={tdb.nbRendu} label="rendus" />
              <Tuile valeur={tdb.nbEnCours} label="en cours" />
              <Tuile valeur={tdb.nbNonCommence} label="pas commencé" />
              <Tuile
                valeur={tdb.moyenne == null ? '—' : `${Math.round(tdb.moyenne * 100)} %`}
                label="réussite moyenne"
              />
            </section>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section>
                <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Les élèves ({tdb.total})
                </h2>
                <ul className="rounded-lg border border-line bg-surface-panel">
                  {tdb.eleves.map((el) => (
                    <li
                      key={el.eleveId}
                      className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{el.nomAffiche}</span>
                      <span
                        className={`rounded-pill px-2 py-0.5 font-display text-[11px] font-bold ${
                          el.statut === 'rendu'
                            ? 'bg-accent-soft text-accent-ink'
                            : el.statut === 'en_cours'
                              ? 'bg-surface-page text-ink-muted'
                              : 'bg-surface-page text-ink-muted'
                        }`}
                      >
                        {STATUT_LABEL[el.statut] ?? el.statut}
                      </span>
                      <span className="w-12 text-right font-mono text-xs text-ink-muted">
                        {el.score == null ? '—' : `${Math.round(el.score * 100)} %`}
                      </span>
                    </li>
                  ))}
                  {tdb.eleves.length === 0 && (
                    <li className="px-3 py-3 text-sm text-ink-muted">Aucun élève dans cette classe.</li>
                  )}
                </ul>
              </section>

              <section>
                <h2 className="mb-2 font-display text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Réussite par compétence
                </h2>
                {tdb.parCompetence.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    Pas encore de données — dès que des élèves répondent, la réussite par compétence
                    apparaît ici.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {tdb.parCompetence.map((c) => (
                      <li key={c.code}>
                        <div className="mb-1 flex justify-between text-[13px] text-ink-soft">
                          <span className="truncate">{c.code}</span>
                          <span className="font-mono">{Math.round(c.tauxReussite * 100)} %</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-pill bg-surface-panel">
                          <div
                            className="h-full rounded-pill bg-accent"
                            style={{ width: `${Math.round(c.tauxReussite * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Tuile({ valeur, label }: { valeur: number | string; label: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-panel px-4 py-3">
      <div className="font-display text-2xl font-extrabold tabular-nums text-ink">{valeur}</div>
      <div className="mt-0.5 text-xs text-ink-muted">{label}</div>
    </div>
  )
}
