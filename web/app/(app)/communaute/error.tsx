'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

/** The backend did not answer: say so, and never pass it off as an empty Communauté. */
export default function CommunauteError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter()
  const [enCours, demarrer] = useTransition()

  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Communauté' }]} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <EmptyState
          icon="warning-circle"
          title="La Communauté n’a pas pu se charger"
          description="Vérifie ta connexion, puis réessaie."
          action={
            <Button
              loading={enCours}
              onClick={() =>
                demarrer(() => {
                  // A Server Component's error only clears once it has been fetched again.
                  router.refresh()
                  reset()
                })
              }
            >
              Réessayer
            </Button>
          }
        />
      </main>
    </div>
  )
}
