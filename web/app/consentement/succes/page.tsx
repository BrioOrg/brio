import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Compte activé — brio',
}

export default function ConsentementSuccesPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <span className="font-display text-2xl font-black tracking-tight text-ink">
            br<span className="text-accent">io</span>
          </span>
        </div>

        <div className="rounded-lg border border-line bg-surface-panel p-6 sm:p-8">
          <h1 className="font-display text-2xl font-black leading-tight tracking-tight text-ink">
            Compte <span className="text-accent">activé !</span>
          </h1>
          <p className="mt-3 font-prose text-sm text-ink-muted">
            Merci — votre autorisation a bien été enregistrée. Le compte de votre enfant est
            maintenant actif sur brio.
          </p>
          <p className="mt-3 font-prose text-sm text-ink-muted">
            Vous avez reçu un e-mail avec un lien pour retirer votre autorisation à tout moment si
            vous le souhaitez.
          </p>
        </div>

        <p className="mt-6 font-prose text-sm text-ink-muted">
          Votre enfant peut maintenant se{' '}
          <Link
            href="/connexion"
            className="rounded-sm font-extrabold text-accent-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            connecter
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
