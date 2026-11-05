import Link from 'next/link'

import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

/** A wrong link, or a question its author has since deleted. */
export default function QuestionIntrouvable() {
  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      <SiteHeader crumbs={[{ label: 'Communauté', href: '/communaute' }, { label: 'Question' }]} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <EmptyState
          icon="chat-circle"
          title="Cette question n’existe pas ou plus"
          description="Son auteur l’a peut-être supprimée."
          action={
            <Link href="/communaute">
              <Button tabIndex={-1}>Retour à la Communauté</Button>
            </Link>
          }
        />
      </main>
    </div>
  )
}
