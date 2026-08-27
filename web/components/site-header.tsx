import Link from 'next/link'
import { Icon } from '@/components/ui/icon'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export type Crumb = { label: string; href?: string }

/**
 * Top bar shared by every page: brand wordmark, a breadcrumb trail, theme toggle.
 * The breadcrumb is the app's primary "where am I" signal on desktop; on narrow
 * screens the intermediate crumbs collapse so only the current context shows.
 */
export function SiteHeader({ crumbs = [] }: { crumbs?: Crumb[] }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface-panel/95 backdrop-blur supports-[backdrop-filter]:bg-surface-panel/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg font-black tracking-tight text-ink rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel"
          aria-label="brio — accueil"
        >
          br<span className="text-accent">io</span>
        </Link>

        {crumbs.length > 0 && (
          <nav aria-label="Fil d'ariane" className="flex min-w-0 items-center gap-1.5">
            <Icon name="caret-right" size={14} className="text-ink-muted/60 shrink-0" />
            <ol className="flex min-w-0 items-center gap-1.5">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1
                // On mobile, hide all but the last crumb to keep the bar clean.
                return (
                  <li
                    key={`${c.label}-${i}`}
                    className={[
                      'flex min-w-0 items-center gap-1.5',
                      last ? '' : 'hidden sm:flex',
                    ].join(' ')}
                  >
                    {c.href && !last ? (
                      <Link
                        href={c.href}
                        className="truncate font-prose text-sm text-ink-muted hover:text-ink rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {c.label}
                      </Link>
                    ) : (
                      <span
                        aria-current={last ? 'page' : undefined}
                        className={[
                          'truncate font-prose text-sm',
                          last ? 'font-semibold text-ink' : 'text-ink-muted',
                        ].join(' ')}
                      >
                        {c.label}
                      </span>
                    )}
                    {!last && (
                      <Icon
                        name="caret-right"
                        size={14}
                        className="hidden shrink-0 text-ink-muted/60 sm:block"
                      />
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        )}

        <div className="ml-auto shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
