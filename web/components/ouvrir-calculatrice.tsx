import Link from 'next/link'

import { Icon } from '@/components/ui/icon'

// Under a course figure with functions: continue in the graphing calculator (ADR 0049 §5, #423).
// Same tab, so the browser's back returns to the chapter. Not printed.

export function OuvrirCalculatrice({ href }: { href: string }) {
  return (
    <p className="mt-1 flex justify-center print:hidden">
      <Link
        href={href}
        aria-label="Ouvrir cette figure dans la calculatrice graphique"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 font-display text-sm font-bold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Icon name="function" size={16} weight="bold" />
        Ouvrir dans la calculatrice
      </Link>
    </p>
  )
}
