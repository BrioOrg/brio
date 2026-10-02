'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import {
  CoursApiError,
  definirPortees,
  listerMesClasses,
  publierCours,
  type ClasseInfo,
  type ViolationContenu,
} from '@brio/api-client'

import { Icon } from '@/components/ui/icon'
import {
  aDesProblemesBloquants,
  apercuBloc,
  type Brouillon,
  type Probleme,
} from '@/lib/cours-editeur'
import { apiBaseUrl } from '@/lib/api-base-url'

// Écran « Publier » (CDC §8.4) : une relecture avant de figer. Trois choses, dans l'ordre où on
// les décide : ce qui doit être en règle (checklist), le rappel que la version est figée, et le
// choix des classes qui verront le cours. Les problèmes viennent des règles de cours-editeur
// (calculées par l'éditeur, qui les affiche aussi sur chaque bloc) : tant qu'un problème bloquant
// reste, rien n'est envoyé. Le serveur reste l'autorité : un 422 revient en violations localisées,
// remontées à l'éditeur pour être affichées de la même façon.

/** Où se trouve un problème, en termes d'enseignant : « Partie 2 · Quel côté… ». */
function lieuDuProbleme(p: Probleme, brouillon: Brouillon): string {
  const i = brouillon.sections.findIndex((s) => s.id === p.sectionId)
  if (i < 0) return 'Cours'
  const partie = `Partie ${i + 1}`
  const bloc = p.blocId ? brouillon.sections[i].blocks.find((b) => b.id === p.blocId) : undefined
  return bloc ? `${partie} · ${apercuBloc(bloc)}` : partie
}

