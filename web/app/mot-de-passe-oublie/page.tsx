import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Récupérer mon accès — brio',
}

// PL-4 (#364, ADR 0036). Static Server Component: no field, no e-mail, nothing submitted, so
// nothing can tell whether an account exists. Short sentences, the instruction first: the teacher
// resets access to the student's OWN account (identifier + a provisional password, 7 days, single
// use), then the student chooses their own password. There is no other way in — no contact
// channel exists yet (ADR 0036 §1bis) — and a new account would lose the class and progression,
// so the page says to wait for the teacher. No link to /rejoindre: that creates another account.
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

          <p className="mt-4 rounded-md border-2 border-accent bg-surface-raised px-4 py-3 font-prose text-base text-ink">
            <strong className="font-extrabold">Va voir ton prof.</strong> Il te redonne ton
            identifiant et un mot de passe provisoire. C’est pour{' '}
            <strong className="font-extrabold">ton</strong> compte. Ensuite, tu choisis ton propre
            mot de passe.
          </p>

          <ul className="mt-4 list-inside list-disc space-y-1 font-prose text-sm text-ink-muted">
            <li>
              Mot de passe oublié, identifiant oublié, ou les deux&nbsp;: c’est la même solution.
            </li>
            <li>
              Il n’y a pas d’autre solution. Si ce n’est pas possible ce soir, attends ton prof.
            </li>
            <li>
              <strong className="font-semibold text-ink">Ne crée pas de nouveau compte.</strong> Ta
              progression t’attend&nbsp;: tu gardes ton compte, ta classe et ta progression.
            </li>
            <li>
              Le mot de passe provisoire marche une seule fois. Il expire au bout de 7&nbsp;jours.
            </li>
            <li>Pas besoin de ton e-mail&nbsp;: brio ne t’en demande jamais.</li>
          </ul>
        </div>

        <p className="mt-6 text-center font-prose text-sm text-ink-muted">
          <Link
            href="/connexion"
            className="inline-flex items-center gap-1 rounded-sm hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span aria-hidden="true">←</span>
            Revenir à la connexion
          </Link>
        </p>
      </div>
    </main>
  )
}
