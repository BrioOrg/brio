import { cookies } from 'next/headers'
import Link from 'next/link'

import { BandeauDevoirVue } from '@/components/bandeau-devoir'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { ChapterView, type ChapitreResponse } from '@/components/chapter-view'
import { getCoursPublie } from '@/lib/api'
import { lireDevoirs } from '@/lib/espace-eleve'
import { SiteHeader } from '@/components/site-header'
import { ChapterRail } from '@/components/chapter-rail'
import { ChapterToolsSheet } from '@/components/chapter-tools-sheet'
import { ChapterInteractionProvider } from '@/components/chapter-interaction-context'
import { tutorRequestCap } from '@/lib/tutor-config'

// A teacher course lives outside the public catalogue tree, so it has no niveau/matiere
// breadcrumb or sibling-chapter sidebar. Same reader, same <ChapterView/> — the content is
// indistinguishable from a catalogue chapter (ADR 0019 §1); only the surrounding nav differs.
export default async function CoursPage({
  params,
  searchParams,
}: {
  params: Promise<{ coursId: string }>
  searchParams: Promise<{ devoir?: string | string[] }>
}) {
  const { coursId } = await params
  // Opened from a homework (#370): a repeated `?devoir=` is ignored.
  const { devoir } = await searchParams
  const devoirId = typeof devoir === 'string' ? devoir : undefined

  // The course is scoped to classes: relay the student's session to the API. The homework is
  // found on the server, alongside the course, so the banner is in the first paint (no layout
  // shift). A failed read finds none.
  const cookie = (await cookies()).toString()
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
        <SiteHeader crumbs={[{ label: 'Cours' }]} />
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
          {devoirEleve && (
            <div className="mt-4">
              <Link href="/ma-classe">
                <Button variant="secondary" size="sm" tabIndex={-1}>
                  <Icon name="arrow-left" size={16} aria-hidden="true" />
                  Retour à mes devoirs
                </Button>
              </Link>
            </div>
          )}
        </main>
      </div>
    )
  }

  const railSections = cours.sections.map((s) => ({ id: s.id, title: s.title }))
  const tutorTarget = { kind: 'cours' as const, coursId }

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: cours.title }]} />

      <ChapterInteractionProvider tutorRequestCap={tutorRequestCap()}>
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_312px] lg:gap-8 lg:pb-12">
          <main className="min-w-0">
            <div className="mx-auto max-w-[68ch]">
              {devoirAffiche && (
                <BandeauDevoirVue
                  enseignant={devoirAffiche.enseignant}
                  echeanceAt={devoirAffiche.echeanceAt}
                />
              )}
              <ChapterView chapitre={cours} />
            </div>
          </main>

          <ChapterRail sections={railSections} target={tutorTarget} />
        </div>

        <ChapterToolsSheet sections={railSections} target={tutorTarget} />
      </ChapterInteractionProvider>
    </div>
  )
}