export function PublierCours({
  coursId,
  brouillon,
  problemes,
  verificationEnCours,
  classeIdsInitiales,
  onAvantPublicationAction,
  onAllerAuProblemeAction,
  onRefusServeurAction,
  onPublieAction,
  onFermerAction,
}: {
  coursId: string
  brouillon: Brouillon
  /** Tous les problèmes connus (règles web, références vérifiées, refus du serveur). */
  problemes: Probleme[]
  /** Vrai tant que les références internes sont en cours de vérification. */
  verificationEnCours: boolean
  classeIdsInitiales: string[]
  /** Force un enregistrement du brouillon en cours avant de figer (le débounce peut être en attente). */
  onAvantPublicationAction: () => Promise<void>
  /** Ferme la fenêtre et amène l'enseignant au champ à corriger. */
  onAllerAuProblemeAction: (probleme: Probleme) => void
  /** Le serveur a refusé : ses violations localisées, à afficher comme les autres problèmes. */
  onRefusServeurAction: (violations: ViolationContenu[]) => void
  onPublieAction: (version: number) => void
  onFermerAction: () => void
}) {
  const [classes, setClasses] = useState<ClasseInfo[] | null>(null)
  const [selection, setSelection] = useState<Set<string>>(new Set(classeIdsInitiales))
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<number | null>(null)

  useEffect(() => {
    let vivant = true
    listerMesClasses(apiBaseUrl())
      .then((c) => {
        if (vivant) setClasses(c)
      })
      .catch((e) => {
        if (vivant) {
          setClasses([])
          setErreur(e instanceof CoursApiError ? e.message : 'Impossible de charger vos classes.')
        }
      })
    return () => {
      vivant = false
    }
  }, [])

  // Un même libellé sur un même bloc n'est listé qu'une fois (plusieurs cases vides d'un tableau).
  const lignes = problemes.filter(
    (p, i) =>
      problemes.findIndex(
        (q) => q.sectionId === p.sectionId && q.blocId === p.blocId && q.message === p.message
      ) === i
  )

  const pretAPublier =
    !aDesProblemesBloquants(problemes) && !verificationEnCours && selection.size > 0 && !enCours

  function basculerClasse(id: string) {
    setSelection((prev) => {
      const suivant = new Set(prev)
      if (suivant.has(id)) suivant.delete(id)
      else suivant.add(id)
      return suivant
    })
  }

  async function publier() {
    if (!pretAPublier) return
    setEnCours(true)
    setErreur(null)
    try {
      await onAvantPublicationAction()
      await definirPortees(apiBaseUrl(), coursId, [...selection])
      const { version } = await publierCours(apiBaseUrl(), coursId)
      setSucces(version ?? 1)
      onPublieAction(version ?? 1)
    } catch (e) {
      if (e instanceof CoursApiError && e.violations.length > 0) {
        onRefusServeurAction(e.violations)
      }
      setErreur(e instanceof CoursApiError ? e.message : 'La publication a échoué. Réessayez.')
      setEnCours(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Publier le cours"
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !enCours) onFermerAction()
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-line bg-surface-panel p-6 shadow-lg">
        {succes !== null ? (
          <div className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success">
              <Icon name="check" size={24} aria-hidden="true" />
            </div>
            <h2 className="mt-3 font-display text-lg font-extrabold text-ink">
              Cours publié en version {succes}
            </h2>
            <p className="mt-1 font-prose text-sm text-ink-muted">
              Cette version est figée. Les élèves des classes choisies peuvent maintenant la lire.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Link
                href={`/cours/${coursId}`}
                className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-extrabold text-surface-panel"
              >
                Voir côté élève
              </Link>
              <button
                type="button"
                onClick={onFermerAction}
                className="rounded-lg border border-line px-4 py-2 font-display text-sm font-extrabold text-ink-muted hover:text-ink"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="font-display text-lg font-extrabold text-ink">Publier le cours</h2>
            <p className="mt-1 font-prose text-sm text-ink-muted">
              Publier <strong className="text-ink">fige une version immuable</strong> du cours et la
              rend visible aux classes choisies. Tu pourras continuer à modifier le brouillon et
              republier une nouvelle version plus tard.
            </p>

            <section className="mt-5">
              <h3 className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
                Avant de figer
              </h3>
              <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
                {verificationEnCours && (
                  <li className="font-prose text-sm text-ink-muted">
                    Vérification des références vers d’autres chapitres…
                  </li>
                )}
                {lignes.length === 0 && !verificationEnCours ? (
                  <li className="flex items-center gap-2 font-prose text-sm text-ink">
                    <span className="text-success">
                      <Icon name="check" size={16} aria-hidden="true" />
                    </span>
                    Le cours est prêt à être relu par le serveur.
                  </li>
                ) : (
                  lignes.map((p) => (
                    <li key={`${p.sectionId}|${p.blocId}|${p.message}`}>
                      <button
                        type="button"
                        onClick={() => onAllerAuProblemeAction(p)}
                        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span
                          aria-hidden="true"
                          className={p.gravite === 'bloquant' ? 'text-danger' : 'text-warning'}
                        >
                          ⚠
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-[11px] font-extrabold uppercase tracking-wide text-ink-muted">
                            {lieuDuProbleme(p, brouillon)}
                            {p.gravite === 'avertissement' && ' · à vérifier'}
                          </span>
                          <span className="block font-prose text-sm text-ink">{p.message}</span>
                        </span>
                        <Icon
                          name="arrow-right"
                          size={14}
                          className="mt-1 shrink-0 text-ink-muted"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="mt-5">
              <h3 className="font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
                Classes qui verront le cours
              </h3>
              {classes === null ? (
                <p className="mt-2 font-prose text-sm text-ink-muted">Chargement des classes…</p>
              ) : classes.length === 0 ? (
                <p className="mt-2 font-prose text-sm text-ink-muted">
                  Vous n’avez aucune classe active. Un cours doit être porté à au moins une classe.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1">
                  {classes.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-page">
                        <input
                          type="checkbox"
                          checked={c.id ? selection.has(c.id) : false}
                          onChange={() => c.id && basculerClasse(c.id)}
                          className="h-4 w-4 accent-[var(--color-accent)]"
                        />
                        <span className="font-prose text-sm text-ink">
                          {c.libelle}
                          {c.niveauCode ? (
                            <span className="text-ink-muted"> · {c.niveauCode}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {erreur && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 font-prose text-sm text-ink"
              >
                {erreur}
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onFermerAction}
                disabled={enCours}
                className="rounded-lg border border-line px-4 py-2 font-display text-sm font-extrabold text-ink-muted hover:text-ink disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={publier}
                disabled={!pretAPublier}
                className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-extrabold text-surface-panel disabled:opacity-50"
              >
                {enCours ? 'Publication…' : 'Publier'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
