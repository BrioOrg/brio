import { SiteHeader } from '@/components/site-header'
import { Skeleton } from '@/components/ui/skeleton'

export default function CommunauteLoading() {
  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Communauté' }]} />
      <main
        aria-busy="true"
        aria-label="Chargement"
        className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-10 sm:px-6 sm:py-14"
      >
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-28 w-full" rounded="lg" />
        <Skeleton className="h-28 w-full" rounded="lg" />
        <Skeleton className="h-28 w-full" rounded="lg" />
      </main>
    </div>
  )
}
