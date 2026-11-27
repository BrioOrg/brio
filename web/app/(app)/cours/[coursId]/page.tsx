import { cookies } from 'next/headers'
import Link from 'next/link'
import { buildDeck } from '@brio/content'

import { BandeauDevoirVue } from '@/components/bandeau-devoir'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  ChapterView,
  etapesParBloc,
  exercicesCorriges,
  exercicesParBloc,
  type ChapitreResponse,
} from '@/components/chapter-view'
import { getCoursPublie } from '@/lib/api'
import { lireDevoirs } from '@/lib/espace-eleve'
import { SiteHeader } from '@/components/site-header'
import { ChapterRail } from '@/components/chapter-rail'
import { LessonWrittenExercises } from '@/components/exercices-rediges/lesson-written-exercises'
import { ChapterToolsSheet } from '@/components/chapter-tools-sheet'
import { ChapterInteractionProvider } from '@/components/chapter-interaction-context'
import { ChapterProgress } from '@/components/chapter-progress'
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
import { tutorRequestCap } from '@/lib/tutor-config'

// A teacher course lives outside the public catalogue tree, so it has no niveau/matiere
// breadcrumb or sibling-chapter sidebar: its trail is « Ma classe › Cours de ta classe › title » (#398).
// Same reader, same <ChapterView/> — the content is indistinguishable from a catalogue chapter
// (ADR 0019 §1); only the surrounding nav differs.
const FIL = [
  { label: 'Ma classe', href: '/ma-classe' },
  { label: 'Cours de ta classe', href: '/ma-classe/cours' },
] as const

