import type { Metadata } from 'next'
import Link from 'next/link'
import { CarteLien, Fleche } from '@/components/carte-lien'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata: Metadata = {
  title: 'Récupérer mon accès — brio',
}

// Static Server Component (PL-4, #364, ADR 0036): no field, no e-mail, nothing submitted.
// The dead `/mot-de-passe-oublie` link (404) becomes a living instruction screen that routes
// the student back to their teacher — recovery is re-issued through the existing `/rejoindre`
// flow, with no new backend endpoint and no account enumeration.
export default function MotDePasseOubliePage() {
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
            Récupérer ton <span className="text-accent">accès</span>
          </h1>

          <EmptyState
            icon="chalkboard"
            title="Pas de panique."
            description="Que tu aies oublié ton mot de passe, ton identifiant, ou les deux, tu peux récupérer ton accès."
            className="py-8"
          />

          <div className="rounded-md border border-line bg-surface-raised px-4 py-4">
            <p className="font-prose text-sm font-bold text-ink">Comment récupérer ton accès</p>
            <ul className="mt-2 list-inside list-disc space-y-1 font-prose text-sm text-ink-muted">
              <li>
                Va voir <strong className="font-extrabold text-ink">ton prof</strong> : c&apos;est
                lui qui gère les comptes de ta classe.
              </li>
              <li>
                Il te ré-émet un <strong className="font-extrabold text-ink">identifiant</strong> et
                un <strong className="font-extrabold text-ink">mot de passe</strong> tout neufs.
              </li>
              <li>Pas besoin d&apos;e-mail : brio ne t&apos;en demande jamais.</li>
            </ul>
          </div>

          <div className="mt-6">
            <CarteLien href="/rejoindre" enAvant>
              <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                J&apos;ai reçu un nouveau code
              </span>
              <span className="flex items-center justify-between gap-2 font-prose text-sm text-ink-muted">
                Rejoindre ma classe
                <Fleche />
              </span>
            </CarteLien>
          </div>

          <p className="mt-4 font-prose text-xs text-ink-muted">
            Le nouvel accès que ton prof te donne est à usage unique et expire après 7 jours :
            connecte-toi vite pour choisir ton mot de passe.
          </p>
        </div>

        <p className="mt-6 text-center font-prose text-sm text-ink-muted">
          <Link
            href="/connexion"
            className="rounded-sm hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ← Revenir à la connexion
          </Link>
        </p>
      </div>
    </main>
  )
}
