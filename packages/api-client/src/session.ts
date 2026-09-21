import { z } from 'zod'
import { ensureCsrfToken, csrfHeaders, readXsrfToken } from './csrf.js'

/**
 * Session (authentication) client — manual Zod wrapper.
 *
 * The login/logout endpoints are Spring Security form-login processing URLs, so
 * springdoc does not document them in the OpenAPI spec; they cannot be reached
 * through the generated `createApiClient`. This module is the typed, validated
 * boundary for them, following the manual-wrapper pattern in `.claude/rules/frontend.md`.
 *
 * Backend contract (fr.brio.identite / fr.brio.system.web.SecurityConfig):
 *   POST   /api/sessions   form-encoded `identifiant` + `mot_de_passe`
 *                          200 -> CompteInfo · 401 -> { error }
 *   DELETE /api/sessions   204
 *   GET    /api/moi        200 -> CompteInfo · 401 when no session
 *
 * CSRF: the backend uses CookieCsrfTokenRepository (XSRF-TOKEN cookie, readable
 * by JS) and expects the token echoed in the X-XSRF-TOKEN header on mutating
 * requests. All calls use `credentials: 'include'` so the session cookie rides.
 */

/**
 * Public projection of an authenticated account (fr.brio.identite.api.CompteInfo).
 * `nom` and `email` are null for élève accounts (ADR 0016 §2).
 * `role`/`statut` are kept as strings on purpose: the client must not break if
 * the backend adds a role or status it does not yet branch on.
 */
export const CompteInfoSchema = z.object({
  id: z.string(),
  role: z.string(),
  statut: z.string(),
  nom: z.string().nullable(),
  email: z.string().nullable(),
})

export type CompteInfo = z.infer<typeof CompteInfoSchema>

/** Thrown when login fails; carries the HTTP status for the caller to branch on. */
export class LoginError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'LoginError'
  }
}

/** Log in with an identifier (login name or e-mail) and password. */
export async function login(
  baseUrl: string,
  identifiant: string,
  motDePasse: string
): Promise<CompteInfo> {
  const token = await ensureCsrfToken(baseUrl)
  const res = await fetch(`${baseUrl}/api/sessions`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...csrfHeaders(token),
    },
    body: new URLSearchParams({ identifiant, mot_de_passe: motDePasse }).toString(),
  })

  if (!res.ok) {
    // The backend returns the same 401 for bad credentials and for accounts in
    // en_attente_consentement (ADR 0016 §5) — do not distinguish them to the user.
    const message =
      res.status === 401
        ? 'Identifiant ou mot de passe incorrect.'
        : 'La connexion a échoué. Réessaie dans un instant.'
    throw new LoginError(res.status, message)
  }

  return CompteInfoSchema.parse(await res.json())
}

/** End the current session. Idempotent from the caller's point of view. */
export async function logout(baseUrl: string): Promise<void> {
  const token = readXsrfToken()
  await fetch(`${baseUrl}/api/sessions`, {
    method: 'DELETE',
    credentials: 'include',
    headers: csrfHeaders(token),
  })
}

/** Return the currently authenticated account, or null when not logged in. */
export async function getMoi(baseUrl: string): Promise<CompteInfo | null> {
  const res = await fetch(`${baseUrl}/api/moi`, { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Impossible de récupérer le compte connecté.')
  return CompteInfoSchema.parse(await res.json())
}