export default async function CoursPage({
  params,
  searchParams,
}: {
  params: Promise<{ coursId: string }>
  searchParams: Promise<{ devoir?: string | string[]; diapo?: string | string[] }>
}) {
  const { coursId } = await params
  // Opened from a homework (#370): a repeated `?devoir=` is ignored.
  const { devoir, diapo } = await searchParams
  const devoirId = typeof devoir === 'string' ? devoir : undefined

  // The course is scoped to classes: relay the student's session to the API. The homework is
  // found on the server, alongside the course, so the banner is in the first paint (no layout
  // shift). A failed read finds none.
  const jar = await cookies()
  const cookie = jar.toString()
  const [cours, devoirs] = await Promise.all([
    getCoursPublie(coursId, cookie).catch((): ChapitreResponse | null => null),
    devoirId === undefined ? null : lireDevoirs(cookie).catch(() => null),
  ])
  // One of the student's own homework, whatever it points to: it keeps its way back even when
  // its course is unavailable. A teacher, a student without a class or a forged id has none.
  const devoirEleve = devoirs?.find((d) => d.id === devoirId) ?? null
  // The banner only for a homework pointing to this very course.
  const devoirAffiche =
    devoirEleve?.sourceType === 'cours' && devoirEleve.sourceRef === coursId ? devoirEleve : null

  if (!cours) {
    return (
      <div className="min-h-screen bg-surface-page font-prose text-ink">
        <SiteHeader crumbs={[...FIL, { label: 'Cours indisponible' }]} />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <div
            role="alert"
            className="rounded-lg border border-warning/40 bg-warning/10 p-5 text-ink"
          >
            <p className="font-display text-lg font-extrabold text-ink">Cours indisponible</p>
            <p className="mt-1 font-prose text-sm text-ink-muted">
              Ce cours n&rsquo;est pas disponible, ou n&rsquo;est pas accessible avec ton compte.
            </p>
          </div>
          {/* Below the alert, not inside it: the link colour lacks contrast on the warning tint. */}
          <div className="mt-4">
            <Link href={devoirEleve ? '/ma-classe' : '/ma-classe/cours'}>
              <Button variant="secondary" size="sm" tabIndex={-1}>
                <Icon name="arrow-left" size={16} aria-hidden="true" />
                {devoirEleve ? 'Retour à mes devoirs' : 'Voir les cours de ta classe'}
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const railSections = cours.sections.map((s) => ({ id: s.id, title: s.title }))
  const tutorTarget = { kind: 'cours' as const, coursId }

  // Interactive mode, as on a chapter (ADR 0032, ADR 0050 §7): the server picks the mode and the
  // slide, so the first paint is the right one. A course has no next one: the end slide sends back
  // to the courses of the class.
  const deck = buildDeck(cours)
  const diapoDemandee = typeof diapo === 'string' ? diapo : undefined
  const mode = modeInitial(diapoDemandee, jar.get(MODE_COOKIE)?.value)
  const sectionTitles = Object.fromEntries(cours.sections.map((s) => [s.id, s.title]))

  return (
    <ModeChapitreProvider
      coursId={coursId}
      deck={deck}
      exercices={exercicesCorriges(cours)}
      etapes={etapesParBloc(cours)}
      sectionTitles={sectionTitles}
      chemin={`/cours/${encodeURIComponent(coursId)}`}
      parcoursHref="/ma-classe/cours"
      initialMode={mode}
      initialIndex={indexDiapo(deck, diapoDemandee)}
    >
      <SeulementEnLecture>
        <SiteHeader crumbs={[...FIL, { label: cours.title }]} />
      </SeulementEnLecture>
      <BarreScene />

      <ChapterInteractionProvider tutorRequestCap={tutorRequestCap()}>
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_312px] lg:gap-8 lg:pb-12 group-data-[chapitre-mode=interactif]/mode:w-full group-data-[chapitre-mode=interactif]/mode:max-w-7xl group-data-[chapitre-mode=interactif]/mode:flex-1 group-data-[chapitre-mode=interactif]/mode:pb-0 group-data-[chapitre-mode=interactif]/mode:max-lg:flex group-data-[chapitre-mode=interactif]/mode:max-lg:flex-col group-data-[chapitre-mode=interactif]/mode:lg:grid-cols-[auto_minmax(0,1fr)]">
          <BandeDiapos />

          {/* Interactive mode: the slide fills the screen, so its bar sits at the bottom (#246). */}
          <main className="min-w-0 group-data-[chapitre-mode=interactif]/mode:flex group-data-[chapitre-mode=interactif]/mode:flex-1 group-data-[chapitre-mode=interactif]/mode:flex-col">
            <div className="mx-auto max-w-[68ch] group-data-[chapitre-mode=interactif]/mode:flex group-data-[chapitre-mode=interactif]/mode:w-full group-data-[chapitre-mode=interactif]/mode:flex-1 group-data-[chapitre-mode=interactif]/mode:flex-col">
              {devoirAffiche && (
                <BandeauDevoirVue
                  enseignant={devoirAffiche.enseignant}
                  echeanceAt={devoirAffiche.echeanceAt}
                />
              )}
              <BasculeInteractif />
              {devoirId === undefined && <LessonWrittenExercises lesson={{ coursId }} />}
              {/* Reading mode only: the end slide draws its own completion (#240). */}
              <SeulementEnLecture>
                <ChapterProgress coursId={coursId} />
              </SeulementEnLecture>
              <ChapterView chapitre={cours} deck={deck} />
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
        {/* Interactive mode: the rail is hidden, the tutor opens in a drawer (#250). */}
        <AideScene target={tutorTarget} exercices={exercicesParBloc(cours)} />
      </ChapterInteractionProvider>
      <TiroirDiapos />
    </ModeChapitreProvider>
  )
}

/**
 * Reading-mode chrome: the site header, the tutor rail and sheet. Hidden by CSS in interactive mode,
 * never unmounted, as on a chapter page. `display: contents` keeps the grid layout intact.
 */
function SeulementEnLecture({ children }: { children: React.ReactNode }) {
  return (
    <div className="contents group-data-[chapitre-mode=interactif]/mode:hidden">{children}</div>
  )
}
