import 'katex/dist/katex.min.css'

import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { CompteInfoSchema } from '@brio/api-client'
import { LogoutButton } from '@/components/logout-button'
import { Icon } from '@/components/ui/icon'
import { apiBaseUrl } from '@/lib/api-base-url'

/**
 * Role gate for the teacher space. The middleware only checks that a session cookie
 * is present — JSESSIONID is opaque, so the role can't be read there. Here we ask the
 * backend who the caller is and let only ENSEIGNANT accounts through. This mirrors the
 * backend gate on /api/prof/** ; it exists so non-teachers see a redirect, not a broken page.
 *
 * The top bar carries the way back to the student catalogue and the logout button for
 * every teacher page. The session was just verified above, so the button is rendered
 * without asking again.
 */
export default async function ProfLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const res = await fetch(`${apiBaseUrl()}/api/moi`, {
    headers: { cookie: cookieStore.toString() },
    cache: 'no-store',
  })

  // No live session (expired or absent): send to login, keeping the return path.
  if (!res.ok) redirect('/connexion?from=/prof')

  const moi = CompteInfoSchema.parse(await res.json())
  // Authenticated but not a teacher: the teacher space is not theirs.
  if (moi.role !== 'enseignant') redirect('/')

  return (
    <>
      <div data-theme="light" className="border-b border-line bg-surface-panel">
        <div className="flex h-12 items-center justify-between gap-3 px-4">
          <Link
            href="/prof"
            className="rounded-sm font-display text-lg font-black tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel"
            aria-label="brio — espace enseignant"
          >
            br<span className="text-accent">io</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 font-display text-sm font-bold text-ink-muted transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel sm:px-3"
            >
              <Icon name="compass" size={20} />
              {/* Narrow screens keep the icon only; the label stays for screen readers. */}
              <span className="sr-only sm:not-sr-only">Voir le catalogue</span>
            </Link>
            <LogoutButton />
          </div>
        </div>
      </div>
      {children}
    </>
  )
}
