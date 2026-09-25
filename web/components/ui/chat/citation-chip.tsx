import { Icon } from '../icon'

// La pastille de citation du tuteur et la référence d'un cours d'enseignant sont la même chose
// (ADR 0019 §2). Sans `href`, c'est un bouton (le tuteur ouvre un panneau) ; avec `href`, c'est un
// lien — imbriquer un bouton dans un lien serait du HTML invalide. `external` ouvre un nouvel onglet.
type CitationChipProps = {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  external?: boolean
}

const CHIP_CLASSES =
  'mt-2 inline-flex items-center gap-1.5 rounded-pill border border-line bg-accent-soft px-3 py-1.5 font-display text-xs font-extrabold text-accent-ink transition-colors duration-[var(--duration-fast)] hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page'

export function CitationChip({ children, onClick, href, external }: CitationChipProps) {
  const content = (
    <>
      <Icon name="book-open" size={12} aria-hidden="true" />
      {children}
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={CHIP_CLASSES}
      >
        {content}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} className={CHIP_CLASSES}>
      {content}
    </button>
  )
}
