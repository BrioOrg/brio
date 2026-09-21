import { notFound } from 'next/navigation'
import { getCatalogue } from '@/lib/api'
import { SiteHeader } from '@/components/site-header'
import { ChapterAtlas } from '@/components/chapter-atlas'
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
            <ChapterAtlas
              niveau={niveau}
              matiere={matiere}
              matiereLibelle={matiereEntry.matiereLibelle}
              chapters={matiereEntry.chapitres}
            />
          )}
        </section>
      </main>
    </div>
  )
}
