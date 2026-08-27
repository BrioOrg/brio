import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalogue } from '@/lib/api'
import { SiteHeader } from '@/components/site-header'
import { Icon } from '@/components/ui/icon'
import { EmptyState } from '@/components/ui/empty-state'

export const dynamicParams = true

export async function generateStaticParams() {
  try {
    const catalogue = await getCatalogue()
    return catalogue.flatMap(({ niveauCode, matieres }) =>
      matieres.map(({ matiereCode }) => ({ niveau: niveauCode, matiere: matiereCode }))
    )
  } catch {
    return []
  }
}

export default async function MatierePage({
  params,
}: {
  params: Promise<{ niveau: string; matiere: string }>
}) {
  const { niveau, matiere } = await params
  const catalogue = await getCatalogue()
  const niveauEntry = catalogue.find((n) => n.niveauCode === niveau)
  const matiereEntry = niveauEntry?.matieres.find((m) => m.matiereCode === matiere)
  if (!niveauEntry || !matiereEntry) notFound()

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader
        crumbs={[
          { label: niveauEntry.niveauLibelle, href: `/${niveau}` },
          { label: matiereEntry.matiereLibelle },
        ]}
      />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div>
          <p className="font-display text-sm font-extrabold uppercase tracking-widest text-accent">
            {matiereEntry.matiereLibelle} · {niveauEntry.niveauLibelle}
          </p>
          <h1 className="mt-2 font-display text-3xl font-black tracking-tight text-ink">
            Le parcours
          </h1>
          <p className="mt-3 font-prose text-base text-ink-muted">
            Les chapitres dans l&rsquo;ordre conseillé. Avance à ton rythme.
          </p>
        </div>

        <section className="mt-10" aria-labelledby="parcours-heading">
          <h2 id="parcours-heading" className="sr-only">
            Chapitres
          </h2>

          {matiereEntry.chapitres.length === 0 ? (
            <EmptyState
              icon="book-open"
              title="Aucun chapitre pour l'instant"
              description="Les chapitres de cette matière apparaîtront ici dès qu'ils seront publiés."
            />
          ) : (
            <ol className="relative flex flex-col gap-3">
              {matiereEntry.chapitres.map(({ slug, titre, dureeEstimeeMinutes }, i) => {
                const last = i === matiereEntry.chapitres.length - 1
                return (
                  <li key={slug} className="relative flex gap-4">
                    {/* Step marker + connecting line */}
                    <div className="flex flex-col items-center">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center bg-accent-soft font-display text-sm font-black text-accent-ink"
                        style={{
                          clipPath: 'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%)',
                        }}
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      {!last && <span className="mt-1 w-0.5 flex-1 bg-line" aria-hidden="true" />}
                    </div>

                    <Link
                      href={`/${niveau}/${matiere}/${slug}`}
                      className="group mb-1 flex flex-1 items-center gap-3 rounded-lg border border-line bg-surface-panel p-4 transition-[transform,border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-accent hover:[box-shadow:0_5px_0_var(--color-accent-edge)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                    >
                      <span className="flex flex-1 flex-col gap-1">
                        <span className="font-display text-base font-extrabold tracking-tight text-ink">
                          {titre}
                        </span>
                        <span className="flex items-center gap-1.5 font-prose text-sm text-ink-muted">
                          <Icon name="book-open" size={14} aria-hidden="true" />
                          Lecture ≈ {dureeEstimeeMinutes} min
                        </span>
                      </span>
                      <Icon
                        name="arrow-right"
                        size={18}
                        className="shrink-0 text-ink-muted transition-transform duration-[var(--duration-base)] group-hover:translate-x-1 group-hover:text-accent"
                      />
                    </Link>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </main>
    </div>
  )
}
