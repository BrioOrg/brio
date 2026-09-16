import Link from 'next/link'
import { getCatalogue } from '@/lib/api'
import { SiteHeader } from '@/components/site-header'
import { Icon } from '@/components/ui/icon'
import { EmptyState } from '@/components/ui/empty-state'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  let catalogue: Awaited<ReturnType<typeof getCatalogue>> = []
  try {
    catalogue = await getCatalogue()
  } catch {
    catalogue = []
  }

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="max-w-2xl">
          <p className="font-display text-sm font-extrabold uppercase tracking-widest text-accent">
            Bienvenue sur brio
          </p>
          <h1
            className="mt-2 font-display font-black leading-[1.05] tracking-tight text-ink"
            style={{ fontSize: 'var(--text-display)' }}
          >
            Apprends, progresse, réussis.
          </h1>
          <p className="mt-3 font-prose text-base text-ink-muted">
            Choisis ta classe pour retrouver tes matières et tes chapitres.
          </p>
        </div>

        <section className="mt-10" aria-labelledby="niveaux-heading">
          <h2
            id="niveaux-heading"
            className="mb-4 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted"
          >
            Ta classe
          </h2>

          {catalogue.length === 0 ? (
            <EmptyState
              icon="book-open"
              title="Le catalogue arrive bientôt"
              description="Les classes et leurs matières apparaîtront ici dès qu'elles seront disponibles."
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {catalogue.map(({ niveauCode, niveauLibelle, matieres }) => (
                <li key={niveauCode}>
                  <Link
                    href={`/${niveauCode}`}
                    className="group flex h-full flex-col justify-between gap-6 rounded-lg border border-line bg-surface-panel p-5 transition-[transform,border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-accent hover:[box-shadow:0_5px_0_var(--color-accent-edge)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                  >
                    <span className="font-display text-2xl font-black tracking-tight text-ink">
                      {niveauLibelle}
                    </span>
                    <span className="flex items-center justify-between font-prose text-sm text-ink-muted">
                      {matieres.length} matière{matieres.length > 1 ? 's' : ''}
                      <Icon
                        name="arrow-right"
                        size={18}
                        className="text-ink-muted transition-transform duration-[var(--duration-base)] group-hover:translate-x-1 group-hover:text-accent"
                      />
                    </span>
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
