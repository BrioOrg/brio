import Link from 'next/link'

import { Icon } from '@/components/ui/icon'

const CARTE =
  'group flex h-full flex-col justify-between gap-6 rounded-lg border bg-surface-panel p-5 transition-[transform,border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-accent hover:[box-shadow:0_5px_0_var(--color-accent-edge)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page'

/** A clickable card of the student pages: Explorer's levels and subjects, Accueil's blocks. */
export function CarteLien({
  href,
  enAvant = false,
  children,
}: {
  href: string
  enAvant?: boolean
  children: React.ReactNode
}) {
  return (
    <Link href={href} className={[CARTE, enAvant ? 'border-accent' : 'border-line'].join(' ')}>
      {children}
    </Link>
  )
}

/** The card's arrow, which moves when the card is hovered. */
export function Fleche() {
  return (
    <Icon
      name="arrow-right"
      size={18}
      className="text-ink-muted transition-transform duration-[var(--duration-base)] group-hover:translate-x-1 group-hover:text-accent"
    />
  )
}

export const TITRE_DE_BLOC =
  'mb-4 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted'
