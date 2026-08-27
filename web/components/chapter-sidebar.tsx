import Link from 'next/link'
import { Icon } from '@/components/ui/icon'

export type ChapterNavItem = { slug: string; titre: string }

type Props = {
  niveau: string
  matiere: string
  matiereLibelle: string
  chapters: ChapterNavItem[]
  currentSlug: string
}

function NavList({ niveau, matiere, chapters, currentSlug }: Omit<Props, 'matiereLibelle'>) {
  return (
    <ol className="flex flex-col gap-1">
      {chapters.map(({ slug, titre }, i) => {
        const current = slug === currentSlug
        return (
          <li key={slug}>
            <Link
              href={`/${niveau}/${matiere}/${slug}`}
              aria-current={current ? 'page' : undefined}
              className={[
                'flex items-start gap-2.5 rounded-md border px-3 py-2.5 font-prose text-sm transition-colors duration-[var(--duration-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                current
                  ? 'border-accent/40 bg-accent-soft font-semibold text-ink'
                  : 'border-transparent text-ink-muted hover:bg-surface-raised hover:text-ink',
              ].join(' ')}
            >
              <span
                className={[
                  'mt-px font-display text-xs font-black tabular-nums',
                  current ? 'text-accent' : 'text-ink-muted',
                ].join(' ')}
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0">{titre}</span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

/** Desktop sticky sidebar — the chapter list for the current subject. */
export function ChapterSidebar(props: Props) {
  return (
    <aside aria-label={`Chapitres — ${props.matiereLibelle}`} className="hidden lg:block">
      <div className="sticky top-[4.5rem] max-h-[calc(100vh-6rem)] overflow-y-auto pb-6">
        <p className="mb-3 flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
          <Icon name="book-open" size={14} aria-hidden="true" />
          {props.matiereLibelle}
        </p>
        <NavList {...props} />
      </div>
    </aside>
  )
}

/** Mobile / tablet — the same list inside a native disclosure at the top. */
export function ChapterSidebarMobile(props: Props) {
  const currentIndex = props.chapters.findIndex((c) => c.slug === props.currentSlug)
  return (
    <details className="group mb-6 rounded-lg border border-line bg-surface-panel lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-display text-sm font-extrabold text-ink [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Icon name="book-open" size={16} className="text-accent" aria-hidden="true" />
          {props.matiereLibelle}
          <span className="font-prose text-xs font-normal text-ink-muted">
            · chapitre {currentIndex + 1}/{props.chapters.length}
          </span>
        </span>
        <Icon
          name="caret-right"
          size={16}
          className="text-ink-muted transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-line px-2 pb-2 pt-2">
        <NavList {...props} />
      </div>
    </details>
  )
}
