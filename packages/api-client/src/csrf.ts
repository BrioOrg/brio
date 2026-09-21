/**
 * CSRF helpers shared by every mutating call (login, submissions, …).
 *
 * The backend uses Spring Security's CookieCsrfTokenRepository: it writes an
 * `XSRF-TOKEN` cookie (readable by JS) and expects the value echoed in the
 * `X-XSRF-TOKEN` header on mutating requests. On a fresh browser the cookie only
 * exists once a response has passed through the CsrfFilter, so we prime it with a
 * GET before the first mutation. All calls ride the session cookie
 * (`credentials: 'include'`).
 */

const XSRF_COOKIE = 'XSRF-TOKEN'
const XSRF_HEADER = 'X-XSRF-TOKEN'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const hit = document.cookie.split('; ').find((c) => c.startsWith(prefix))
  return hit ? decodeURIComponent(hit.slice(prefix.length)) : null
}

/** The current XSRF token from the cookie, or null if none has been set yet. */
export function readXsrfToken(): string | null {
  return readCookie(XSRF_COOKIE)
}

/**
 * Ensure an XSRF-TOKEN cookie exists before a mutating request. When absent, a
 * GET /api/moi is enough to make the CsrfFilter set it (the 401 for a logged-out
 * visitor is irrelevant — we only want the cookie).
 */
export async function ensureCsrfToken(baseUrl: string): Promise<string | null> {
  const existing = readXsrfToken()
  if (existing) return existing
  try {
    await fetch(`${baseUrl}/api/moi`, { credentials: 'include' })
  } catch {
    // Network error is surfaced by the actual mutating request that follows.
  }
  return readXsrfToken()
}

/** The CSRF header to spread onto a mutating request, or nothing when no token. */
export function csrfHeaders(token: string | null): Record<string, string> {
  return token ? { [XSRF_HEADER]: token } : {}
}
