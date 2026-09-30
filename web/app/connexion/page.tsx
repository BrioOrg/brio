import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/login-form'
import { Icon } from '@/components/ui/icon'

export const metadata: Metadata = {
  title: 'Connexion — brio',
}

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; inscrit?: string }>
}) {
  const { from, inscrit } = await searchParams
  // Guard against open-redirect: only allow relative paths on this origin.
  const redirectTo = from && from.startsWith('/') && !from.startsWith('//') ? from : '/'

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

          {/* Set by the teacher signup form, which redirects here instead of logging in. */}
          {inscrit === '1' && (
            <p
              role="status"
              className="mb-4 flex items-start gap-2 rounded-md border-2 border-accent bg-surface-raised px-3 py-2.5 font-prose text-sm text-accent-ink"
            >
              <Icon name="check" weight="bold" size={18} className="mt-0.5 shrink-0" />
              <span>Votre compte est créé. Connectez-vous avec votre e-mail.</span>
            </p>
          )}

          <LoginForm redirectTo={redirectTo} />
        </div>

        <p className="mt-6 text-center font-prose text-sm text-ink-muted">
          Nouveau sur brio ?{' '}
          <Link
            href="/commencer"
            className="rounded-sm font-extrabold text-accent-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  )
}
