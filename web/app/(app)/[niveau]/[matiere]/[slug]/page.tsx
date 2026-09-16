import Link from 'next/link'
import { ChapterView, type ChapitreResponse } from '@/components/chapter-view'
import { getCatalogue, getChapitreByTriplet } from '@/lib/api'
import { SiteHeader, type Crumb } from '@/components/site-header'
import { ChapterSidebar, ChapterSidebarMobile } from '@/components/chapter-sidebar'
import { ChapterRail } from '@/components/chapter-rail'
import { ChapterToolsSheet } from '@/components/chapter-tools-sheet'
import { ChapterInteractionProvider } from '@/components/chapter-interaction-context'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'

export const dynamicParams = true

export async function generateStaticParams() {
  try {
    const catalogue = await getCatalogue()
    return catalogue.flatMap(({ niveauCode, matieres }) =>
      matieres.flatMap(({ matiereCode, chapitres }) =>
        chapitres.map(({ slug }) => ({ niveau: niveauCode, matiere: matiereCode, slug }))
      )
    )
  } catch {
    return []
  }
}

type NavContext = {
  crumbs: Crumb[]
  matiereLibelle: string
  chapters: { slug: string; titre: string }[]
}

// Best-effort: the sidebar + breadcrumb come from the catalogue, but a missing
// catalogue must not break the reading page. Fall back to codes.
async function loadNavContext(niveau: string, matiere: string): Promise<NavContext> {
  try {
    const catalogue = await getCatalogue()
    const niveauEntry = catalogue.find((n) => n.niveauCode === niveau)
    const matiereEntry = niveauEntry?.matieres.find((m) => m.matiereCode === matiere)
    if (niveauEntry && matiereEntry) {
      return {
        crumbs: [
          { label: niveauEntry.niveauLibelle, href: `/${niveau}` },
          { label: matiereEntry.matiereLibelle, href: `/${niveau}/${matiere}` },
        ],
        matiereLibelle: matiereEntry.matiereLibelle,
        chapters: matiereEntry.chapitres.map((c) => ({ slug: c.slug, titre: c.titre })),
      }
    }
  } catch {
    /* fall through */
  }
  return {
    crumbs: [
      { label: niveau, href: `/${niveau}` },
      { label: matiere, href: `/${niveau}/${matiere}` },
    ],
    matiereLibelle: matiere,
    chapters: [],
  }
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ niveau: string; matiere: string; slug: string }>
}) {
  const { niveau, matiere, slug } = await params
  const nav = await loadNavContext(niveau, matiere)

  let chapitre: ChapitreResponse | null = null
  try {
    chapitre = await getChapitreByTriplet(niveau, matiere, slug)
  } catch {
    chapitre = null
  }

  if (!chapitre) {
    return (
      <div className="min-h-screen bg-surface-page font-prose text-ink">
        <SiteHeader crumbs={nav.crumbs} />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <div
            role="alert"
            className="rounded-lg border border-warning/40 bg-warning/10 p-5 text-ink"
          >
            <p className="font-display text-lg font-extrabold text-ink">Chapitre introuvable</p>
            <p className="mt-1 font-prose text-sm text-ink-muted">
              Le chapitre demandé n&rsquo;est pas disponible pour le moment.
            </p>
            <div className="mt-4">
              <Link href={`/${niveau}/${matiere}`}>
                <Button variant="secondary" size="sm">
                  <Icon name="arrow-left" size={16} aria-hidden="true" />
                  Retour au parcours
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const crumbs: Crumb[] = [...nav.crumbs, { label: chapitre.title }]
  const railSections = chapitre.sections.map((s) => ({ id: s.id, title: s.title }))

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={crumbs} />

      <ChapterInteractionProvider>
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:grid lg:grid-cols-[248px_minmax(0,1fr)_312px] lg:gap-8 lg:pb-12">
          <ChapterSidebar
            niveau={niveau}
            matiere={matiere}
            matiereLibelle={nav.matiereLibelle}
            chapters={nav.chapters}
            currentSlug={slug}
          />

          <main className="min-w-0">
            <ChapterSidebarMobile
              niveau={niveau}
              matiere={matiere}
              matiereLibelle={nav.matiereLibelle}
              chapters={nav.chapters}
              currentSlug={slug}
            />

            <div className="mx-auto max-w-[68ch]">
              <ChapterView chapitre={chapitre} />
            </div>
          </main>

          <ChapterRail sections={railSections} niveau={niveau} matiere={matiere} slug={slug} />
        </div>

        <ChapterToolsSheet sections={railSections} niveau={niveau} matiere={matiere} slug={slug} />
      </ChapterInteractionProvider>
    </div>
  )
}
