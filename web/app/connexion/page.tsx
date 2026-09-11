import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/login-form'

export const metadata: Metadata = {
  title: 'Connexion — brio',
}

export default function ConnexionPage() {
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
            Content de te <span className="text-accent">revoir&nbsp;!</span>
          </h1>
          <p className="mt-2 mb-6 font-prose text-sm text-ink-muted">
            Connecte-toi : on retrouve ta classe et ta progression.
          </p>

          <LoginForm />
        </div>

        <p className="mt-6 text-center font-prose text-sm text-ink-muted">
          Nouveau sur brio ?{' '}
          <Link
            href="/inscription"
            className="rounded-sm font-extrabold text-accent-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  )
}
