import Link from 'next/link'
import { cookies } from 'next/headers'
import { buildDeck } from '@brio/content'
import {
  ChapterView,
  etapesParBloc,
  exercicesCorriges,
  exercicesParBloc,
  type ChapitreResponse,
} from '@/components/chapter-view'
import { getCatalogue, getChapitreByTriplet } from '@/lib/api'
import { SiteHeader, type Crumb } from '@/components/site-header'
import { ChapterSidebar, ChapterSidebarMobile } from '@/components/chapter-sidebar'
import { ChapterRail } from '@/components/chapter-rail'
import { ChapterToolsSheet } from '@/components/chapter-tools-sheet'
import { ChapterInteractionProvider } from '@/components/chapter-interaction-context'
import { ChapterProgress } from '@/components/chapter-progress'
import { EntraideProvider } from '@/components/entraide/entraide-context'
import { tutorRequestCap } from '@/lib/tutor-config'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { AideScene } from '@/components/chapitre-interactif/aide-scene'
import { ModeChapitreProvider } from '@/components/chapitre-interactif/mode-context'
import {
  BandeDiapos,
  BarreScene,
  BasculeInteractif,
  CommandesScene,
  TiroirDiapos,
} from '@/components/chapitre-interactif/scene'
import { MODE_COOKIE, indexDiapo, modeInitial } from '@/lib/diapos'

// Rendered per request: the catalogue changes on re-ingestion or reset, and a page
// cached at first render would keep serving the old content (#154).
export const dynamic = 'force-dynamic'

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
          { label: 'Explorer', href: '/explorer' },
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
      { label: 'Explorer', href: '/explorer' },
      { label: niveau, href: `/${niveau}` },
      { label: matiere, href: `/${niveau}/${matiere}` },
    ],
    matiereLibelle: matiere,
    chapters: [],
  }
}

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ niveau: string; matiere: string; slug: string }>
  searchParams: Promise<{ diapo?: string | string[] }>
}) {
  const { niveau, matiere, slug } = await params
  const { diapo } = await searchParams
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
  const tutorTarget = { kind: 'chapitre' as const, niveau, matiere, slug }

  // Interactive mode (ADR 0032): the server picks the mode and the slide, so the first paint is
  // the right one, with no flash.
  const deck = buildDeck(chapitre)
  const diapoDemandee = typeof diapo === 'string' ? diapo : undefined
  const mode = modeInitial(diapoDemandee, (await cookies()).get(MODE_COOKIE)?.value)
  // The end slide's main action (#249): the next chapter in catalogue order, if any.
  const place = nav.chapters.findIndex((c) => c.slug === slug)
  const prochain = place === -1 ? undefined : nav.chapters[place + 1]
  const suivant = prochain
    ? { slug: prochain.slug, titre: prochain.titre, href: `/${niveau}/${matiere}/${prochain.slug}` }
    : null
  const sectionTitles = Object.fromEntries(chapitre.sections.map((s) => [s.id, s.title]))

  return (
    <ModeChapitreProvider
      chapitreId={chapitre.id}
      deck={deck}
      exercices={exercicesCorriges(chapitre)}
      etapes={etapesParBloc(chapitre)}
      sectionTitles={sectionTitles}
      chemin={`/${niveau}/${matiere}/${slug}`}
      parcoursHref={`/${niveau}/${matiere}`}
      niveau={niveau}
      matiere={matiere}
      slug={slug}
      suivant={suivant}
      initialMode={mode}
      initialIndex={indexDiapo(deck, diapoDemandee)}
    >
      <SeulementEnLecture>
        <SiteHeader crumbs={crumbs} />
      </SeulementEnLecture>
      <BarreScene />

      <ChapterInteractionProvider tutorRequestCap={tutorRequestCap()}>
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:grid lg:grid-cols-[248px_minmax(0,1fr)_312px] lg:gap-8 lg:pb-12 group-data-[chapitre-mode=interactif]/mode:w-full group-data-[chapitre-mode=interactif]/mode:flex-1 group-data-[chapitre-mode=interactif]/mode:pb-0 group-data-[chapitre-mode=interactif]/mode:max-lg:flex group-data-[chapitre-mode=interactif]/mode:max-lg:flex-col group-data-[chapitre-mode=interactif]/mode:lg:grid-cols-[auto_minmax(0,1fr)]">
          <SeulementEnLecture>
            <ChapterSidebar
              niveau={niveau}
              matiere={matiere}
              matiereLibelle={nav.matiereLibelle}
              chapters={nav.chapters}
              currentSlug={slug}
            />
          </SeulementEnLecture>
          <BandeDiapos />

          {/* Interactive mode: the slide fills the screen, so its bar sits at the bottom (#246). */}
          <main className="min-w-0 group-data-[chapitre-mode=interactif]/mode:flex group-data-[chapitre-mode=interactif]/mode:flex-1 group-data-[chapitre-mode=interactif]/mode:flex-col">
            <SeulementEnLecture>
              <ChapterSidebarMobile
                niveau={niveau}
                matiere={matiere}
                matiereLibelle={nav.matiereLibelle}
                chapters={nav.chapters}
                currentSlug={slug}
              />
            </SeulementEnLecture>

            <div className="mx-auto max-w-[68ch] group-data-[chapitre-mode=interactif]/mode:flex group-data-[chapitre-mode=interactif]/mode:w-full group-data-[chapitre-mode=interactif]/mode:flex-1 group-data-[chapitre-mode=interactif]/mode:flex-col">
              <BasculeInteractif />
              {/* Reading mode only: the interactive mode has the deck's position bar, and the end
                  slide draws its own completion, so the gauge would double it here (#240). */}
              <SeulementEnLecture>
                <ChapterProgress niveau={niveau} matiere={matiere} slug={slug} />
              </SeulementEnLecture>
              <EntraideProvider>
                <ChapterView chapitre={chapitre} deck={deck} />
              </EntraideProvider>
              <CommandesScene />
            </div>
          </main>

          <SeulementEnLecture>
            <ChapterRail sections={railSections} target={tutorTarget} />
          </SeulementEnLecture>
        </div>

        <SeulementEnLecture>
          <ChapterToolsSheet sections={railSections} target={tutorTarget} />
        </SeulementEnLecture>
        {/* Interactive mode: the rail is hidden, the tutor and entraide open in a drawer (#250). */}
        <AideScene target={tutorTarget} exercices={exercicesParBloc(chapitre)} />
      </ChapterInteractionProvider>
      <TiroirDiapos />
    </ModeChapitreProvider>
  )
}

/**
 * Reading-mode chrome: the site header, the chapter list, the tutor rail. Hidden by CSS in
 * interactive mode (the "cinema" mode of #240), never unmounted, so the server renders the right
 * mode and switching keeps their state. `display: contents` keeps the grid layout intact.
 */
function SeulementEnLecture({ children }: { children: React.ReactNode }) {
  return (
    <div className="contents group-data-[chapitre-mode=interactif]/mode:hidden">{children}</div>
  )
}
