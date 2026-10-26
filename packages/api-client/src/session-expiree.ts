/**
 * Expired-session signal (#279). A 401 on a call made from a page that needs a session means
 * the student's session has ended: besides the error the caller shows, the app has to send
 * them back to the login page. The error builders of this package raise the signal; each app
 * decides what to do with it (the web app shows a message, then redirects).
 *
 * Framework-free on purpose: the mobile app will subscribe its own handler.
 */
type Ecouteur = () => void

const ecouteurs = new Set<Ecouteur>()

/** Subscribe to expired sessions. Returns the unsubscribe function. */
export function surSessionExpiree(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur)
  return () => {
    ecouteurs.delete(ecouteur)
  }
}

/** Tell the subscribers the session has expired (a 401 on an authenticated call). */
export function signalerSessionExpiree(): void {
  for (const ecouteur of ecouteurs) ecouteur()
}
