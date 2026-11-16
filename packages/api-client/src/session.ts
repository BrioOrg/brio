import { z } from 'zod'
import { ensureCsrfToken, csrfHeaders } from './csrf.js'

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
 *   DELETE /api/sessions   204 (with or without a session) · 403 without a CSRF token
 *   GET    /api/moi        200 -> CompteInfo · 401 when no session
 *   POST   /api/moi/mot-de-passe  { nouveauMotDePasse }  204 · 400 too short · 409 no change
 *                          pending · 422 same as the provisional password (ADR 0036 §5)
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
  // Student accounts only: the out-of-class identity (#325) and the school level.
  pseudonyme: z.string().nullish(),
  niveau: z.string().nullish(),
  // After a teacher-led reset (ADR 0036): the student must choose their own password first.
  // Absent from a backend that predates it: read as "nothing to change".
  doitChangerMotDePasse: z.boolean().optional(),
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

/** Thrown when logout fails: the session is still open on the server. */
export class LogoutError extends Error {
  constructor(readonly status: number) {
    super('La déconnexion a échoué.')
    this.name = 'LogoutError'
  }
}

/**
 * End the current session. Idempotent: the backend answers 204 even when the
 * session already expired. Throws LogoutError on any other status — notably a
 * 403 for a missing or stale CSRF token, where the session is still open and the
 * caller must not tell the user otherwise.
 */
export async function logout(baseUrl: string): Promise<void> {
  const token = await ensureCsrfToken(baseUrl)
  const res = await fetch(`${baseUrl}/api/sessions`, {
    method: 'DELETE',
    credentials: 'include',
    headers: csrfHeaders(token),
  })
  if (!res.ok) throw new LogoutError(res.status)
}

/** Return the currently authenticated account, or null when not logged in. */
export async function getMoi(baseUrl: string): Promise<CompteInfo | null> {
  const res = await fetch(`${baseUrl}/api/moi`, { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Impossible de récupérer le compte connecté.')
  return CompteInfoSchema.parse(await res.json())
}

/** Thrown when the forced password change fails; carries the HTTP status. */
export class ChangerMotDePasseError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ChangerMotDePasseError'
  }
}

/** Minimum length of a password chosen by the student (ChangerMotDePasseRequest). */
export const MOT_DE_PASSE_MIN = 8

/**
 * The student's own password, chosen right after logging in with the provisional password a
 * teacher gave them (ADR 0036 §5). The server accepts it only while that change is pending.
 */
export async function changerMotDePasse(baseUrl: string, nouveauMotDePasse: string): Promise<void> {
  const token = await ensureCsrfToken(baseUrl)
  const res = await fetch(`${baseUrl}/api/moi/mot-de-passe`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders(token) },
    body: JSON.stringify({ nouveauMotDePasse }),
  })
  if (res.ok) return
  const message =
    res.status === 400
      ? `Ton mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`
      : res.status === 422
        ? 'Choisis un mot de passe différent du mot de passe provisoire.'
        : res.status === 401
          ? 'Ta session a expiré. Demande un nouveau mot de passe provisoire à ton prof.'
          : res.status === 409
            ? 'Ton mot de passe est déjà choisi : tu peux continuer.'
            : 'Le changement a échoué. Réessaie dans un instant.'
  throw new ChangerMotDePasseError(res.status, message)
}
