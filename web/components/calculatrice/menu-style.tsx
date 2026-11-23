'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { CURVE_DASH } from '@/components/function-plot-layer'
import { Icon } from '@/components/ui/icon'
import { Infobulle } from '@/components/ui/infobulle'
import { useMenuDansEcran } from '@/components/ui/use-menu-dans-ecran'
import { CURVE_BG, type CurveColour } from '@/lib/curve-colours'

import { BOUTON_ICONE } from './classes'
import { COULEURS, NOMS_COULEURS } from './lignes'

// The colour and stroke of a curve (spec U4 §3.5): a menu of six colours and two strokes, built
// like the burger menu (Escape and Tab close it, the focus goes back to its button).

const OPTION =
  'cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function MenuStyle({
  numero,
  couleur,
  style,
  onCouleur,
  onStyle,
}: {
  numero: number
  couleur: CurveColour
  style: 'plein' | 'pointille'
  onCouleur: (c: CurveColour) => void
  onStyle: (s: 'plein' | 'pointille') => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const conteneurRef = useRef<HTMLDivElement>(null)
  const boutonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const { placement, hauteurMax } = useMenuDansEcran(ouvert, boutonRef, menuRef)

  const options = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])

  // The checked colour takes the focus when the menu opens.
  useEffect(() => {
    if (!ouvert) return
    const coche = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')
    ;(coche ?? options()[0])?.focus({ preventScroll: true })
  }, [ouvert])

  useEffect(() => {
    if (!ouvert) return
    function surClic(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setOuvert(false)
      }
    }
    document.addEventListener('mousedown', surClic)
    return () => document.removeEventListener('mousedown', surClic)
  }, [ouvert])

  function fermer() {
    setOuvert(false)
    boutonRef.current?.focus()
  }

  function surTouche(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      fermer()
      return
    }
    if (e.key === 'Tab') {
      setOuvert(false)
      return
    }
    const liste = options()
    const courant = liste.indexOf(document.activeElement as HTMLElement)
    const suivant: Record<string, number> = {
      ArrowRight: courant + 1,
      ArrowDown: courant + 1,
      ArrowLeft: courant - 1,
      ArrowUp: courant - 1,
      Home: 0,
      End: liste.length - 1,
    }
    if (!(e.key in suivant)) return
    e.preventDefault()
    liste[(suivant[e.key] + liste.length) % liste.length]?.focus()
  }

  return (
    <div ref={conteneurRef} className="relative">
      <Infobulle label="Couleur et trait">
        <button
          ref={boutonRef}
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          aria-haspopup="menu"
          aria-controls={ouvert ? menuId : undefined}
          aria-label={`Couleur et trait de l’expression ${numero}`}
          className={BOUTON_ICONE}
        >
          <Icon name="palette" size={20} />
        </button>
      </Infobulle>

      {ouvert && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Couleur et trait de l’expression ${numero}`}
          onKeyDown={surTouche}
          style={hauteurMax === undefined ? undefined : { maxHeight: hauteurMax }}
          className={[
            'absolute right-0 z-40 w-72 overflow-y-auto rounded-lg border border-line bg-surface-panel p-1.5',
            placement === 'dessus' ? 'bottom-full mb-2' : 'top-full mt-2',
          ].join(' ')}
        >
          <div role="group" aria-label="Couleur" className="grid grid-cols-6">
            {COULEURS.map((c) => (
              <button
                key={c}
                type="button"
                role="menuitemradio"
                aria-checked={c === couleur}
                aria-label={`Couleur ${c} : ${NOMS_COULEURS[c]}`}
                onClick={() => {
                  onCouleur(c)
                  fermer()
                }}
                className={`grid size-11 place-items-center ${OPTION}`}
              >
                <span
                  className={[
                    'grid size-6 place-items-center rounded-pill',
                    CURVE_BG[c],
                    c === couleur ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface-panel' : '',
                  ].join(' ')}
                >
                  {c === couleur && (
                    <Icon name="check" weight="bold" size={14} className="text-surface-page" />
                  )}
                </span>
              </button>
            ))}
          </div>
          <div role="group" aria-label="Trait" className="mt-1 border-t border-line pt-1">
            {(['plein', 'pointille'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="menuitemradio"
                aria-checked={s === style}
                onClick={() => {
                  onStyle(s)
                  fermer()
                }}
                className={`flex min-h-11 w-full items-center gap-3 px-3 font-display text-sm font-bold text-ink transition-colors duration-[var(--duration-fast)] hover:bg-accent-soft focus-visible:bg-accent-soft ${OPTION}`}
              >
                <svg width={24} height={24} aria-hidden="true" className="shrink-0">
                  <line
                    x1={2}
                    y1={12}
                    x2={22}
                    y2={12}
                    className="stroke-ink"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray={s === 'pointille' ? CURVE_DASH : undefined}
                  />
                </svg>
                {s === 'plein' ? 'Trait plein' : 'Trait pointillé'}
                {s === style && <Icon name="check" size={16} className="ml-auto text-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
