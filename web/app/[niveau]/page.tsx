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
    return catalogue.map(({ niveauCode }) => ({ niveau: niveauCode }))
  } catch {
    return []
  }
}

// A stable icon per subject so the grid reads at a glance. Falls back to book-open.
const SUBJECT_ICON: Record<string, string> = {
  mathematiques: 'lightning',
}

export default async function NiveauPage({ params }: { params: Promise<{ niveau: string }> }) {
  const { niveau } = await params
  const catalogue = await getCatalogue()
  const entry = catalogue.find((n) => n.niveauCode === niveau)
  if (!entry) notFound()

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: entry.niveauLibelle }]} />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="max-w-2xl">
          <p className="font-display text-sm font-extrabold uppercase tracking-widest text-accent">
            {entry.niveauLibelle}
          </p>
          <h1 className="mt-2 font-display text-3xl font-black tracking-tight text-ink">
            Choisis une matière
          </h1>
        </div>

        <section className="mt-10" aria-labelledby="matieres-heading">
          <h2 id="matieres-heading" className="sr-only">
            Matières
          </h2>

          {entry.matieres.length === 0 ? (
            <EmptyState
              icon="book-open"
              title="Aucune matière pour l'instant"
              description="Les matières de cette classe apparaîtront ici dès qu'elles seront disponibles."
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {entry.matieres.map(({ matiereCode, matiereLibelle, chapitres }) => (
                <li key={matiereCode}>
                  <Link
                    href={`/${niveau}/${matiereCode}`}
                    className="group flex h-full flex-col gap-5 rounded-lg border border-line bg-surface-panel p-5 transition-[transform,border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-accent hover:[box-shadow:0_5px_0_var(--color-accent-edge)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft text-accent">
                      <Icon name={SUBJECT_ICON[matiereCode] ?? 'book-open'} size={22} weight="bold" />
                    </span>
                    <span className="flex flex-1 flex-col gap-1">
                      <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                        {matiereLibelle}
                      </span>
                      <span className="font-prose text-sm text-ink-muted">
                        {chapitres.length} chapitre{chapitres.length > 1 ? 's' : ''}
                      </span>
                    </span>
                    <Icon
                      name="arrow-right"
                      size={18}
                      className="text-ink-muted transition-transform duration-[var(--duration-base)] group-hover:translate-x-1 group-hover:text-accent"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
