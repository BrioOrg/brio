import { cookies } from 'next/headers'
import { ChapterView, type ChapitreResponse } from '@/components/chapter-view'
import { getCoursPublie } from '@/lib/api'
import { SiteHeader } from '@/components/site-header'
import { ChapterRail } from '@/components/chapter-rail'
import { ChapterToolsSheet } from '@/components/chapter-tools-sheet'
import { ChapterInteractionProvider } from '@/components/chapter-interaction-context'

// A teacher course lives outside the public catalogue tree, so it has no niveau/matiere
// breadcrumb or sibling-chapter sidebar. Same reader, same <ChapterView/> — the content is
// indistinguishable from a catalogue chapter (ADR 0019 §1); only the surrounding nav differs.
export default async function CoursPage({ params }: { params: Promise<{ coursId: string }> }) {
  const { coursId } = await params

  // The course endpoint is authenticated + portée-scoped: forward the student's session
  // cookie so the server-side fetch is made as the logged-in student, not anonymously.
  const cookieHeader = (await cookies()).toString()

  let cours: ChapitreResponse | null = null
  try {
    cours = await getCoursPublie(coursId, cookieHeader)
  } catch {
    cours = null
  }

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
        </main>
      </div>
    )
  }

  const railSections = cours.sections.map((s) => ({ id: s.id, title: s.title }))
  const tutorTarget = { kind: 'cours' as const, coursId }

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: cours.title }]} />

      <ChapterInteractionProvider>
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_312px] lg:gap-8 lg:pb-12">
          <main className="min-w-0">
            <div className="mx-auto max-w-[68ch]">
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
