import Link from 'next/link'
import { Icon } from '@/components/ui/icon'

/**
 * The way from the student pages to the teacher space (/prof). Shown at every
 * width — BottomNav only carries student sections, so on mobile this is the
 * teacher's sole route. Below lg the bar is too narrow for a label, so the link
 * shows its icon only; the label stays for screen readers.
 */
export function EspaceEnseignantLink() {
  return (
    <Link
      href="/prof"
      className="flex items-center gap-2 rounded-md px-2 py-1.5 font-display text-sm font-bold text-ink-muted transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel lg:px-3"
    >
      <Icon name="chalkboard" size={20} />
      <span className="sr-only lg:not-sr-only">Espace enseignant</span>
    </Link>
  )
}
