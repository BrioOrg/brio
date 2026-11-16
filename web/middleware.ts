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
  '/mot-de-passe-oublie',
  '/consentement',
  '/design',
  '/api',
]

const SESSION_COOKIE = 'JSESSIONID'

function estPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * The student's forced password choice after a teacher-led reset (ADR 0036). It needs the session
 * opened by the provisional password, so it is NOT public: without a session, the visitor goes to
 * /connexion like for any page.
 */
const CHANGER_MOT_DE_PASSE = '/changer-mot-de-passe'

type EtatSession = 'expiree' | 'ouverte' | 'mot-de-passe-a-changer'

/**
 * What the backend says of the session cookie. A cookie alone proves nothing: an expired session
 * still carries one. Only a 401 counts as expired — if the backend cannot be reached, the page
 * renders and shows its own error rather than a misleading login. A session whose password must
 * be changed (ADR 0036 §5) is reported so the visitor lands on the change, not on pages the
 * backend would refuse.
 *
 * The call also renews the session's idle timeout: opening a page is activity.
 */
async function etatSession(request: NextRequest): Promise<EtatSession> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/moi`, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
      cache: 'no-store',
    })
    if (res.status === 401) return 'expiree'
    if (!res.ok) return 'ouverte'
    const moi: unknown = await res.json().catch(() => null)
    const aChanger =
      typeof moi === 'object' &&
      moi !== null &&
      (moi as { doitChangerMotDePasse?: unknown }).doitChangerMotDePasse === true
    return aChanger ? 'mot-de-passe-a-changer' : 'ouverte'
  } catch {
    return 'ouverte'
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (estPublic(pathname)) return NextResponse.next()

  if (request.cookies.has(SESSION_COOKIE)) {
    const etat = await etatSession(request)
    if (etat === 'mot-de-passe-a-changer' && pathname !== CHANGER_MOT_DE_PASSE) {
      return NextResponse.redirect(new URL(CHANGER_MOT_DE_PASSE, request.url), 302)
    }
    // Nothing to change any more: the page has no purpose, home is where the student goes next.
    if (etat === 'ouverte' && pathname === CHANGER_MOT_DE_PASSE) {
      return NextResponse.redirect(new URL('/', request.url), 302)
    }
    if (etat !== 'expiree') return NextResponse.next()
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
