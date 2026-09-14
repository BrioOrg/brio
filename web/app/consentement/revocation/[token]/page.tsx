import type { Metadata } from 'next'
import { RevokeButton } from './RevokeButton'

export const metadata: Metadata = {
  title: 'Retrait d'autorisation — brio',
}

export default async function RevocationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="font-display text-2xl font-black tracking-tight text-ink">
            br<span className="text-accent">io</span>
          </span>
        </div>

        <div className="rounded-lg border border-line bg-surface-panel p-6 sm:p-8">
          <h1 className="font-display text-2xl font-black leading-tight tracking-tight text-ink">
            Retrait de <span className="text-accent">l'autorisation</span>
          </h1>

          <p className="mt-3 font-prose text-sm text-ink-muted">
            En confirmant ci-dessous, vous retirez votre autorisation parentale
            pour le compte brio de votre enfant. Son compte sera suspendu
            immédiatement.
          </p>

          <div className="mt-5 rounded-md border border-line bg-surface-raised px-4 py-4">
            <p className="font-prose text-sm text-ink-muted">
              Le retrait de l'autorisation ne supprime pas le compte ni le travail
              de votre enfant. Contactez l'établissement pour réactiver le compte
              si vous le souhaitez.
            </p>
          </div>

          <div className="mt-6">
            <RevokeButton token={token} />
          </div>
        </div>

        <p className="mt-6 text-center font-prose text-xs text-ink-muted">
          En cas de question, contactez l'établissement de votre enfant.
        </p>
      </div>
    </main>
  )
}
