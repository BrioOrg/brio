'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { useMenuDansEcran } from '@/components/ui/use-menu-dans-ecran'

/** One entry of the menu. The list grows with the user's options (account, logout…). */
type EntreeMenu = { href: string; label: string; icon: string }

const ENTREES: EntreeMenu[] = [{ href: '/parametres', label: 'Paramètres', icon: 'gear-six' }]

/**
 * The burger menu at the end of the top bar, in the student shell and in the teacher space:
 * the way to the user's own options (Paramètres). A disclosure button (`aria-expanded`) opening
 * an ARIA menu: the first entry takes the focus, arrow keys move between entries, Escape closes
 * and gives the focus back to the button, Tab or a click outside closes.
 */
export function MenuBurger() {
  const [ouvert, setOuvert] = useState(false)
  const conteneurRef = useRef<HTMLDivElement>(null)
  const boutonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const { placement, hauteurMax, surToucheMenu } = useMenuDansEcran(ouvert, boutonRef, menuRef)

  useEffect(() => {
    if (!ouvert) return
    function surClic(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setOuvert(false)
      }
    }
    function surTouche(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOuvert(false)
        boutonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', surClic)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('mousedown', surClic)
      document.removeEventListener('keydown', surTouche)
    }
  }, [ouvert])

  return (
    <div ref={conteneurRef} className="relative">
      <button
        ref={boutonRef}
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        aria-controls={ouvert ? menuId : undefined}
        aria-label="Menu"
        className={[
          'grid place-items-center rounded-md p-1.5 transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel',
          ouvert ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:text-ink',
        ].join(' ')}
      >
        <Icon name={ouvert ? 'x' : 'list'} weight="bold" size={22} />
      </button>

      {ouvert && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Menu"
          data-placement={placement}
          onKeyDown={(e) => {
            // Tab leaves the menu: close it and let the focus move on.
            if (e.key === 'Tab') setOuvert(false)
            else surToucheMenu(e)
          }}
          style={hauteurMax === undefined ? undefined : { maxHeight: hauteurMax }}
          className={[
            'absolute right-0 z-40 w-56 overflow-y-auto rounded-lg border border-line bg-surface-panel p-1.5',
            placement === 'dessus' ? 'bottom-full mb-2' : 'top-full mt-2',
          ].join(' ')}
        >
          {ENTREES.map((entree) => (
            <Link
              key={entree.href}
              href={entree.href}
              role="menuitem"
              onClick={() => setOuvert(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 font-display text-sm font-bold text-ink transition-colors duration-[var(--duration-fast)] hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Icon name={entree.icon} size={20} className="shrink-0 text-ink-muted" />
              {entree.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
