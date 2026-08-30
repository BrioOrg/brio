import { TuteurPanel } from '@/components/tutor-panel'

export type RailSection = { id: string; title: string }

export type RailProps = {
  sections: RailSection[]
  niveau: string
  matiere: string
  slug: string
  onNavigate?: () => void
}

export function RailContent({ sections, niveau, matiere, slug, onNavigate }: RailProps) {
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

      <TuteurPanel niveau={niveau} matiere={matiere} slug={slug} />
    </div>
  )
}

/** Desktop sticky rail. */
export function ChapterRail({ sections, niveau, matiere, slug }: Omit<RailProps, 'onNavigate'>) {
  return (
    <aside aria-label="Sommaire et tuteur" className="hidden lg:block">
      <div className="sticky top-[4.5rem] max-h-[calc(100vh-6rem)] overflow-y-auto pb-6">
        <RailContent sections={sections} niveau={niveau} matiere={matiere} slug={slug} />
      </div>
    </aside>
  )
}
