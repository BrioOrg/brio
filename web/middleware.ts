import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { apiBaseUrl } from '@/lib/api-base-url'

/**
 * Pages anyone may open: logging in, signing up, joining a class, the consent links sent by
 * e-mail, the styleguide. Everything else needs a live session (#279) — the catalogue and its
 * chapters included, so a new page is protected unless it is added here. `/api` is the
 * dev-only rewrite to the backend, which enforces its own auth.
 *
 * The middleware is a UX guard, not a security boundary. Spring Security is
 * the enforcement point; this just avoids showing a page the visitor cannot use.
 */
const PUBLIC_PREFIXES = [
  '/connexion',
  '/inscription',
  '/commencer',
  '/rejoindre',
  '/consentement',
  '/design',
  '/api',
]

const SESSION_COOKIE = 'JSESSIONID'

function estPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * Whether the backend says the session cookie no longer opens a session. A cookie alone proves
 * nothing: an expired session still carries one. Only a 401 counts — if the backend cannot be
 * reached, the page renders and shows its own error rather than a misleading login.
 *
 * The call also renews the session's idle timeout: opening a page is activity.
 */
async function sessionExpiree(request: NextRequest): Promise<boolean> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/moi`, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
      cache: 'no-store',
    })
    return res.status === 401
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (estPublic(pathname)) return NextResponse.next()

  if (request.cookies.has(SESSION_COOKIE) && !(await sessionExpiree(request))) {
    return NextResponse.next()
  }

  // Back to this very page (slide included) once logged in again.
  const loginUrl = new URL('/connexion', request.url)
  loginUrl.searchParams.set('from', pathname + search)
  return NextResponse.redirect(loginUrl, 302)
}

export const config = {
  // Node.js, not Edge: API_INTERNAL_URL is then read at request time, like everywhere else
  // on the server (ADR 0024 §5), instead of being frozen into the build.
  runtime: 'nodejs',
  // Pages only: not Next's own files, nor the static ones in public/ (icons, fonts), which the
  // login page needs too. Add a folder here when public/ gets a new one.
  matcher: ['/((?!_next/|icons/|fonts/|favicon\\.ico).*)'],
}
