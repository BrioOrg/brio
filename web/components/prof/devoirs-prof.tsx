'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import {
  CoursApiError,
  listerDevoirsClasse,
  listerMesClasses,
  type ClasseInfo,
  type DevoirClasseVue,
} from '@brio/api-client'

import { Icon } from '@/components/ui/icon'
import { apiBaseUrl } from '@/lib/api-base-url'

// Accueil des devoirs côté enseignant : ses classes, et pour chacune ses devoirs (F4). Point
// d'entrée pour ouvrir un tableau de bord ou créer un nouveau devoir.

type ClasseAvecDevoirs = { classe: ClasseInfo; devoirs: DevoirClasseVue[] }

export function DevoirsProf() {
  const [donnees, setDonnees] = useState<ClasseAvecDevoirs[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const classes = await listerMesClasses(apiBaseUrl())
        const avecDevoirs = await Promise.all(
          classes.map(async (classe) => ({
            classe,
            devoirs: await listerDevoirsClasse(apiBaseUrl(), classe.id ?? ''),
          }))
        )
        setDonnees(avecDevoirs)
      } catch (e) {
        setErreur(e instanceof CoursApiError ? e.message : 'Chargement impossible.')
      }
    })()
  }, [])

  return (
    <div data-theme="light" className="min-h-screen bg-surface-page font-prose text-ink">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-panel px-4 py-3">
        <Link
          href="/prof"
          aria-label="Retour à l'espace enseignant"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line text-ink-muted hover:text-ink"
        >
          <Icon name="arrow-right" size={16} className="rotate-180" aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 font-display text-lg font-extrabold text-ink">Devoirs</h1>
        <Link
          href="/prof/devoirs/nouveau"
          className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-extrabold text-surface-panel"
        >
          ＋ Nouveau devoir
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {erreur && (
          <p className="rounded-lg border border-danger bg-surface-panel px-4 py-2 text-sm text-danger">
            {erreur}
          </p>
        )}
        {!donnees && !erreur && <p className="text-ink-muted">Chargement…</p>}

        {donnees?.length === 0 && (
          <p className="text-ink-muted">Tu n’as pas encore de classe.</p>
        )}

        {donnees?.map(({ classe, devoirs }) => (
          <section key={classe.id} className="mb-8">
            <h2 className="mb-2 font-display text-sm font-extrabold text-ink">
              {classe.libelle}{' '}
              <span className="font-prose text-xs font-normal text-ink-muted">({classe.niveauCode})</span>
            </h2>
            {devoirs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
                Aucun devoir pour cette classe.
              </p>
            ) : (
              <ul className="overflow-hidden rounded-lg border border-line bg-surface-panel">
                {devoirs.map((d) => (
                  <li key={d.id} className="border-b border-line last:border-b-0">
                    <Link
                      href={`/prof/devoirs/${d.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-page"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-sm font-bold text-ink">
                          {d.titre}
                        </span>
                        <span className="block text-xs text-ink-muted">
                          {d.nombreExercices} exercice{d.nombreExercices > 1 ? 's' : ''} · à rendre le{' '}
                          {formatDate(d.echeanceAt)}
                        </span>
                      </span>
                      <Icon name="arrow-right" size={16} className="text-ink-muted" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
