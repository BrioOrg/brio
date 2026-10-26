'use client'

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useState,
} from 'react'

/** Côté du déclencheur où s'ouvre le menu. */
export type PlacementMenu = 'dessous' | 'dessus'

// Écart minimal gardé entre le menu et le bord de la fenêtre.
const MARGE_ECRAN_PX = 8

const SELECTEUR_OPTIONS = '[role="menuitem"]:not([aria-disabled="true"]):not([disabled])'

function options(menu: HTMLElement | null): HTMLElement[] {
  return menu ? Array.from(menu.querySelectorAll<HTMLElement>(SELECTEUR_OPTIONS)) : []
}

/**
 * Garde un menu déroulant entièrement visible dans la fenêtre, et le rend utilisable au clavier.
 *
 * À l'ouverture, il mesure la place sous le déclencheur : si le menu n'y tient pas et qu'il tient
 * au-dessus, il s'ouvre vers le haut. S'il ne tient d'aucun côté (petit écran), il prend le plus
 * grand des deux avec une hauteur maximale et défile en interne. Puis la première option reçoit
 * le focus, sans faire défiler la page. Les flèches, Début et Fin déplacent le focus entre les
 * options (`surToucheMenu`, à brancher sur le `onKeyDown` du menu).
 */
export function useMenuDansEcran(
  ouvert: boolean,
  declencheurRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>
): {
  placement: PlacementMenu
  hauteurMax: number | undefined
  surToucheMenu: (e: ReactKeyboardEvent<HTMLElement>) => void
} {
  const [placement, setPlacement] = useState<PlacementMenu>('dessous')
  const [hauteurMax, setHauteurMax] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    if (!ouvert) {
      setPlacement('dessous')
      setHauteurMax(undefined)
      return
    }

    function placer() {
      const declencheur = declencheurRef.current
      const menu = menuRef.current
      if (!declencheur || !menu) return
      const ancre = declencheur.getBoundingClientRect()
      // scrollHeight : la hauteur naturelle, même si une hauteur maximale le tronque déjà.
      const hauteurMenu = Math.max(menu.scrollHeight, menu.getBoundingClientRect().height)
      const dessous = window.innerHeight - ancre.bottom - MARGE_ECRAN_PX
      const dessus = ancre.top - MARGE_ECRAN_PX

      if (hauteurMenu <= dessous) {
        setPlacement('dessous')
        setHauteurMax(undefined)
      } else if (hauteurMenu <= dessus) {
        setPlacement('dessus')
        setHauteurMax(undefined)
      } else {
        const versLeHaut = dessus > dessous
        setPlacement(versLeHaut ? 'dessus' : 'dessous')
        setHauteurMax(Math.max(0, Math.floor(versLeHaut ? dessus : dessous)))
      }
    }

    placer()
    options(menuRef.current)[0]?.focus({ preventScroll: true })

    window.addEventListener('resize', placer)
    return () => window.removeEventListener('resize', placer)
  }, [ouvert, declencheurRef, menuRef])

  const surToucheMenu = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      const liste = options(menuRef.current)
      if (liste.length === 0) return
      const courant = liste.indexOf(document.activeElement as HTMLElement)
      let suivant: number
      switch (e.key) {
        case 'ArrowDown':
          suivant = courant < 0 ? 0 : (courant + 1) % liste.length
          break
        case 'ArrowUp':
          suivant = courant < 0 ? liste.length - 1 : (courant - 1 + liste.length) % liste.length
          break
        case 'Home':
          suivant = 0
          break
        case 'End':
          suivant = liste.length - 1
          break
        default:
          return
      }
      e.preventDefault()
      liste[suivant]?.focus()
    },
    [menuRef]
  )

  return { placement, hauteurMax, surToucheMenu }
}
