import Link from 'next/link'

import { Icon } from '@/components/ui/icon'
import type { Catalogue, CoursVisible } from '@/lib/api'

// Paris time, so the date a student reads doesn't depend on where the server runs.
const DATE_PUBLICATION = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris',
})

// The title of the full list (« Cours du prof » tab) and of the capped block (« À faire » tab), whose
// spacing follows its neighbours « À faire » and « Terminés ».
const TITRE = 'font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted'
const TITRE_LISTE = `mb-4 ${TITRE}`
const TITRE_BLOC = `mb-2 ${TITRE}`

/** The subject's label from the catalogue, or null when the catalogue doesn't list it. */
function libelleMatiere(catalogue: Catalogue, cours: CoursVisible): string | null {
  const niveau = catalogue.find((n) => n.niveauCode === cours.niveauCode)
  const matiere = niveau?.matieres.find((m) => m.matiereCode === cours.matiereCode)
  return matiere?.matiereLibelle ?? null
}

/**
 * The teacher courses published to the student's classes (#160), on Ma classe. The
 * caller renders it only when there is at least one course: no empty state, and every line
 * shows only what the backend returned (a missing subject label or author is omitted).
 */
export function CoursDeTaClasse({
  cours,
  catalogue,
  plafond,
}: {
  cours: CoursVisible[]
  catalogue: Catalogue
  /** Keep only the first `plafond` courses and link to the full list when there are more. */
  plafond?: number
}) {
  const affiches = plafond === undefined ? cours : cours.slice(0, plafond)
  const voirTous = plafond !== undefined && cours.length > plafond
  return (
    <section
      className={plafond === undefined ? 'mt-10' : undefined}
      aria-labelledby="cours-classe-heading"
    >
      <h2 id="cours-classe-heading" className={plafond === undefined ? TITRE_LISTE : TITRE_BLOC}>
        Les cours de ta classe
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {affiches.map((c) => {
          const matiere = libelleMatiere(catalogue, c)
          const details = [matiere, c.enseignant ? `par ${c.enseignant}` : null].filter(Boolean)
          return (
            <li key={c.id}>
              <Link
                href={`/cours/${c.id}`}
                className="group flex h-full flex-col justify-between gap-4 rounded-lg border border-line bg-surface-panel p-5 transition-[transform,border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-accent hover:[box-shadow:0_5px_0_var(--color-accent-edge)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
              >
                <span>
                  <span className="block font-display text-lg font-extrabold tracking-tight text-ink">
                    {c.titre}
                  </span>
                  {details.length > 0 && (
                    <span className="mt-1 block font-prose text-sm text-ink-muted">
                      {details.join(' · ')}
                    </span>
                  )}
                </span>
                <span className="flex items-center justify-between font-prose text-sm text-ink-muted">
                  Publié le {DATE_PUBLICATION.format(new Date(c.publieAt))}
                  <Icon
                    name="arrow-right"
                    size={18}
                    className="text-ink-muted transition-transform duration-[var(--duration-base)] group-hover:translate-x-1 group-hover:text-accent"
                  />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {voirTous && (
        <Link
          href="/ma-classe/cours"
          className="mt-3 inline-flex min-h-11 items-center gap-1 font-display text-sm font-extrabold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Voir tous les cours du prof
          <Icon name="arrow-right" size={16} aria-hidden="true" />
        </Link>
      )}
    </section>
  )
}
