import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { CompteInfoSchema } from '@brio/api-client'
import { LogoutButton } from '@/components/logout-button'
import { RoleBadge } from '@/components/role-badge'
import { Icon } from '@/components/ui/icon'
import { apiBaseUrl } from '@/lib/api-base-url'

/**
 * Role gate for the Brio administration space (suivi #338). As in the teacher layout, the
 * middleware only proves a session cookie is present — the role lives behind it — so we ask the
 * backend who the caller is and let only `admin_brio` through. This mirrors the backend gate on
 * `/api/admin/**`; it exists so other roles see a redirect, not a broken page.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const res = await fetch(`${apiBaseUrl()}/api/moi`, {
    headers: { cookie: cookieStore.toString() },
    cache: 'no-store',
  })

  if (!res.ok) redirect('/connexion?from=/admin')

  const moi = CompteInfoSchema.parse(await res.json())
  if (moi.role !== 'admin_brio') redirect('/')

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="border-b border-line bg-surface-panel">
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between gap-3 px-4">
          <Link
            href="/admin/communaute"
            className="rounded-sm font-display text-2xl font-black tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel"
            aria-label="brio — administration"
          >
            br<span className="text-accent">io</span>
          </Link>
          <div className="flex items-center gap-3">
            <RoleBadge role={moi.role} />
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 font-display text-sm font-bold text-ink-muted transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel sm:px-3"
            >
              <Icon name="compass" size={20} />
              <span className="sr-only sm:not-sr-only">Voir le catalogue</span>
            </Link>
            <LogoutButton />
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}
