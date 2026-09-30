import type { Metadata } from 'next'
import Link from 'next/link'
import { InscriptionEnseignantForm } from '@/components/inscription-enseignant-form'

export const metadata: Metadata = {
  title: 'Créer mon compte enseignant — brio',
}

export default function InscriptionEnseignantPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="font-display text-2xl font-black tracking-tight text-ink">
            br<span className="text-accent">io</span>
          </span>
        </div>

        <div className="rounded-lg border border-line bg-surface-panel p-6 sm:p-8">
          <h1 className="font-display text-2xl font-black leading-tight tracking-tight text-ink">
            Créez votre compte <span className="text-accent">enseignant</span>
          </h1>
          <p className="mt-2 mb-6 font-prose text-sm text-ink-muted">
            Votre e-mail vous servira à vous connecter.
          </p>

          <InscriptionEnseignantForm />
        </div>

        <p className="mt-6 text-center font-prose text-sm text-ink-muted">
          Déjà un compte&nbsp;?{' '}
          <Link
            href="/connexion?from=/prof"
            className="rounded-sm font-extrabold text-accent-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  )
}
