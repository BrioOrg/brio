import Link from 'next/link'
import { Icon } from '@/components/ui/icon'

/**
 * The way from the student pages to the Communauté moderation console (/admin/communaute) for an
 * `admin_brio` (suivi #338, ADR 0044 §5). Same shape as the teacher-space link: shown at every
 * width, icon only below lg, the label kept for screen readers.
 */
export function ConsoleModerationLink() {
  return (
    <Link
      href="/admin/communaute"
      className="flex items-center gap-2 rounded-md px-2 py-1.5 font-display text-sm font-bold text-ink-muted transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel lg:px-3"
    >
      <Icon name="flag" size={20} />
      <span className="sr-only lg:not-sr-only">Modération</span>
    </Link>
  )
}
