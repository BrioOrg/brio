'use client'

import { useEffect, useState } from 'react'
import { surSessionExpiree } from '@brio/api-client'
import { Icon } from '@/components/ui/icon'

/**
 * Time the student has to read the message before the redirect. Behaviour, not motion: no
 * animation runs during it, so it is not a duration token.
 */
export const DELAI_REDIRECTION_MS = 3000

/** The login page, sending the student back to where they were once logged in again. */
export function urlReconnexion(chemin: string): string {
  return `/connexion?from=${encodeURIComponent(chemin)}`
}

/**
 * Expired session during an action (#279): an answer, a tutor question, a message… came back
 * 401. The widget shows its own error; this says what happens next, then sends the student to
 * the login page, which brings them back here afterwards. A full navigation, not a client one:
 * nothing of the logged-out page should survive.
 */
export function SessionExpireeAlerte() {
  const [retour, setRetour] = useState<string | null>(null)

  useEffect(
    () =>
      surSessionExpiree(() => {
        const { pathname, search } = window.location
        // Already on the login page: nothing to come back to.
        if (pathname.startsWith('/connexion')) return
        setRetour((actuel) => actuel ?? urlReconnexion(pathname + search))
      }),
    []
  )

  useEffect(() => {
    if (!retour) return
    const minuterie = window.setTimeout(() => window.location.assign(retour), DELAI_REDIRECTION_MS)
    return () => window.clearTimeout(minuterie)
  }, [retour])

  if (!retour) return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <div
        role="alert"
        className="flex w-full max-w-md items-start gap-3 rounded-lg border-2 border-warning bg-surface-panel p-4 font-prose text-sm text-ink"
      >
        <Icon
          name="warning-circle"
          weight="bold"
          size={20}
          className="mt-0.5 shrink-0 text-warning"
        />
        <div>
          <p className="font-display font-extrabold text-ink">Ta session a expiré</p>
          <p className="mt-1 text-ink-muted">
            On te ramène à la page de connexion. Une fois reconnecté, tu reviendras ici.
          </p>
          <a
            href={retour}
            className="mt-2 inline-block rounded-sm font-extrabold text-accent-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Me reconnecter maintenant
          </a>
        </div>
      </div>
    </div>
  )
}
