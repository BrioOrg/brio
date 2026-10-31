import { cookies } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'

import { CoursDeTaClasse } from '@/components/cours-de-ta-classe'
import { SalonClasse } from '@/components/messagerie/salon-classe'
import { SiteHeader } from '@/components/site-header'
import { Icon } from '@/components/ui/icon'
import { getCatalogue, getCoursVisibles, type CoursVisible } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Ma classe — Brio',
}

export const dynamic = 'force-dynamic'

export default async function MaClassePage() {
  const cookieStore = await cookies()
  const [catalogue, cours] = await Promise.all([
    getCatalogue().catch(() => []),
    // Any failure simply shows no course section.
    getCoursVisibles(cookieStore.toString()).catch((): CoursVisible[] => []),
  ])

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Ma classe' }]} />
      <SalonClasse />
      {/* Devoirs and the class's courses left the navigation and Explorer: they stay reachable
          here until this page becomes the class space (#322). */}
      <div className="mx-auto max-w-2xl px-4 pb-10">
        <Link
          href="/devoirs"
          className="flex items-center justify-between rounded-lg border border-line bg-surface-panel p-4 font-display font-extrabold text-ink transition-colors duration-[var(--duration-base)] hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
        >
          Tes devoirs
          <Icon name="arrow-right" size={18} className="text-ink-muted" />
        </Link>
        {cours.length > 0 && <CoursDeTaClasse cours={cours} catalogue={catalogue} />}
      </div>
    </div>
  )
}
