'use client'

import { useSyncExternalStore } from 'react'

/**
 * Full screen for the interactive mode (#250), on the whole document: the drawer, the exercise
 * dialogs and the tooltips portal to `<body>`, and would vanish if only the slide went full screen.
 * Escape leaves it: the browser does that itself.
 */

function abonner(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange)
  return () => document.removeEventListener('fullscreenchange', onChange)
}

/** False where the API is missing or refused, as on an iPhone: the button does not show. */
function disponible(): boolean {
  return (
    document.fullscreenEnabled === true &&
    typeof document.documentElement.requestFullscreen === 'function'
  )
}

export function estPleinEcran(): boolean {
  return typeof document !== 'undefined' && Boolean(document.fullscreenElement)
}

/** A refusal (no user gesture, a policy) leaves the page as it was, silently. */
export function basculerPleinEcran() {
  if (estPleinEcran()) {
    quitterPleinEcran()
  } else if (disponible()) {
    Promise.resolve(document.documentElement.requestFullscreen()).catch(() => {})
  }
}

export function quitterPleinEcran() {
  if (estPleinEcran()) Promise.resolve(document.exitFullscreen()).catch(() => {})
}

/** Read as unavailable on the server and at hydration, so the first paint never differs. */
export function usePleinEcran(): { disponible: boolean; actif: boolean } {
  const dispo = useSyncExternalStore(abonner, disponible, () => false)
  const actif = useSyncExternalStore(abonner, estPleinEcran, () => false)
  return { disponible: dispo, actif }
}
