import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Routes that require a live session. Add a prefix here whenever a new
 * protected page is created. Everything else (catalogue, connexion, consent,
 * home) is public — the backend enforces auth on individual API calls.
 *
 * The middleware is a UX guard, not a security boundary. Spring Security is
 * the enforcement point; this just avoids showing a broken page.
 */
const PROTECTED_PREFIXES = ['/ma-classe', '/profil', '/tableau-de-bord', '/enseignant', '/prof']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  if (request.cookies.has('JSESSIONID')) return NextResponse.next()

  const loginUrl = new URL('/connexion', request.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl, 302)
}

export const config = {
  matcher: ['/((?!_next|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
}
