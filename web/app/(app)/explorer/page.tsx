import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { getCatalogue, getNiveauDeLEleve } from '@/lib/api'
import { CarteLien, Fleche, TITRE_DE_BLOC } from '@/components/carte-lien'
import { SiteHeader } from '@/components/site-header'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata: Metadata = {
  title: 'Explorer — Brio',
}

export const dynamic = 'force-dynamic'

export default async function ExplorerPage() {
  const cookieStore = await cookies()

  // No session check here: the middleware has already sent a visitor without a live one to login.
  const [catalogue, niveauEleve] = await Promise.all([
    getCatalogue().catch(() => []),
    // Any failure simply highlights no level.
    getNiveauDeLEleve(cookieStore.toString()).catch(() => null),
  ])

  const monNiveau = catalogue.find((n) => n.niveauCode === niveauEleve)
  // The student's level comes first; the others keep the catalogue's order.
  const niveaux = monNiveau ? [monNiveau, ...catalogue.filter((n) => n !== monNiveau)] : catalogue

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Explorer' }]} />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="max-w-2xl">
          <p className="font-display text-sm font-extrabold uppercase tracking-widest text-accent">
            Explorer
          </p>
          <h1
            className="mt-2 font-display font-black leading-[1.05] tracking-tight text-ink"
            style={{ fontSize: 'var(--text-display)' }}
          >
            Apprends, progresse, réussis.
          </h1>
          <p className="mt-3 font-prose text-base text-ink-muted">
            Choisis un niveau pour retrouver ses matières et ses chapitres.
          </p>
        </div>

        <section className="mt-10" aria-labelledby="niveaux-heading">
          <h2 id="niveaux-heading" className={TITRE_DE_BLOC}>
            Les niveaux
          </h2>

          {niveaux.length === 0 ? (
            <EmptyState
              icon="book-open"
              title="Le catalogue arrive bientôt"
              description="Les niveaux et leurs matières apparaîtront ici dès qu'ils seront disponibles."
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {niveaux.map((niveau) => {
                const estLeMien = niveau === monNiveau
                return (
                  <li key={niveau.niveauCode}>
                    <CarteLien href={`/${niveau.niveauCode}`} enAvant={estLeMien}>
                      <span className="flex flex-col items-start gap-2">
                        {estLeMien && (
                          <span className="rounded-sm bg-accent-soft px-2 py-0.5 font-display text-xs font-extrabold text-accent">
                            Ton niveau
                          </span>
                        )}
                        <span className="font-display text-2xl font-black tracking-tight text-ink">
                          {niveau.niveauLibelle}
                        </span>
                      </span>
                      <span className="flex items-center justify-between font-prose text-sm text-ink-muted">
                        {niveau.matieres.length} matière{niveau.matieres.length > 1 ? 's' : ''}
                        <Fleche />
                      </span>
                    </CarteLien>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {monNiveau && monNiveau.matieres.length > 0 && (
          <section className="mt-10" aria-labelledby="matieres-heading">
            <h2 id="matieres-heading" className={TITRE_DE_BLOC}>
              Les matières de ton niveau
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {monNiveau.matieres.map(({ matiereCode, matiereLibelle, chapitres }) => (
                <li key={matiereCode}>
                  <CarteLien href={`/${monNiveau.niveauCode}/${matiereCode}`}>
                    <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                      {matiereLibelle}
                    </span>
                    <span className="flex items-center justify-between font-prose text-sm text-ink-muted">
                      {chapitres.length} chapitre{chapitres.length > 1 ? 's' : ''}
                      <Fleche />
                    </span>
                  </CarteLien>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10" aria-labelledby="annales-heading">
          <h2 id="annales-heading" className={TITRE_DE_BLOC}>
            S&rsquo;entraîner
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <li>
              <CarteLien href="/annales">
                <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                  Annales
                </span>
                <span className="flex items-center justify-between font-prose text-sm text-ink-muted">
                  De vrais sujets d&rsquo;examen
                  <Fleche />
                </span>
              </CarteLien>
            </li>
          </ul>
        </section>
      </main>
    </div>
  )
}
