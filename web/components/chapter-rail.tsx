import { Icon } from '@/components/ui/icon'

export type RailSection = { id: string; title: string }

/**
 * Rail content: the on-page summary (jump links) and the space reserved for the
 * tutor. The tutor panel itself ships later (issue #49 only reserves its place);
 * until then this shows an honest "bientôt" teaser — never fabricated state.
 */
export function RailContent({
  sections,
  onNavigate,
}: {
  sections: RailSection[]
  onNavigate?: () => void
}) {
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

      <section
        aria-label="Tuteur"
        className="rounded-lg border border-dashed border-accent/40 bg-accent-soft/40 p-4 text-center"
      >
        <span
          className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent"
          aria-hidden="true"
        >
          <Icon name="chat-circle" size={22} weight="bold" />
        </span>
        <p className="font-display text-sm font-extrabold text-ink">Ton tuteur</p>
        <p className="mt-1 font-prose text-xs leading-relaxed text-ink-muted">
          Il vivra ici, à côté de ton cours, pour t&rsquo;aider à partir de la leçon.
        </p>
        <span className="mt-2 inline-flex items-center gap-1 rounded-pill border border-accent/30 bg-accent-soft px-2.5 py-0.5 font-display text-xs font-extrabold text-accent-ink">
          Bientôt
        </span>
      </section>
    </div>
  )
}

/** Desktop sticky rail. */
export function ChapterRail({ sections }: { sections: RailSection[] }) {
  return (
    <aside aria-label="Sommaire et tuteur" className="hidden lg:block">
      <div className="sticky top-[4.5rem] max-h-[calc(100vh-6rem)] overflow-y-auto pb-6">
        <RailContent sections={sections} />
      </div>
    </aside>
  )
}
