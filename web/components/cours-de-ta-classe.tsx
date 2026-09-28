import Link from 'next/link'

import { Icon } from '@/components/ui/icon'
import type { Catalogue, CoursVisible } from '@/lib/api'

// Paris time, so the date a student reads doesn't depend on where the server runs.
const DATE_PUBLICATION = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris',
})

/** The subject's label from the catalogue, or null when the catalogue doesn't list it. */
function libelleMatiere(catalogue: Catalogue, cours: CoursVisible): string | null {
  const niveau = catalogue.find((n) => n.niveauCode === cours.niveauCode)
  const matiere = niveau?.matieres.find((m) => m.matiereCode === cours.matiereCode)
  return matiere?.matiereLibelle ?? null
}

/**
 * The teacher courses published to the student's classes (#160), above the catalogue. The
 * caller renders it only when there is at least one course: no empty state, and every line
 * shows only what the backend returned (a missing subject label or author is omitted).
 */
export function CoursDeTaClasse({
  cours,
  catalogue,
}: {
  cours: CoursVisible[]
  catalogue: Catalogue
}) {
  return (
    <section className="mt-10" aria-labelledby="cours-classe-heading">
      <h2
        id="cours-classe-heading"
        className="mb-4 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted"
      >
        Les cours de ta classe
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cours.map((c) => {
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
    </section>
  )
}
