import type { Metadata } from 'next'
import { ConfirmButton } from './ConfirmButton'

export const metadata: Metadata = {
  title: 'Confirmation parentale — brio',
}

export default async function ConsentementPage({ params }: { params: Promise<{ token: string }> }) {
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
            Autorisation <span className="text-accent">parentale</span>
          </h1>

          <p className="mt-3 font-prose text-sm text-ink-muted">
            Votre enfant a créé un compte sur{' '}
            <strong className="font-extrabold text-ink">brio</strong>, une plateforme éducative
            destinée aux élèves de collège et de lycée.
          </p>

          <div className="mt-5 rounded-md border border-line bg-surface-raised px-4 py-4">
            <p className="font-prose text-sm font-bold text-ink">Ce que vous autorisez :</p>
            <ul className="mt-2 list-inside list-disc space-y-1 font-prose text-sm text-ink-muted">
              <li>La création d'un compte élève pseudonymisé.</li>
              <li>L'accès aux cours et exercices de la plateforme.</li>
              <li>
                Aucun nom ni prénom de votre enfant n'est stocké — son identité reste dans sa classe
                uniquement.
              </li>
            </ul>
          </div>

          <p className="mt-4 font-prose text-sm text-ink-muted">
            Vous recevrez un lien pour retirer votre autorisation à tout moment si vous changez
            d'avis.
          </p>

          <div className="mt-6">
            <ConfirmButton token={token} />
          </div>
        </div>

        <p className="mt-6 text-center font-prose text-xs text-ink-muted">
          Ce lien est à usage unique et expire dans 7 jours. En cas de question, contactez
          l'établissement de votre enfant.
        </p>
      </div>
    </main>
  )
}
