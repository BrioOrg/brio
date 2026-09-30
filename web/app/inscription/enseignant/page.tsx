import type { Metadata } from 'next'
import Link from 'next/link'
import { InscriptionEnseignantForm } from '@/components/inscription-enseignant-form'
import { listerEtablissements } from '@/lib/enrollment'

export const metadata: Metadata = {
  title: 'Créer mon compte enseignant — brio',
}

// The établissements come from the backend at request time, never at build time.
export const dynamic = 'force-dynamic'

export default async function InscriptionEnseignantPage() {
  // An unreachable backend shows the same "no établissement" notice as an empty list.
  const etablissements = await listerEtablissements().catch(() => [])

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
            Votre e-mail vous servira à vous connecter. Vous pourrez ajouter d’autres établissements
            ensuite.
          </p>

          <InscriptionEnseignantForm etablissements={etablissements} />
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
