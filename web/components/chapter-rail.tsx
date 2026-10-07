'use client'

import * as Tabs from '@radix-ui/react-tabs'
import { EntraidePanel } from '@/components/entraide/entraide-panel'
import { TuteurPanel } from '@/components/tutor-panel'
import type { TutorTarget } from '@/lib/api'

export type RailSection = { id: string; title: string }

export type RailProps = {
  sections: RailSection[]
  target: TutorTarget
  onNavigate?: () => void
}

export function RailContent({ sections, target, onNavigate }: RailProps) {
  return (
    <div className="flex flex-col gap-6">
      {sections.length > 1 && (
        <nav aria-label="Sur cette page">
          <p className="mb-3 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
            Sur cette page
          </p>
          <ul className="flex flex-col gap-0.5 border-l border-line">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={onNavigate}
                  className="-ml-px block border-l-2 border-transparent py-1.5 pl-3 font-prose text-sm text-ink-muted transition-colors hover:border-accent hover:text-ink focus-visible:outline-none focus-visible:text-ink"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {target.kind === 'chapitre' ? (
        <TuteurEtEntraide target={target} slug={target.slug} />
      ) : (
        <TuteurPanel target={target} />
      )}
    </div>
  )
}

const ONGLET =
  'flex-1 rounded-md px-3 py-1.5 font-display text-sm font-extrabold text-ink-muted transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=active]:bg-surface-raised data-[state=active]:text-ink'

/**
 * On a catalogue chapter the tutor shares the rail with the class entraide (ADR 0023). Both
 * panels stay mounted, so switching tabs keeps the tutor conversation and the open thread.
 */
function TuteurEtEntraide({ target, slug }: { target: TutorTarget; slug: string }) {
  return (
    <Tabs.Root defaultValue="tuteur" className="flex flex-col gap-4">
      <Tabs.List
        aria-label="Aide sur ce chapitre"
        className="flex gap-1 rounded-lg border border-line bg-surface-panel p-1"
      >
        <Tabs.Trigger value="tuteur" className={ONGLET}>
          Tuteur
        </Tabs.Trigger>
        <Tabs.Trigger value="entraide" className={ONGLET}>
          Entraide
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="tuteur" forceMount className="data-[state=inactive]:hidden">
        <TuteurPanel target={target} />
      </Tabs.Content>
      <Tabs.Content value="entraide" forceMount className="data-[state=inactive]:hidden">
        <EntraidePanel portee="chapitre" porteeRef={slug} />
      </Tabs.Content>
    </Tabs.Root>
  )
}

/** Desktop sticky rail. */
export function ChapterRail({ sections, target }: Omit<RailProps, 'onNavigate'>) {
  return (
    <aside aria-label="Sommaire et tuteur" className="hidden lg:block">
      <div className="sticky top-[4.5rem] max-h-[calc(100vh-6rem)] overflow-y-auto pb-6">
        <RailContent sections={sections} target={target} />
      </div>
    </aside>
  )
}
